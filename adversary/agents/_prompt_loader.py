"""Shared prompt loader.

Centralises reading from ``adversary/prompts/*.md`` so a single cache
serves all four agents and the lookup path is unambiguous regardless of
the current working directory.

The prompts are read once at first call and cached in memory. They are
treated as code-shaped data: changing one requires a redeploy, which is
correct — prompt diffs are the most important thing to review in this
project.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

_PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"


@lru_cache(maxsize=None)
def load_prompt(name: str) -> str:
    """Return the contents of ``adversary/prompts/<name>.md``.

    Args:
        name: Prompt stem (e.g. ``"strategist"``).

    Returns:
        The full prompt text. Trailing newline stripped so multi-prompt
        composition does not accidentally insert blank lines.

    Raises:
        FileNotFoundError: If the prompt does not exist. Surfaced loudly
            because a missing prompt is always a build-time bug, not a
            runtime degradation.
    """
    path = _PROMPTS_DIR / f"{name}.md"
    text = path.read_text(encoding="utf-8")
    return text.rstrip()
