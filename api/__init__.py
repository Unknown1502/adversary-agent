"""HTTP layer.

Thin shell over :mod:`adversary.orchestrator`. Three endpoints:

* ``GET /campaign/stream?target={vulnerable|patched}`` — SSE stream of campaign events.
* ``GET /report`` — last full scorecard as JSON.
* ``GET /report/regression`` — diff of last vulnerable vs. last patched runs.
"""
