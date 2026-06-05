"""Scorecard data model + regression diff.

A scorecard is the campaign's permanent record: every attempt, its
technique, the verdict, the evidence. The class-level summary collapses
attempts down to the **worst** verdict observed for each class — a class
that breached once is breached, period. The regression diff compares two
class-summary dicts (vulnerable vs. patched) and tags each class as
fixed / still-breaching / unchanged.

Per OQ-6 fix: ``class_results`` uses ``>`` (not ``>=``) on the verdict
rank and seeds ``cur`` with ``"blocked"``. This corrects a bug in the
spec draft that would let a late ``blocked`` overwrite an earlier
``breach`` — a silent breach in a security tool, the worst kind.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import TypedDict

from adversary.attacks.base import VERDICT_RANK, Verdict


class VerdictRow(TypedDict):
    """One row in a scorecard — a single attempt."""

    cls: str
    attempt: int
    technique: str
    verdict: Verdict
    evidence: str
    timestamp: str


@dataclass
class Scorecard:
    """Per-campaign scorecard.

    Attributes:
        campaign_id: Short id printed in the UI and in report filenames.
        target_label: ``"vulnerable"`` or ``"patched"`` — the regression
            diff endpoint pairs these by label.
        rows: Append-only log of attempts.
    """

    campaign_id: str
    target_label: str
    rows: list[VerdictRow] = field(default_factory=list)

    def record(
        self,
        cls: str,
        attempt: int,
        technique: str,
        verdict: Verdict,
        evidence: str,
    ) -> None:
        """Append one attempt to the scorecard."""
        self.rows.append(
            VerdictRow(
                cls=cls,
                attempt=attempt,
                technique=technique,
                verdict=verdict,
                evidence=evidence,
                timestamp=datetime.now(timezone.utc).isoformat(timespec="seconds"),
            )
        )

    def class_results(self) -> dict[str, Verdict]:
        """Collapse attempts to ``{class_key: worst_verdict}``.

        OQ-6: use strict ``>`` and seed ``cur="blocked"`` so that the
        worst outcome wins. The earlier ``>=`` formulation in the spec
        draft would let a later ``blocked`` overwrite a breach.
        """
        out: dict[str, Verdict] = {}
        for row in self.rows:
            cur: Verdict = out.get(row["cls"], "blocked")
            new: Verdict = row["verdict"]
            if VERDICT_RANK[new] > VERDICT_RANK[cur]:
                out[row["cls"]] = new
            elif row["cls"] not in out:
                # First time we see this class; record its current verdict
                # (even if not "worse" than the implicit blocked default).
                out[row["cls"]] = new
        return out

    def to_dict(self) -> dict[str, object]:
        """Serialise to a JSON-safe dict."""
        return {
            "campaign_id": self.campaign_id,
            "target_label": self.target_label,
            "rows": list(self.rows),
            "summary": self.class_results(),
        }

    def write_json(self, directory: Path) -> Path:
        """Write ``<directory>/<campaign_id>.json`` and return the path."""
        directory.mkdir(parents=True, exist_ok=True)
        path = directory / f"{self.campaign_id}.json"
        path.write_text(json.dumps(self.to_dict(), indent=2), encoding="utf-8")
        return path


def regression_diff(
    before: dict[str, Verdict],
    after: dict[str, Verdict],
) -> dict[str, dict[str, object]]:
    """Compare two ``class_results()`` dicts.

    Args:
        before: Class summary from the vulnerable run.
        after: Class summary from the patched run.

    Returns:
        ``{class_key: {"before": v, "after": v, "fixed": bool}}``. A class
        is ``fixed`` iff it breached before and does not breach now.
    """
    diff: dict[str, dict[str, object]] = {}
    for cls in set(before) | set(after):
        b = before.get(cls, "blocked")
        a = after.get(cls, "blocked")
        diff[cls] = {
            "before": b,
            "after": a,
            "fixed": b == "breach" and a != "breach",
            "regressed": b != "breach" and a == "breach",
        }
    return diff
