# PowerShell-native task runner. Mirrors the Makefile targets so Windows
# users without WSL / make can run every workflow.
#
# Usage:
#   .\make.ps1 <target>
#
# Targets: help, install, freeze, smoke, seed, seed-dry, dev, demo-run,
#          test, frontend, deploy, clean
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$Target = "help"
)

$ErrorActionPreference = "Stop"
$ScriptRoot = $PSScriptRoot

# Pick the same interpreter the user invoked us with, or fall back to "python".
$Python = if ($env:PYTHON) { $env:PYTHON } else { "python" }
$Pip    = if ($env:PIP)    { $env:PIP }    else { "pip" }
$UvicornHost = if ($env:UVICORN_HOST) { $env:UVICORN_HOST } else { "0.0.0.0" }
$UvicornPort = if ($env:UVICORN_PORT) { $env:UVICORN_PORT } else { "8080" }

function Show-Help {
    Write-Host @"
Adversary — PowerShell task runner. Usage: .\make.ps1 <target>

Targets:
  install     Install Python deps (unpinned).
  freeze      Freeze current env to requirements.lock (run AFTER smoke).
  smoke       Phase-0 smoke: verify telemetry + MCPToolset imports + npx phoenix-mcp.
  seed        Push the deterministic historical fixtures to Phoenix.
  seed-dry    Print the fixtures without writing to Phoenix.
  dev         Run the FastAPI backend with auto-reload.
  demo-run    Headless campaign against the vulnerable target.
  test        Run the pytest suite (mocked, fast).
  frontend    Run the Next.js attack console (in .\frontend).
  deploy      Cloud Run deploy (requires gcloud + envs).
  clean       Remove caches and build artifacts.
"@
}

function Invoke-Install { & $Pip install -r requirements.txt }

function Invoke-Freeze {
    & $Pip freeze | Out-File -FilePath "requirements.lock" -Encoding utf8
    Write-Host "Wrote requirements.lock"
}

function Invoke-Smoke {
    Write-Host "[1/3] Verifying ADK MCP import path..."
    & $Python -c "from google.adk.tools.mcp_tool.mcp_toolset import MCPToolset, StdioServerParameters; print('ADK MCP import OK')"
    if ($LASTEXITCODE -ne 0) { throw "ADK MCP import failed" }

    Write-Host "[2/3] Verifying telemetry import..."
    & $Python -c "from adversary.telemetry import init_telemetry; print('telemetry import OK')"
    if ($LASTEXITCODE -ne 0) { throw "telemetry import failed" }

    Write-Host "[3/3] Verifying npx @arizeai/phoenix-mcp is runnable..."
    & npx -y "@arizeai/phoenix-mcp" --help | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "phoenix-mcp not runnable via npx" }

    Write-Host "Smoke OK."
}

function Invoke-Seed    { & $Python -m scripts.seed_phoenix }
function Invoke-SeedDry { & $Python -m scripts.seed_phoenix --dry-run }

function Invoke-Dev {
    & uvicorn api.main:app --reload --host $UvicornHost --port $UvicornPort
}

function Invoke-DemoRun {
    if (-not (Test-Path "reports")) { New-Item -ItemType Directory -Path "reports" | Out-Null }
    & $Python -m scripts.run_campaign --target vulnerable --output reports\demo.json
}

function Invoke-Test { & pytest -q }

function Invoke-Frontend {
    Push-Location frontend
    try {
        & npm install
        if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
        & npm run dev
    } finally {
        Pop-Location
    }
}

function Invoke-Deploy {
    & "$ScriptRoot\deploy\deploy.ps1"
}

function Invoke-Clean {
    $patterns = @("__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache",
                  "build", "dist", "*.egg-info")
    foreach ($pat in $patterns) {
        Get-ChildItem -Path $ScriptRoot -Filter $pat -Recurse -Force -ErrorAction SilentlyContinue |
            Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    }
    Write-Host "Cleaned caches and build artifacts."
}

switch ($Target.ToLower()) {
    "help"      { Show-Help }
    "install"   { Invoke-Install }
    "freeze"    { Invoke-Freeze }
    "smoke"     { Invoke-Smoke }
    "seed"      { Invoke-Seed }
    "seed-dry"  { Invoke-SeedDry }
    "dev"       { Invoke-Dev }
    "demo-run"  { Invoke-DemoRun }
    "test"      { Invoke-Test }
    "frontend"  { Invoke-Frontend }
    "deploy"    { Invoke-Deploy }
    "clean"     { Invoke-Clean }
    default     {
        Write-Host "Unknown target: $Target" -ForegroundColor Red
        Show-Help
        exit 1
    }
}
