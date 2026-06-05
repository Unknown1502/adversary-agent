"""Adversary — a self-improving AI red-team agent.

This package is the orchestrator. It does NOT define the target it attacks
(that lives in the sibling :mod:`target` package), nor the HTTP surface
(that lives in :mod:`api`). The boundary is deliberate: the orchestrator is
reusable against any ADK-built target, and the HTTP layer is a thin shell.
"""

__version__ = "0.1.0"
