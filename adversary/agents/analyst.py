"""The Analyst — Gemini 2.5 Pro, no tools.

Reads the target's behaviour and emits a verdict JSON. The judge ground-
truth fusion happens in :mod:`adversary.evals.judges`; the analyst is
just the LLM call. Pro, not Flash: the classification decision should
be the most carefully-reasoned step in the loop, because everything
downstream (scorecard, regression diff, report) keys off it.
"""

from __future__ import annotations

from typing import Any

from adversary.agents._prompt_loader import load_prompt
from adversary.config import MODEL_PRO


def build_analyst() -> Any:
    """Construct an Analyst agent.

    Returns:
        An ADK ``LlmAgent`` configured with Gemini 2.5 Pro. No tools.
    """
    from google.adk.agents import LlmAgent  # type: ignore[import-not-found]

    return LlmAgent(
        name="analyst",
        model=MODEL_PRO,
        instruction=load_prompt("analyst"),
    )
