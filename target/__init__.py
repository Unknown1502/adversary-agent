"""The deliberately-vulnerable demo target.

Two builds live here:

* :mod:`target.support_agent` — the **vulnerable** FriendlyShop support
  agent. Its instruction trusts content it is asked to summarise. This
  is the build the Adversary attacks for the on-camera breach.
* :mod:`target.patched_agent` — the same agent with hardened
  instructions. The regression-diff demo runs the Adversary against
  this build and shows previously-breached classes are now blocked.

Both share :mod:`target.tools` (lookup_order, issue_refund, summarize_email)
and :mod:`target.seed_data` (a small fixture catalogue of orders).

This package is intentionally separable from :mod:`adversary` so the
orchestrator can be pointed at any ADK target by passing a builder
function — the package boundary IS the public contract.
"""
