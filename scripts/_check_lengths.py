"""Internal dev tool: report functions over 40 lines.

Used during the self-review gate. Not part of the runtime surface.
"""

from __future__ import annotations

import ast
import pathlib
import sys

MAX_LINES = 40


def main() -> int:
    """Print every function over MAX_LINES; return 0 if clean, 1 otherwise."""
    violations: list[tuple[str, str, int]] = []
    for p in pathlib.Path(".").rglob("*.py"):
        parts = p.parts
        if "node_modules" in parts or "tests" in parts:
            continue
        try:
            tree = ast.parse(p.read_text(encoding="utf-8"))
        except SyntaxError as exc:
            print(f"SYNTAX ERROR in {p}: {exc}")
            return 2
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                length = (node.end_lineno or node.lineno) - node.lineno + 1
                if length > MAX_LINES:
                    violations.append((str(p), node.name, length))
    for path, name, length in violations:
        print(f"{path}:{name} = {length} lines")
    print(f"{len(violations)} function(s) over {MAX_LINES} lines.")
    return 1 if violations else 0


if __name__ == "__main__":
    sys.exit(main())
