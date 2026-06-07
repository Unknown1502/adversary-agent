"""The Strategist — Gemini 2.5 Pro with the Phoenix MCP toolset.

This is the only agent in the system with tools other than its prompt.
It calls Phoenix MCP to introspect its own past traces and adapts the
campaign accordingly. That is the loop the Arize track scores explicitly.
"""

from __future__ import annotations

import logging
from typing import Any

from adversary.agents._prompt_loader import load_prompt
from adversary.config import MODEL_PRO
from adversary.phoenix_mcp import phoenix_mcp_toolset

logger = logging.getLogger(__name__)


def build_strategist() -> Any:
    """Construct a Strategist agent.

    The Phoenix MCP toolset is wired here. If the toolset cannot be built
    (no Node, wrong CLI flags, etc.), we log the error and return an agent
    *without* tools — degraded mode, but the campaign can still proceed
    using the escalation ladder in :data:`AttackClass.techniques`.

    Returns:
        An ADK ``LlmAgent`` configured with Gemini 2.5 Pro.
    """
    from google.adk.agents import LlmAgent  # type: ignore[import-not-found]

    tools: list[Any] = []
    try:
        tools.append(phoenix_mcp_toolset())
    except Exception as exc:
        # Broad: any failure to build the MCP toolset (import error,
        # missing flags, etc.) must NOT take down the campaign. The
        # Strategist falls back to its prompt-only escalation rules.
        logger.error("Phoenix MCP toolset unavailable; strategist running "
                     "without self-introspection. Cause: %s", exc)

    return LlmAgent(
        name="strategist",
        model=MODEL_PRO,
        instruction=load_prompt("strategist"),
        tools=tools,
    )
