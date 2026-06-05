# Cloud Run one-shot deploy (PowerShell port of deploy.sh).
#
# Required env vars:
#   GOOGLE_CLOUD_PROJECT          gcloud project id
#   GOOGLE_CLOUD_LOCATION         region (e.g. us-central1)
#   MODEL_PRO                     Gemini Pro model id
#   MODEL_FLASH                   Gemini Flash model id
#   PHOENIX_COLLECTOR_ENDPOINT    Phoenix endpoint
#   PHOENIX_PROJECT_NAME          project name in Phoenix
#
# Required setup (one-time):
#   - Create the phoenix-api-key secret in Secret Manager.
#   - Grant the Cloud Run service account: Vertex AI User, Secret Manager Secret Accessor.

[CmdletBinding()]
param()
$ErrorActionPreference = "Stop"

function Require-Env([string]$Name) {
    $value = [Environment]::GetEnvironmentVariable($Name)
    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "Must set $Name environment variable."
    }
    return $value
}

$Project   = Require-Env "GOOGLE_CLOUD_PROJECT"
$Location  = Require-Env "GOOGLE_CLOUD_LOCATION"
$ModelPro  = Require-Env "MODEL_PRO"
$ModelFlash= Require-Env "MODEL_FLASH"
$PhxEndpt  = Require-Env "PHOENIX_COLLECTOR_ENDPOINT"
$PhxProj   = Require-Env "PHOENIX_PROJECT_NAME"
$MaxAttempts = if ($env:MAX_ATTEMPTS_PER_CLASS) { $env:MAX_ATTEMPTS_PER_CLASS } else { "4" }

$ServiceName = if ($env:SERVICE_NAME) { $env:SERVICE_NAME } else { "adversary-api" }

Write-Host "Deploying $ServiceName to Cloud Run in $Location ..."

# Build the env-var string. gcloud accepts comma-separated KEY=VAL pairs.
$envVars = @(
    "GOOGLE_GENAI_USE_VERTEXAI=true",
    "GOOGLE_CLOUD_PROJECT=$Project",
    "GOOGLE_CLOUD_LOCATION=$Location",
    "MODEL_PRO=$ModelPro",
    "MODEL_FLASH=$ModelFlash",
    "PHOENIX_COLLECTOR_ENDPOINT=$PhxEndpt",
    "PHOENIX_PROJECT_NAME=$PhxProj",
    "MAX_ATTEMPTS_PER_CLASS=$MaxAttempts"
) -join ","

& gcloud run deploy $ServiceName `
    --source . `
    --region $Location `
    --project $Project `
    --allow-unauthenticated `
    --min-instances 1 `
    --max-instances 3 `
    --cpu 2 `
    --memory 2Gi `
    --concurrency 4 `
    --timeout 900 `
    --port 8080 `
    --set-env-vars $envVars `
    --set-secrets "PHOENIX_API_KEY=phoenix-api-key:latest"

if ($LASTEXITCODE -ne 0) { throw "gcloud run deploy failed." }

Write-Host ""
Write-Host "Done. Service URL:"
& gcloud run services describe $ServiceName `
    --region $Location `
    --project $Project `
    --format='value(status.url)'
