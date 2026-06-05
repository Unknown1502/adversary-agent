"""Thin wrapper for logging verdicts back to Phoenix.

Per OQ-4: the call site is stable; the implementation is deferred until
the installed ``arize-phoenix`` version is confirmed. Span annotations are
the more likely correct API for per-attempt verdicts (experiments suit
batch eval runs), but we do not assert that from memory.

The current implementation:
* Tries the span-annotation path first (newer Phoenix SDKs).
* Falls back to the legacy ``log_evaluations`` API if available.
* On any failure, logs a WARNING and returns — never raises into the
  orchestrator, because losing a verdict log must not abort a campaign.

When the installed API is verified, replace the body of
:func:`log_verdict` with the confirmed call; the signature does not move.
"""

from __future__ import annotations

import logging
from typing import Any, Literal

logger = logging.getLogger(__name__)

Verdict = Literal["blocked", "partial", "breach"]


def log_verdict(
    span_id: str | None,
    verdict: Verdict,
    evidence: str,
    *,
    attack_class: str | None = None,
    technique: str | None = None,
    project_name: str | None = None,
) -> None:
    """Best-effort log of one attempt's verdict into Phoenix. Never raises."""
    from adversary import config

    payload: dict[str, Any] = {
        "verdict": verdict,
        "evidence": evidence,
        "attack_class": attack_class,
        "technique": technique,
        "project": project_name or config.PHOENIX_PROJECT,
        "span_id": span_id,
    }
    if _try_span_annotation(payload):
        return
    if _try_legacy_log_evaluations(payload):
        return
    logger.warning(
        "phoenix_log: no compatible API found; verdict recorded only in "
        "local scorecard (%s)", payload,
    )


def _try_span_annotation(payload: dict[str, Any]) -> bool:
    """Attempt the modern ``phoenix.client`` span-annotation path."""
    try:
        from phoenix.client import Client  # type: ignore[import-not-found]
    except ImportError:
        return False

    span_id = payload["span_id"]
    if not span_id:
        return False
    try:
        annotate = _resolve_annotate(Client())
        if annotate is None:
            return False
        annotate(
            span_id=span_id,
            name="adversary.verdict",
            label=payload["verdict"],
            explanation=payload["evidence"],
            metadata={
                "attack_class": payload["attack_class"],
                "technique": payload["technique"],
            },
        )
        return True
    except Exception as exc:
        logger.debug("phoenix_log: span-annotation path failed: %s", exc)
        return False


def _resolve_annotate(client: Any) -> Any:
    """Return whichever annotation entry point this Phoenix release exposes."""
    return (
        getattr(getattr(client, "annotations", None), "add_span_annotation", None)
        or getattr(client, "add_span_annotation", None)
    )


def _try_legacy_log_evaluations(payload: dict[str, Any]) -> bool:
    """Attempt the legacy ``log_evaluations`` API. Best-effort, never raises."""
    try:
        import phoenix as px  # type: ignore[import-not-found]
    except ImportError:
        return False

    log_evals = getattr(px, "log_evaluations", None)
    if log_evals is None:
        return False

    try:
        log_evals(  # type: ignore[misc]
            {
                "name": "adversary.verdict",
                "result": {
                    "label": payload["verdict"],
                    "explanation": payload["evidence"],
                },
                "metadata": {
                    "attack_class": payload["attack_class"],
                    "technique": payload["technique"],
                    "span_id": payload["span_id"],
                },
            }
        )
        logger.debug("phoenix_log: legacy log_evaluations succeeded")
        return True
    except Exception as exc:
        logger.debug("phoenix_log: legacy log_evaluations failed: %s", exc)
        return False
