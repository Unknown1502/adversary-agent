#!/usr/bin/env bash
# Cloud Run one-shot deploy.
#
# Required env vars:
#   GOOGLE_CLOUD_PROJECT          gcloud project id
#   GOOGLE_CLOUD_LOCATION         region (e.g. us-central1)
#   MODEL_PRO                     Gemini Pro model id
#   MODEL_FLASH                   Gemini Flash model id
#   PHOENIX_COLLECTOR_ENDPOINT    Phoenix endpoint (cloud or self-host)
#   PHOENIX_PROJECT_NAME          project name in Phoenix
#
# Required setup (one-time):
#   - Create the phoenix-api-key secret in Secret Manager.
#   - Grant the Cloud Run service account: Vertex AI User, Secret
#     Manager Secret Accessor.
set -euo pipefail

: "${GOOGLE_CLOUD_PROJECT:?must set GOOGLE_CLOUD_PROJECT}"
: "${GOOGLE_CLOUD_LOCATION:?must set GOOGLE_CLOUD_LOCATION}"
: "${MODEL_PRO:?must set MODEL_PRO}"
: "${MODEL_FLASH:?must set MODEL_FLASH}"
: "${PHOENIX_COLLECTOR_ENDPOINT:?must set PHOENIX_COLLECTOR_ENDPOINT}"
: "${PHOENIX_PROJECT_NAME:?must set PHOENIX_PROJECT_NAME}"

SERVICE_NAME="${SERVICE_NAME:-adversary-api}"

echo "Deploying $SERVICE_NAME to Cloud Run in $GOOGLE_CLOUD_LOCATION ..."

gcloud run deploy "$SERVICE_NAME" \
    --source . \
    --region "$GOOGLE_CLOUD_LOCATION" \
    --project "$GOOGLE_CLOUD_PROJECT" \
    --allow-unauthenticated \
    --min-instances 1 \
    --max-instances 3 \
    --cpu 2 \
    --memory 2Gi \
    --concurrency 4 \
    --timeout 900 \
    --port 8080 \
    --set-env-vars "\
GOOGLE_GENAI_USE_VERTEXAI=true,\
GOOGLE_CLOUD_PROJECT=${GOOGLE_CLOUD_PROJECT},\
GOOGLE_CLOUD_LOCATION=${GOOGLE_CLOUD_LOCATION},\
MODEL_PRO=${MODEL_PRO},\
MODEL_FLASH=${MODEL_FLASH},\
PHOENIX_COLLECTOR_ENDPOINT=${PHOENIX_COLLECTOR_ENDPOINT},\
PHOENIX_PROJECT_NAME=${PHOENIX_PROJECT_NAME},\
MAX_ATTEMPTS_PER_CLASS=${MAX_ATTEMPTS_PER_CLASS:-4}" \
    --set-secrets "PHOENIX_API_KEY=phoenix-api-key:latest"

echo
echo "Done. Service URL:"
gcloud run services describe "$SERVICE_NAME" \
    --region "$GOOGLE_CLOUD_LOCATION" \
    --project "$GOOGLE_CLOUD_PROJECT" \
    --format='value(status.url)'
