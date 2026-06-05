// Shared event types. Mirrors api/events.py — keep these in lockstep.
// If you change a Python TypedDict, change the matching interface here.

export type Verdict = "blocked" | "partial" | "breach";

export interface EvCampaignStart {
  type: "campaign_start";
  campaign_id: string;
  target: string;
  classes: string[];
}

export interface EvWarning {
  type: "warning";
  message: string;
}

export interface EvClassStart {
  type: "class_start";
  cls: string;
  title: string;
}

export interface EvStrategy {
  type: "strategy";
  cls: string;
  plan: string;
}

export interface EvAttackFired {
  type: "attack_fired";
  cls: string;
  attempt: number;
  technique: string;
  payload: string;
}

export interface EvVerdict {
  type: "verdict";
  cls: string;
  attempt: number;
  verdict: Verdict;
  evidence: string;
  target_output: string;
}

export interface EvBreach {
  type: "breach";
  cls: string;
  attempt: number;
}

export interface EvReplan {
  type: "replan";
  cls: string;
  after_attempt: number;
  plan: string;
}

export interface EvClassDone {
  type: "class_done";
  cls: string;
  verdict: Verdict;
}

export interface EvReportReady {
  type: "report_ready";
  campaign_id: string;
  report_path: string;
}

export interface EvCampaignDone {
  type: "campaign_done";
  scorecard: { campaign_id: string; target_label: string; rows: unknown[]; summary: Record<string, Verdict> };
}

export interface EvError {
  type: "error";
  where: string;
  message: string;
}

export type Ev =
  | EvCampaignStart
  | EvWarning
  | EvClassStart
  | EvStrategy
  | EvAttackFired
  | EvVerdict
  | EvBreach
  | EvReplan
  | EvClassDone
  | EvReportReady
  | EvCampaignDone
  | EvError;

export const VERDICT_COLOR: Record<Verdict, string> = {
  blocked: "#1f7a4d",
  partial: "#b8860b",
  breach: "#b3261e",
};

export const VERDICT_RANK: Record<Verdict, number> = {
  blocked: 0,
  partial: 1,
  breach: 2,
};

export function worse(cur: Verdict | undefined, next: Verdict): Verdict {
  if (cur === undefined) return next;
  return VERDICT_RANK[next] > VERDICT_RANK[cur] ? next : cur;
}
