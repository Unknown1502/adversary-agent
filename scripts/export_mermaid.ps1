# Render docs/images/architecture.mmd to architecture.png (PowerShell port).
#
# Requires @mermaid-js/mermaid-cli on PATH (installed lazily via npx).
[CmdletBinding()]
param()
$ErrorActionPreference = "Stop"

$Src = "docs\images\architecture.mmd"
$Dst = "docs\images\architecture.png"

if (-not (Test-Path $Src)) {
    Write-Error "Source not found: $Src"
    exit 1
}

Write-Host "Rendering $Src -> $Dst"
& npx -y "@mermaid-js/mermaid-cli" -i $Src -o $Dst -t dark -b "#0b0d10" -w 1600
if ($LASTEXITCODE -ne 0) { throw "mermaid-cli failed." }
Write-Host "Done."
