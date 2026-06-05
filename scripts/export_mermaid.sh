#!/usr/bin/env bash
# Render docs/images/architecture.mmd to architecture.png.
#
# Requires `@mermaid-js/mermaid-cli` on PATH (installed lazily via npx).
# Output is committed to docs/images/architecture.png and referenced from
# README.md and docs/architecture.md.
set -euo pipefail

SRC="docs/images/architecture.mmd"
DST="docs/images/architecture.png"

if [[ ! -f "$SRC" ]]; then
    echo "Source not found: $SRC" >&2
    exit 1
fi

echo "Rendering $SRC → $DST"
npx -y @mermaid-js/mermaid-cli -i "$SRC" -o "$DST" -t dark -b "#0b0d10" -w 1600
echo "Done."
