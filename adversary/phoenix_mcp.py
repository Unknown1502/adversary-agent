"""Phoenix MCP toolset wiring.

The Strategist agent uses these tools to read THIS system's own traces,
evaluations, and experiments at runtime — the self-improvement loop that
the Arize track scores explicitly.

Implementation notes:
- The Phoenix MCP server is a Node binary distributed on npm. We do not
  install it; ADK launches it as a subprocess via ``npx -y``.
- The CLI flags ``--baseUrl`` and ``--apiKey`` are taken from the
  spec / Arize examples. If they have shifted (Q15), the subprocess
  fails loudly at first tool invocation rather than silently.
- One module, one adapter. If Phoenix moves to a streamable-HTTP MCP
  transport, only this file changes.
"""

from __future__ import annotations

import logging
from typing import Any

from adversary import config

logger = logging.getLogger(__name__)


def phoenix_mcp_toolset() -> Any:
    """Build an MCPToolset that exposes Phoenix MCP tools to an ADK agent.

    Raises ``ImportError`` if ADK's MCP support is not at the expected
    import path (Phase-0 smoke catches this — see OQ-1).
    """
    # Local import: keep module import lightweight for envs without ADK.
    from google.adk.tools.mcp_tool.mcp_toolset import (  # type: ignore[import-not-found]
        MCPToolset,
        StdioServerParameters,
    )

    if not config.PHOENIX_API_KEY:
        logger.warning(
            "PHOENIX_API_KEY is empty; Strategist may receive an "
            "authentication error from phoenix-mcp on first tool call."
        )

    args = _phoenix_mcp_args()
    logger.info("Launching Phoenix MCP via npx (baseUrl=%s, key_set=%s)",
                config.PHOENIX_ENDPOINT, bool(config.PHOENIX_API_KEY))
    return MCPToolset(
        connection_params=StdioServerParameters(command="npx", args=args),
    )


def _phoenix_mcp_args() -> list[str]:
    """CLI flags for ``npx @arizeai/phoenix-mcp`` (verify per OQ-15)."""
    return [
        "-y",
        "@arizeai/phoenix-mcp",
        "--baseUrl",
        config.PHOENIX_ENDPOINT,
        "--apiKey",
        config.PHOENIX_API_KEY,
    ]
