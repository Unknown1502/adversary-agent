"""Deterministic demo replay.

The hosted app must never show a judge a live-quota error. Vertex AI on a
new/unverified project is rate-limited, so a live campaign triggered from the
public URL can 429 mid-run. To guarantee a flawless first impression, we ship
a captured event stream from a real campaign (`api/demo_replay.json`, recorded
via `run_campaign --capture-events`) and replay it over SSE with lifelike
pacing.

This is NOT fabricated data: it is the verbatim event stream of a real live
campaign (`reports/demo_vuln.json` is its scorecard). Replay just removes the
dependency on live quota at view time. Live mode (`?replay=false`) still runs a
real campaign for anyone who wants to watch it happen.
"""

from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path
from typing import Any, AsyncIterator

logger = logging.getLogger(__name__)

# Path to the captured stream, resolved relative to this file so it works the
# same in the container and in local dev.
_REPLAY_PATH = Path(__file__).with_name("demo_replay.json")

# Per-event-type pacing (seconds) so the replay feels like a live run rather
# than a data dump. Tuned to read naturally on screen during a demo.
_PACING: dict[str, float] = {
    "campaign_start": 0.4,
    "class_start": 0.6,
    "strategy": 1.1,
    "attack_fired": 0.9,
    "verdict": 1.0,
    "breach": 0.5,
    "replan": 1.0,
    "class_done": 0.5,
    "report_ready": 0.4,
    "campaign_done": 0.2,
    "warning": 0.2,
    "error": 0.3,
}
_DEFAULT_PACING = 0.6


def replay_available() -> bool:
    """True if a captured demo stream exists to replay."""
    return _REPLAY_PATH.is_file()


def _load_events() -> list[dict[str, Any]]:
    """Read the captured event list. Returns [] if absent/corrupt."""
    try:
        data = json.loads(_REPLAY_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        logger.error("replay: could not load %s: %s", _REPLAY_PATH, exc)
        return []
    return data if isinstance(data, list) else []


async def replay_events(speed: float = 1.0) -> AsyncIterator[dict[str, Any]]:
    """Yield the captured events in order, paced to feel live.

    Args:
        speed: Multiplier on the delays. ``>1`` is faster, ``<1`` slower.
            Clamped to a sane range so a query param cannot stall the server.
    """
    speed = max(0.1, min(speed, 10.0))
    events = _load_events()
    if not events:
        yield {"type": "error", "where": "replay",
               "message": "No captured demo stream available."}
        return

    for event in events:
        delay = _PACING.get(event.get("type", ""), _DEFAULT_PACING) / speed
        await asyncio.sleep(delay)
        yield event
