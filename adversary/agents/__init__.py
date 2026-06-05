"""The four sub-agents: Strategist, Attacker, Analyst, Reporter.

Each module exposes a single ``build_<name>()`` factory returning an
ADK ``LlmAgent``. Factories — not module-level singletons — because each
campaign builds fresh runners and ADK agents are not always thread-safe
to share across sessions.
"""

from adversary.agents.analyst import build_analyst
from adversary.agents.attacker import build_attacker
from adversary.agents.reporter import build_reporter
from adversary.agents.strategist import build_strategist

__all__ = ["build_strategist", "build_attacker", "build_analyst", "build_reporter"]
