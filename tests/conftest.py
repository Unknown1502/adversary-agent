"""Test fixtures and lightweight fakes.

Per OQ-11: tests mock Gemini + Phoenix entirely. The live integration
path lives in ``make demo-run``. The fast deterministic suite exists to
nail down two specific correctness properties:

1. The verdict state machine — that a refund during an attempt forces
   ``breach`` regardless of the LLM judge's prose (OQ-7).
2. The class-rollup rule — that a later ``blocked`` does not overwrite
   an earlier ``breach`` (OQ-6).

A pre-conftest hook monkey-patches :func:`adversary.orchestrator._ask` so
that no ADK Runner or Gemini call is ever made. The Strategist plan and
the Analyst verdict are programmable per-test via the
``scripted_responses`` fixture.
"""

from __future__ import annotations

import json
from typing import Any, Callable

import pytest

# Each test can push (matcher, response) pairs into this list. The matcher
# is a callable taking the prompt text and returning True if this entry
# should be used for the next call; the response is the string the fake
# _ask should return.
_SCRIPT: list[tuple[Callable[[str], bool], str]] = []


async def _fake_ask(runner: Any, session_id: str, user_id: str, text: str) -> str:
    """Stand-in for :func:`adversary.orchestrator._ask`.

    Walks ``_SCRIPT`` for the first matcher that returns True. Falls
    back to a benign blocked-verdict reply so tests that don't script
    the exact path still terminate.
    """
    for i, (matcher, response) in enumerate(_SCRIPT):
        if matcher(text):
            _SCRIPT.pop(i)
            return response
    # Default: pretend we're the Analyst returning "blocked".
    return json.dumps({"verdict": "blocked", "evidence": "default-fallback"})


@pytest.fixture(autouse=True)
def _patch_ask(monkeypatch: pytest.MonkeyPatch) -> None:
    """Replace the orchestrator's LLM call with the scripted fake."""
    import adversary.orchestrator as orch
    monkeypatch.setattr(orch, "_ask", _fake_ask)
    # Also patch phoenix_log to a no-op so tests don't touch the network.
    import adversary.evals.phoenix_log as plog
    monkeypatch.setattr(plog, "log_verdict", lambda *a, **kw: None)


@pytest.fixture
def scripted_responses() -> list[tuple[Callable[[str], bool], str]]:
    """Yield the global script list so a test can stage replies."""
    _SCRIPT.clear()
    yield _SCRIPT
    _SCRIPT.clear()


@pytest.fixture(autouse=True)
def _clean_ledger() -> None:
    """Reset the refund ledger before each test for isolation."""
    from target.tools import reset_ledger
    reset_ledger()
    yield
    reset_ledger()
