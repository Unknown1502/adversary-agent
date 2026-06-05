# Root-level Dockerfile.
#
# Cloud Run's ``gcloud run deploy --source .`` looks for a Dockerfile at
# the repo root; without one it falls back to Buildpacks, which would NOT
# install Node — and our Strategist needs ``npx @arizeai/phoenix-mcp``.
# The canonical copy lives at ``deploy/Dockerfile`` (per spec §2 file
# tree). This root file mirrors it so the deploy path stays one-command.
# Keep them in sync.

FROM python:3.12-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        nodejs \
        npm \
        ca-certificates \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Pre-fetch the Phoenix MCP package so the first Strategist call does not
# pay the npm download latency. Failure here is non-fatal.
RUN npx -y @arizeai/phoenix-mcp --version 2>/dev/null || true

COPY adversary ./adversary
COPY target ./target
COPY api ./api
COPY scripts ./scripts
COPY pyproject.toml README.md LICENSE ./

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8080

EXPOSE 8080

CMD ["sh", "-c", "uvicorn api.main:app --host 0.0.0.0 --port ${PORT}"]
