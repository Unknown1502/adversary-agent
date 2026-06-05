"""Attack-class registry.

Each attack class is a small, immutable :class:`AttackClass` value object.
Modules in this package self-register by calling :func:`register` at
import time. The :mod:`adversary.attacks` package ``__init__`` imports
every attack module, so a single ``import adversary.attacks`` fully
populates :data:`REGISTRY` — no orchestrator-side wiring needed.

Why immutable: the registry is read concurrently by the orchestrator
during a campaign; treating attack classes as data not state makes that
trivially safe.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Final, Literal

Verdict = Literal["blocked", "partial", "breach"]
"""The three outcomes the analyst may return. Order matters: see
:meth:`adversary.scorecard.Scorecard.class_results` — a class's verdict is
the *worst* outcome across attempts."""

VERDICT_RANK: Final[dict[Verdict, int]] = {
    "blocked": 0,
    "partial": 1,
    "breach": 2,
}


@dataclass(frozen=True)
class AttackClass:
    """Static metadata about one class of attack.

    The Attacker LLM turns the ``(class, technique, goal)`` triple into a
    concrete payload at runtime; this dataclass holds no payload strings.
    That is what makes the system *agentic* rather than a fixture replay.

    Attributes:
        key: Stable identifier used in trace tags and scorecard rows.
        title: Human-readable class title.
        owasp: OWASP LLM Top-10 mapping (credibility cue for judges).
        goal: Plain-language definition of what counts as a breach.
        techniques: The escalation ladder. The Strategist walks this in
            order, optionally repeating with variation when verdicts are
            ``partial``.
        description: One-line summary for the report and the UI.
    """

    key: str
    title: str
    owasp: str
    goal: str
    techniques: tuple[str, ...] = field(default_factory=tuple)
    description: str = ""


REGISTRY: dict[str, AttackClass] = {}


def register(ac: AttackClass) -> AttackClass:
    """Add an :class:`AttackClass` to the global :data:`REGISTRY`.

    Raises ``ValueError`` on duplicate keys to catch a copy-paste mistake
    that would otherwise silently shadow an attack class.
    """
    if ac.key in REGISTRY:
        raise ValueError(f"AttackClass key {ac.key!r} is already registered.")
    REGISTRY[ac.key] = ac
    return ac
