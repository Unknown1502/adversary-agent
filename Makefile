# Adversary — top-level developer commands.
# All commands assume Python 3.12+ and Node 20+ are on PATH.

SHELL := /usr/bin/env bash
PYTHON ?= python
PIP    ?= pip
UVICORN_HOST ?= 0.0.0.0
UVICORN_PORT ?= 8080

.PHONY: help install freeze dev smoke seed seed-dry demo-run test fmt clean deploy frontend

help:
	@echo "Targets:"
	@echo "  install     Install Python deps (unpinned)."
	@echo "  freeze      Freeze current env to requirements.lock (run AFTER smoke)."
	@echo "  smoke       Phase-0 smoke: verify telemetry + MCPToolset imports + npx phoenix-mcp --help."
	@echo "  seed        Push the deterministic historical fixtures to Phoenix."
	@echo "  seed-dry    Print the fixtures without writing to Phoenix."
	@echo "  dev         Run the FastAPI backend with auto-reload."
	@echo "  demo-run    Headless campaign against the vulnerable target."
	@echo "  test        Run the pytest suite (mocked, fast)."
	@echo "  frontend    Run the Next.js attack console (in ./frontend)."
	@echo "  deploy      Cloud Run deploy (requires gcloud + envs)."
	@echo "  clean       Remove caches and build artifacts."

install:
	$(PIP) install -r requirements.txt

freeze:
	$(PIP) freeze > requirements.lock
	@echo "Wrote requirements.lock"

smoke:
	$(PYTHON) -c "from google.adk.tools.mcp_tool.mcp_toolset import MCPToolset, StdioServerParameters; print('ADK MCP import OK')"
	$(PYTHON) -c "from adversary.telemetry import init_telemetry; print('telemetry import OK')"
	npx -y @arizeai/phoenix-mcp --help || (echo 'phoenix-mcp not runnable via npx' && exit 1)

seed:
	$(PYTHON) -m scripts.seed_phoenix

seed-dry:
	$(PYTHON) -m scripts.seed_phoenix --dry-run

dev:
	uvicorn api.main:app --reload --host $(UVICORN_HOST) --port $(UVICORN_PORT)

demo-run:
	$(PYTHON) -m scripts.run_campaign --target vulnerable --output reports/demo.json

test:
	pytest -q

frontend:
	cd frontend && npm install && npm run dev

deploy:
	bash deploy/deploy.sh

clean:
	rm -rf __pycache__ .pytest_cache .mypy_cache .ruff_cache build dist *.egg-info
	find . -type d -name "__pycache__" -prune -exec rm -rf {} +
