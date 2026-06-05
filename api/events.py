"""SSE event schema.

A typed union of every event the orchestrator may emit. The frontend
relies on ``type`` as the discriminator. Keeping the schema in one file
lets the frontend's TypeScript types stay in lockstep (the frontend
duplicates the shape rather than depending on a Python file).

These TypedDicts are NOT enforced at the emit site — the orchestrator
emits ``dict[str, Any]`` for terseness — but they ARE the contract. A
change here mandates a change in :file:`frontend/app/page.tsx`.
"""

from __future__ import annotations

from typing import Literal, TypedDict, Union

from adversary.attacks.base import Verdict


class EvCampaignStart(TypedDict):
    type: Literal["campaign_start"]
    campaign_id: str
    target: str
    classes: list[str]


class EvWarning(TypedDict):
    type: Literal["warning"]
    message: str


class EvClassStart(TypedDict):
    type: Literal["class_start"]
    cls: str
    title: str


class EvStrategy(TypedDict):
    type: Literal["strategy"]
    cls: str
    plan: str


class EvAttackFired(TypedDict):
    type: Literal["attack_fired"]
    cls: str
    attempt: int
    technique: str
    payload: str


class EvVerdict(TypedDict):
    type: Literal["verdict"]
    cls: str
    attempt: int
    verdict: Verdict
    evidence: str
    target_output: str


class EvBreach(TypedDict):
    type: Literal["breach"]
    cls: str
    attempt: int


class EvReplan(TypedDict):
    type: Literal["replan"]
    cls: str
    after_attempt: int
    plan: str


class EvClassDone(TypedDict):
    type: Literal["class_done"]
    cls: str
    verdict: Verdict


class EvReportReady(TypedDict):
    type: Literal["report_ready"]
    campaign_id: str
    report_path: str


class EvCampaignDone(TypedDict):
    type: Literal["campaign_done"]
    scorecard: dict


class EvError(TypedDict):
    type: Literal["error"]
    where: str
    message: str


Event = Union[
    EvCampaignStart,
    EvWarning,
    EvClassStart,
    EvStrategy,
    EvAttackFired,
    EvVerdict,
    EvBreach,
    EvReplan,
    EvClassDone,
    EvReportReady,
    EvCampaignDone,
    EvError,
]
