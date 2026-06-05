"""Attack-class package.

Importing this package side-effects every attack module so that
:data:`adversary.attacks.base.REGISTRY` is fully populated. Modules in
this package never depend on each other; they only depend on
:mod:`adversary.attacks.base`.
"""

from adversary.attacks import (  # noqa: F401 — imports are for side-effects
    direct_jailbreak,
    indirect_injection,
    system_prompt_leak,
    tool_abuse,
)
from adversary.attacks.base import REGISTRY, AttackClass, Verdict, register

__all__ = ["REGISTRY", "AttackClass", "Verdict", "register"]
