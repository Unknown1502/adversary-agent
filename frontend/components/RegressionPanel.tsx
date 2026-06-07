"use client";

import { useEffect, useState } from "react";
import type { Verdict } from "../app/types";

interface RegressionRow {
  before: Verdict;
  after: Verdict;
  fixed: boolean;
  regressed: boolean;
}

interface RegressionResponse {
  diff: Record<string, RegressionRow>;
  have_vulnerable: boolean;
  have_patched: boolean;
}

interface Props {
  refreshKey: number;
  apiBase: string;
}

function pretty(cls: string) {
  return cls.replace(/_/g, " ");
}

export default function RegressionPanel({ refreshKey, apiBase }: Props) {
  const [data, setData] = useState<RegressionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (refreshKey === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/report/regression`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as RegressionResponse;
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey, apiBase]);

  if (refreshKey === 0 || data === null) {
    return (
      <section className="panel rg">
        <div className="panel__head">
          <span className="panel__dot" style={{ background: "var(--violet)", boxShadow: "0 0 10px var(--violet)" }} />
          <span className="panel__title">Regression Diff</span>
        </div>
        <div className="panel__body">
          <p className="empty">run both targets to compare</p>
        </div>
        <Styles />
      </section>
    );
  }

  const rows = Object.entries(data.diff);
  const fixed = rows.filter(([, r]) => r.fixed).length;
  const regressed = rows.filter(([, r]) => r.regressed).length;
  const haveBoth = data.have_vulnerable && data.have_patched;

  return (
    <section className="panel rg">
      <div className="panel__head">
        <span className="panel__dot" style={{ background: "var(--violet)", boxShadow: "0 0 10px var(--violet)" }} />
        <span className="panel__title">Regression Diff</span>
        <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-faint)" }}>
          {haveBoth ? "vuln → patched" : "partial"}
        </span>
      </div>

      <div className="panel__body rg__body">
        {error && <p style={{ color: "var(--breach)", fontSize: 12 }}>{error}</p>}

        {haveBoth && (
          <div className="rg__summary">
            <span className="rg__chip rg__chip--ok">fixed {fixed}</span>
            <span className="rg__chip rg__chip--bad">regressed {regressed}</span>
          </div>
        )}

        <div className="rg__rows">
          {rows.map(([cls, r]) => (
            <div key={cls} className="rg__row">
              <span className="rg__cls">{pretty(cls)}</span>
              <span className={`tag tag--${r.before}`}>{r.before}</span>
              <span className="rg__arrow">→</span>
              <span className={`tag tag--${r.after}`}>{r.after}</span>
              <span className="rg__delta">
                {r.fixed ? (
                  <span className="rg__d rg__d--fixed">fixed</span>
                ) : r.regressed ? (
                  <span className="rg__d rg__d--reg">regressed</span>
                ) : (
                  <span className="rg__d rg__d--same">—</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
      <Styles />
    </section>
  );
}

function Styles() {
  return (
    <style>{`
      .rg__body { display: flex; flex-direction: column; gap: 10px; }
      .rg__summary { display: flex; gap: 8px; }
      .rg__chip {
        font-family: var(--font-mono); font-size: 11px; font-weight: 600;
        padding: 4px 9px; border-radius: 99px; border: 1px solid var(--line-bright);
      }
      .rg__chip--ok  { color: var(--blocked); border-color: rgba(52,224,161,0.4); }
      .rg__chip--bad { color: var(--breach); border-color: rgba(255,77,77,0.4); }
      .rg__rows { display: flex; flex-direction: column; gap: 6px; }
      .rg__row {
        display: grid;
        grid-template-columns: 1fr auto auto auto auto;
        align-items: center;
        gap: 7px;
        padding: 8px 10px;
        background: var(--bg-2);
        border: 1px solid var(--line);
        border-radius: var(--r-sm);
        font-size: 12px;
      }
      .rg__cls { text-transform: capitalize; color: var(--fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .rg__arrow { color: var(--fg-faint); font-family: var(--font-mono); }
      .rg__delta { margin-left: 4px; }
      .rg__d { font-family: var(--font-mono); font-size: 9.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; }
      .rg__d--fixed { color: var(--blocked); background: rgba(52,224,161,0.12); }
      .rg__d--reg { color: var(--breach); background: rgba(255,77,77,0.14); }
      .rg__d--same { color: var(--fg-faint); }
    `}</style>
  );
}
