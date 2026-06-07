"""The Reporter — Gemini 2.5 Pro, no tools.

Called once at the end of a campaign with the full scorecard as input.
Writes a Markdown security report that the README and the demo cite.
Per OQ-5, the reporter is wired into :func:`adversary.orchestrator.run_campaign`
— a built-but-uncalled agent would be dead weight a careful judge would
notice in the repo.
"""

from __future__ import annotations

from typing import Any

from adversary.agents._prompt_loader import load_prompt
from adversary.config import MODEL_PRO


def build_reporter() -> Any:
    """Construct a Reporter agent.

    Returns:
        An ADK ``LlmAgent`` configured with Gemini 2.5 Pro. No tools.
    """
    from google.adk.agents import LlmAgent  # type: ignore[import-not-found]

    return LlmAgent(
        name="reporter",
        model=MODEL_PRO,
        instruction=load_prompt("reporter"),
    )
