"""Headless campaign runner.

Used for the deterministic fallback recording and for sanity-checking the
loop without bringing up the FastAPI server. Writes the scorecard JSON to
``--output`` (default ``reports/<campaign_id>.json``) and prints a
condensed summary to stdout.

Usage:
    python -m scripts.run_campaign --target vulnerable --output reports/demo.json
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys
from pathlib import Path
from typing import Any, Callable

from adversary.orchestrator import run_campaign
from adversary.scorecard import Scorecard
from adversary.telemetry import shutdown as telemetry_shutdown
from target.patched_agent import build_patched_agent
from target.support_agent import build_target_agent

logger = logging.getLogger("scripts.run_campaign")


_TARGET_BUILDERS: dict[str, Callable[[], Any]] = {
    "vulnerable": build_target_agent,
    "patched": build_patched_agent,
}


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run an Adversary campaign headless.")
    parser.add_argument(
        "--target",
        choices=list(_TARGET_BUILDERS),
        default="vulnerable",
        help="Which target build to attack.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Optional override for the scorecard JSON path. "
             "If unset, the scorecard is written to REPORTS_DIR/<campaign_id>.json.",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress per-event stdout traces.",
    )
    parser.add_argument(
        "--capture-events",
        type=Path,
        default=None,
        help="If set, record the full ordered SSE event stream to this JSON "
             "file. Used to build the deterministic demo replay the hosted "
             "app serves so judges never see a live-quota error.",
    )
    return parser.parse_args(argv)


async def _run(args: argparse.Namespace) -> Scorecard:
    """Drive the campaign, printing events as they happen."""
    builder = _TARGET_BUILDERS[args.target]
    captured: list[dict[str, Any]] = []

    async def emit(event: dict[str, Any]) -> None:
        if args.capture_events is not None:
            # Store a JSON-safe copy in arrival order — this is the exact
            # sequence the replay endpoint will re-emit.
            captured.append(json.loads(json.dumps(event, default=str)))
        if args.quiet:
            return
        # One line per event so the CLI output is greppable.
        kind = event.get("type", "?")
        rest = {k: v for k, v in event.items() if k != "type"}
        line = json.dumps({"event": kind, **rest}, default=str)
        # Trim very long lines so the terminal stays usable.
        if len(line) > 400:
            line = line[:400] + "…"
        print(line, flush=True)

    try:
        return await run_campaign(builder, emit, target_label=args.target)
    finally:
        if args.capture_events is not None:
            args.capture_events.parent.mkdir(parents=True, exist_ok=True)
            args.capture_events.write_text(
                json.dumps(captured, indent=2), encoding="utf-8"
            )
            logger.info("Captured %d events to %s", len(captured), args.capture_events)


def _persist_override(scorecard: Scorecard, output: Path) -> None:
    """Copy the scorecard JSON to a user-specified path."""
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(scorecard.to_dict(), indent=2), encoding="utf-8")
    logger.info("Scorecard mirrored to %s", output)


def main(argv: list[str] | None = None) -> int:
    """CLI entry. Returns a process exit code (0 success, 1 failure)."""
    args = _parse_args(argv if argv is not None else sys.argv[1:])
    try:
        scorecard = asyncio.run(_run(args))
    except KeyboardInterrupt:
        logger.warning("Interrupted.")
        return 130
    except Exception as exc:
        logger.exception("Campaign failed: %s", exc)
        return 1
    finally:
        telemetry_shutdown()

    if args.output is not None:
        _persist_override(scorecard, args.output)

    print()
    print("=== Summary ===")
    print(json.dumps(scorecard.class_results(), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
