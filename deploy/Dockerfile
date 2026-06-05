# Adversary backend image (FastAPI + ADK + Phoenix MCP via npx).
#
# Node is installed in the image because the Phoenix MCP server runs via
# `npx -y @arizeai/phoenix-mcp` as a subprocess launched by ADK's
# StdioServerParameters. Without Node on PATH, the Strategist's
# self-introspection tool calls would never succeed.

FROM python:3.12-slim

# --- System deps ---------------------------------------------------------
# `nodejs` is needed for the Phoenix MCP subprocess. `ca-certificates` is
# required for HTTPS to Vertex AI and Phoenix Cloud. `curl` is handy for
# debugging from inside the container and is small.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        nodejs \
        npm \
        ca-certificates \
        curl \
    && rm -rf /var/lib/apt/lists/*

# --- Python deps ---------------------------------------------------------
WORKDIR /app

# Install Python dependencies first (better Docker layer caching) than copying source.
COPY requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Pre-fetch the Phoenix MCP package so the first Strategist call doesn't
# pay the npm download latency. Failure here is non-fatal (the image can
# still build and start; the package will fetch at runtime instead).
RUN npx -y @arizeai/phoenix-mcp --version 2>/dev/null || true

# --- Application source --------------------------------------------------
COPY adversary ./adversary
COPY target ./target
COPY api ./api
COPY scripts ./scripts
COPY pyproject.toml README.md LICENSE ./

# --- Runtime config ------------------------------------------------------
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8080

EXPOSE 8080

# uvicorn binds the port Cloud Run injects.
CMD ["sh", "-c", "uvicorn api.main:app --host 0.0.0.0 --port ${PORT}"]
