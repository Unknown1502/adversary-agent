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

@app.get("/healthz")
async def healthz() -> dict[str, Any]:
    """Cloud Run liveness probe. Returns config warnings for visibility."""
    return {
        "status": "ok",
        "version": "0.1.0",
        "warnings": config.validate(),
    }


_SENTINEL: dict[str, Any] = {"type": "__end__"}


@app.get("/campaign/stream")
async def campaign_stream(
    target: str = Query("vulnerable", description="vulnerable | patched"),
) -> EventSourceResponse:
    """Start a campaign and stream events as SSE."""
    builder = _resolve_builder(target)
    queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
    return EventSourceResponse(_stream_events(target, builder, queue))


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
