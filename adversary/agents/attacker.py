"""The Attacker — Gemini 2.5 Flash, no tools.

The attacker's only job is to OUTPUT a crafted payload. It must not
have tools because we want it to be a pure text generator the
orchestrator can inspect. Tools would create a side channel that
defeats the auditability goal of the system.

Flash, not Pro: payload crafting is well within Flash's capability and
the cost difference matters at four attempts per class.
"""

from __future__ import annotations

from typing import Any

from adversary.agents._prompt_loader import load_prompt
from adversary.config import MODEL_FLASH


def build_attacker() -> Any:
    """Construct an Attacker agent.

    Returns:
        An ADK ``LlmAgent`` configured with Gemini 2.5 Flash. The agent has
        no tools — payload output IS the work product.
    """
    from google.adk.agents import LlmAgent  # type: ignore[import-not-found]

    return LlmAgent(
        name="attacker",
        model=MODEL_FLASH,
        instruction=load_prompt("attacker"),
    )
