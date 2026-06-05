"""Phoenix + OpenInference registration.

This file is the **single highest-risk integration** in the project
(spec §4 Phase 0: "Do not build features until tracing + Phoenix MCP work").
Every other module assumes :func:`init_telemetry` ran first and that ADK +
GenAI calls are auto-traced into Phoenix.

The registration is idempotent: calling it twice in the same process is a
no-op rather than re-registering instrumentors (which would double-emit
spans).
"""

from __future__ import annotations

import logging
import os
from typing import Any

from adversary import config

logger = logging.getLogger(__name__)

# Module-level singleton. Holds whatever ``phoenix.otel.register`` returns
# (a TracerProvider in current versions). ``Any`` because the concrete
# return type has shifted across Phoenix releases and we do not want a
# tight type pin here.
_TRACER_PROVIDER: Any | None = None


def init_telemetry(project_name: str | None = None) -> Any:
    """Register Phoenix + auto-instrument ADK/GenAI. Idempotent.

    Returns the tracer provider, or ``None`` if dependencies are missing
    or registration failed (campaign continues in degraded no-tracing mode).
    """
    global _TRACER_PROVIDER
    if _TRACER_PROVIDER is not None:
        return _TRACER_PROVIDER

    _set_phoenix_auth_env()
    register = _import_phoenix_register()
    if register is None:
        return None

    project = project_name or config.PHOENIX_PROJECT
    try:
        _TRACER_PROVIDER = register(
            project_name=project,
            endpoint=config.PHOENIX_ENDPOINT,
            auto_instrument=False,
        )
        logger.info("Phoenix telemetry registered (project=%s endpoint=%s)",
                    project, config.PHOENIX_ENDPOINT)
    except Exception as exc:  # broad: registration failure must not crash
        logger.error("Phoenix register() failed: %s. Tracing disabled.", exc)
        return None

    _install_instrumentors(_TRACER_PROVIDER)
    return _TRACER_PROVIDER


def _set_phoenix_auth_env() -> None:
    """Set both common API-key env var variants Phoenix versions look for."""
    if config.PHOENIX_API_KEY:
        os.environ.setdefault("PHOENIX_CLIENT_HEADERS", f"api_key={config.PHOENIX_API_KEY}")
        os.environ.setdefault("PHOENIX_API_KEY", config.PHOENIX_API_KEY)


def _import_phoenix_register() -> Any:
    """Import ``phoenix.otel.register`` or return ``None`` if unavailable."""
    try:
        from phoenix.otel import register  # type: ignore[import-not-found]
        return register
    except ImportError as exc:
        logger.error("phoenix.otel not importable (%s). Tracing disabled.", exc)
        return None


def _install_instrumentors(tracer_provider: Any) -> None:
    """Install ADK + GenAI auto-instrumentation.

    Split out so a failure in one instrumentor (e.g. wrong version) does
    not silently take down the other. Each is best-effort; we surface the
    failure but continue.
    """
    try:
        from openinference.instrumentation.google_adk import (  # type: ignore[import-not-found]
            GoogleADKInstrumentor,
        )
        GoogleADKInstrumentor().instrument(tracer_provider=tracer_provider)
        logger.debug("GoogleADKInstrumentor active.")
    except Exception as exc:
        logger.warning("ADK instrumentor unavailable: %s", exc)

    try:
        from openinference.instrumentation.google_genai import (  # type: ignore[import-not-found]
            GoogleGenAIInstrumentor,
        )
        GoogleGenAIInstrumentor().instrument(tracer_provider=tracer_provider)
        logger.debug("GoogleGenAIInstrumentor active.")
    except Exception as exc:
        logger.warning("GenAI instrumentor unavailable: %s", exc)


def shutdown() -> None:
    """Flush + close the tracer provider. Optional; used in CLI scripts."""
    global _TRACER_PROVIDER
    if _TRACER_PROVIDER is None:
        return
    try:
        # ``force_flush`` and ``shutdown`` are present on the OTel
        # TracerProvider that Phoenix returns; missing on some test doubles.
        force_flush = getattr(_TRACER_PROVIDER, "force_flush", None)
        if callable(force_flush):
            force_flush()
        close = getattr(_TRACER_PROVIDER, "shutdown", None)
        if callable(close):
            close()
    finally:
        _TRACER_PROVIDER = None
