"""FastAPI app.

Three endpoints (per OQ-2):

* ``GET /campaign/stream?target=…`` — SSE stream of the campaign loop.
* ``GET /report`` — last full scorecard.
* ``GET /report/regression`` — vulnerable-vs-patched diff.

Plus a ``GET /healthz`` liveness probe for Cloud Run.

State model:
The server is **single-tenant by design** (per architecture §1.5). A
module-level ``_LAST`` dict caches one scorecard per target label so the
regression endpoint can pair them. Concurrent campaigns will trample
each other; the limitation is documented in the README and out of scope
per the spec's ruthless de-scope list.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

from adversary import config
from adversary.orchestrator import run_campaign
from adversary.scorecard import Scorecard, regression_diff
from api.replay import replay_available, replay_events
from target.patched_agent import build_patched_agent
from target.support_agent import build_target_agent

logger = logging.getLogger(__name__)


# --- App ----------------------------------------------------------------

app = FastAPI(
    title="Adversary",
    description=(
        "A self-improving AI red-team agent. Probes tool-using agents at "
        "the tool/action layer, traces every attempt to Arize Phoenix, and "
        "adapts strategy from its own observability data."
    ),
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(config.CORS_ALLOW_ORIGINS),
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)


# --- In-memory state ----------------------------------------------------
# One Scorecard per target label; the regression diff endpoint reads both.
_LAST: dict[str, Scorecard] = {}


# --- Helpers ------------------------------------------------------------

_TARGET_BUILDERS = {
    "vulnerable": build_target_agent,
    "patched": build_patched_agent,
}


def _resolve_builder(label: str) -> Any:
    """Map a ``target`` query value to a builder function."""
    builder = _TARGET_BUILDERS.get(label)
    if builder is None:
        raise HTTPException(
            status_code=400,
            detail=f"target must be one of {list(_TARGET_BUILDERS)}, got {label!r}",
        )
    return builder


# --- Endpoints ----------------------------------------------------------

@app.get("/health")
@app.get("/healthz")
async def healthz() -> dict[str, Any]:
    """Liveness/readiness probe. Returns config warnings for visibility.

    Exposed at both ``/health`` and ``/healthz``: Cloud Run's edge reserves
    and intercepts ``/healthz`` before it reaches the container, so ``/health``
    is the one that is actually reachable through the public URL.
    """
    return {
        "status": "ok",
        "version": "0.1.0",
        "warnings": config.validate(),
    }


_SENTINEL: dict[str, Any] = {"type": "__end__"}


@app.get("/campaign/stream")
async def campaign_stream(
    target: str = Query("vulnerable", description="vulnerable | patched"),
    replay: bool | None = Query(
        None,
        description="Replay the captured demo stream instead of running live. "
        "Defaults to the DEMO_MODE env setting. Guarantees a flawless run on "
        "a quota-limited project; set false to run a real live campaign.",
    ),
    speed: float = Query(1.0, description="Replay speed multiplier (0.1–10)."),
) -> EventSourceResponse:
    """Start a campaign and stream events as SSE (live or deterministic replay)."""
    use_replay = config.DEMO_MODE if replay is None else replay
    if use_replay and replay_available():
        return EventSourceResponse(_replay_stream(speed))
    builder = _resolve_builder(target)
    queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
    return EventSourceResponse(_stream_events(target, builder, queue))


async def _replay_stream(speed: float) -> Any:
    """Adapt the captured replay generator to the SSE ``{"data": ...}`` shape,
    and cache the final scorecard so /report and /report/regression work too."""
    async for event in replay_events(speed=speed):
        if event.get("type") == "campaign_done":
            sc = event.get("scorecard") or {}
            label = sc.get("target_label", "vulnerable")
            _LAST[label] = Scorecard(
                campaign_id=sc.get("campaign_id", "replay"),
                target_label=label,
                rows=list(sc.get("rows", [])),
            )
        yield {"data": json.dumps(event)}


async def _stream_events(target: str, builder: Any, queue: asyncio.Queue) -> Any:
    """Generator: spawn driver, drain queue, cancel on client disconnect."""
    task = asyncio.create_task(_drive_campaign(target, builder, queue))
    try:
        while True:
            event = await queue.get()
            if event is _SENTINEL:
                break
            yield {"data": json.dumps(event)}
    finally:
        if not task.done():
            task.cancel()
            try:
                await task
            except (asyncio.CancelledError, Exception):  # noqa: BLE001
                pass


async def _drive_campaign(target: str, builder: Any, queue: asyncio.Queue) -> None:
    """Run the campaign, push events + sentinel into the queue."""
    async def emit(event: dict[str, Any]) -> None:
        await queue.put(event)

    try:
        scorecard = await run_campaign(builder, emit, target_label=target)
        _LAST[target] = scorecard
    except Exception as exc:
        logger.exception("Campaign driver crashed")
        await queue.put({"type": "error", "where": "driver", "message": str(exc)})
    finally:
        await queue.put(_SENTINEL)


@app.get("/report")
async def last_report(
    target: str = Query("vulnerable", description="vulnerable | patched"),
) -> dict[str, Any]:
    """Return the last full scorecard for a target.

    404 if no campaign has run yet for that target since the server started.
    Persisted JSON files in ``REPORTS_DIR`` are deliberately NOT consulted
    here — this endpoint is the in-memory cache only, so the response is
    always for the most recent run on this process.
    """
    sc = _LAST.get(target)
    if sc is None:
        raise HTTPException(
            status_code=404,
            detail=f"No campaign has completed for target {target!r} yet.",
        )
    return sc.to_dict()


@app.get("/report/regression")
async def regression() -> dict[str, Any]:
    """Diff the last vulnerable run against the last patched run.

    If either run is missing, the corresponding side of the diff defaults
    to all classes ``blocked`` — surfaces the gap rather than 404'ing,
    because the demo workflow runs vulnerable first, then patched, and
    refreshing the regression page between them should still show
    partial data.
    """
    before = _LAST["vulnerable"].class_results() if "vulnerable" in _LAST else {}
    after = _LAST["patched"].class_results() if "patched" in _LAST else {}
    return {
        "diff": regression_diff(before, after),
        "have_vulnerable": "vulnerable" in _LAST,
        "have_patched": "patched" in _LAST,
    }


# --- Startup hook -------------------------------------------------------

@app.on_event("startup")
async def _on_startup() -> None:
    """Surface config warnings in the log on boot.

    We do NOT initialise telemetry here — :func:`run_campaign` does it
    idempotently on first call. Telemetry init touches the network and
    must not block container readiness.
    """
    for warning in config.validate():
        logger.warning("config: %s", warning)


# --- Static frontend ----------------------------------------------------
# When the Next.js console has been exported to static files (the container
# build does this), serve it from the same Cloud Run service so the whole
# project lives behind one URL.
#
# We deliberately do NOT use a greedy ``app.mount("/", StaticFiles(html=True))``:
# that mount issues 307 redirects for directory-style paths, which hijacks API
# routes like ``/healthz`` (redirecting to ``/healthz/`` → 404). Instead we
# mount only the Next.js asset dir at ``/_next`` and add a single catch-all
# that serves a matching static file if one exists, else falls back to
# ``index.html`` (SPA behaviour). The JSON/SSE routes defined above always win
# because they are registered before this catch-all.
def _mount_frontend() -> None:
    from pathlib import Path

    from fastapi.responses import FileResponse, JSONResponse
    from fastapi.staticfiles import StaticFiles

    # Container copies the export to /app/frontend_out; locally it's the
    # sibling frontend/out/ next to the repo root.
    candidates = [
        Path("/app/frontend_out"),
        Path(__file__).resolve().parent.parent / "frontend" / "out",
    ]
    static_dir = next((p for p in candidates if p.is_dir()), None)
    if static_dir is None:
        logger.info("No static frontend export found; serving API only.")
        return

    # Hashed JS/CSS bundles — safe to mount greedily, they never collide with
    # API routes (all live under /_next/...).
    next_assets = static_dir / "_next"
    if next_assets.is_dir():
        app.mount(
            "/_next",
            StaticFiles(directory=str(next_assets)),
            name="next-assets",
        )

    index_html = static_dir / "index.html"

    @app.get("/{full_path:path}", include_in_schema=False)
    async def _spa(full_path: str) -> Any:
        # Try an exact static file first (e.g. favicon.ico, index.txt).
        candidate = (static_dir / full_path).resolve()
        if static_dir.resolve() in candidate.parents and candidate.is_file():
            return FileResponse(candidate)
        # Otherwise serve the SPA shell so client-side routing works.
        if index_html.is_file():
            return FileResponse(index_html)
        return JSONResponse({"detail": "Not Found"}, status_code=404)

    logger.info("Serving static frontend from %s", static_dir)


_mount_frontend()
