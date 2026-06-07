"use client";

import type { Verdict } from "../app/types";

interface Props {
  summary: Record<string, Verdict>;
  running: "idle" | "running";
  target: string | null;
  onStart: (target: "vulnerable" | "patched") => void;
}

const ORDER = ["direct_jailbreak", "indirect_injection", "system_prompt_leak", "tool_abuse"];

function prettyClass(cls: string): string {
  return cls.replace(/_/g, " ");
}

export default function Scorecard({ summary, running, target, onStart }: Props) {
  const disabled = running === "running";
  const known = ORDER.filter((c) => c in summary);
  const rest = Object.keys(summary).filter((c) => !ORDER.includes(c));
  const rows = [...known, ...rest];

  const breaches = Object.values(summary).filter((v) => v === "breach").length;
  const held = Object.values(summary).filter((v) => v === "blocked").length;

  return (
    <section className="panel sc">
      <div className="panel__head">
        <span className="panel__dot" />
        <span className="panel__title">Scorecard{target ? ` · ${target}` : ""}</span>
      </div>

      <div className="panel__body sc__body">
        <div className="sc__stats">
          <Stat n={breaches} label="breached" tone="var(--breach)" />
          <Stat n={held} label="held" tone="var(--blocked)" />
        </div>

        {rows.length === 0 ? (
          <p className="empty">no verdicts yet</p>
        ) : (
          <div className="sc__rows">
            {rows.map((cls) => {
              const v = summary[cls];
              return (
                <div key={cls} className={`sc__row sc__row--${v} anim-in`}>
                  <span className="sc__cls">{prettyClass(cls)}</span>
                  <span className={`tag tag--${v}`}>{v}</span>
                </div>
              );
            })}
          </div>
        )}

        <div className="sc__actions">
          <button
            className="btn btn--primary"
            onClick={() => !disabled && onStart("vulnerable")}
            disabled={disabled}
          >
            {disabled && target === "vulnerable" ? (
              <><span className="spinner" /> running</>
            ) : (
              <>▸ Run · vulnerable</>
            )}
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => !disabled && onStart("patched")}
            disabled={disabled}
          >
            {disabled && target === "patched" ? (
              <><span className="spinner" /> running</>
            ) : (
              <>↻ Re-run · patched</>
            )}
          </button>
        </div>
      </div>

      <style>{`
        .sc__body { display: flex; flex-direction: column; gap: 12px; }
        .sc__stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .stat {
          padding: 12px;
          background: var(--bg-2);
          border: 1px solid var(--line);
          border-radius: var(--r-md);
          text-align: center;
        }
        .stat__n { font-family: var(--font-mono); font-size: 26px; font-weight: 700; line-height: 1; }
        .stat__l { font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--fg-dim); margin-top: 5px; }

        .sc__rows { display: flex; flex-direction: column; gap: 6px; }
        .sc__row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 9px 11px;
          border-radius: var(--r-sm);
          border: 1px solid var(--line);
          background: var(--bg-2);
        }
        .sc__row--breach  { border-color: rgba(255,77,77,0.4); background: rgba(255,77,77,0.07); }
        .sc__row--partial { border-color: rgba(245,177,61,0.3); }
        .sc__row--blocked { border-color: rgba(52,224,161,0.3); }
        .sc__cls { font-size: 12.5px; text-transform: capitalize; }

        .sc__actions { display: flex; flex-direction: column; gap: 8px; margin-top: 2px; }
      `}</style>
    </section>
  );
}

function Stat({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <div className="stat">
      <div className="stat__n" style={{ color: tone }}>{n}</div>
      <div className="stat__l">{label}</div>
    </div>
  );
}
