"use client";

import type { Ev, EvAttackFired, EvClassStart, EvVerdict } from "../app/types";
import type { Verdict } from "../app/types";

interface Props {
  events: Ev[];
}

interface Attempt {
  attempt: number;
  technique: string;
  verdict?: Verdict;
}

interface ClassNode {
  cls: string;
  title: string;
  attempts: Attempt[];
  done?: Verdict;
}

function buildTree(events: Ev[]): ClassNode[] {
  const order: string[] = [];
  const map = new Map<string, ClassNode>();

  for (const ev of events) {
    if (ev.type === "class_start") {
      const cs = ev as EvClassStart;
      if (!map.has(cs.cls)) {
        map.set(cs.cls, { cls: cs.cls, title: cs.title, attempts: [] });
        order.push(cs.cls);
      }
    } else if (ev.type === "attack_fired") {
      const af = ev as EvAttackFired;
      const node = map.get(af.cls);
      if (node && !node.attempts.some((a) => a.attempt === af.attempt)) {
        node.attempts.push({ attempt: af.attempt, technique: af.technique });
      }
    } else if (ev.type === "verdict") {
      const vd = ev as EvVerdict;
      const node = map.get(vd.cls);
      const a = node?.attempts.find((x) => x.attempt === vd.attempt);
      if (a) a.verdict = vd.verdict;
    } else if (ev.type === "class_done") {
      const node = map.get(ev.cls);
      if (node) node.done = ev.verdict;
    }
  }
  return order.map((k) => map.get(k)!).filter(Boolean);
}

function statusFace(node: ClassNode) {
  if (node.done) return { text: node.done, cls: node.done };
  if (node.attempts.length === 0) return { text: "queued", cls: "pending" };
  return { text: "running", cls: "running" };
}

export default function CampaignTree({ events }: Props) {
  const tree = buildTree(events);

  return (
    <section className="panel">
      <div className="panel__head">
        <span className="panel__dot" />
        <span className="panel__title">Attack Surface</span>
        <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-faint)" }}>
          {tree.length} classes
        </span>
      </div>
      <div className="panel__body">
        {tree.length === 0 && (
          <p className="empty">
            awaiting orchestrator<span className="blink">_</span>
          </p>
        )}

        {tree.map((node, i) => {
          const face = statusFace(node);
          return (
            <article
              key={node.cls}
              className="cls anim-in"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <header className="cls__head">
                <div className="cls__title">
                  <span className="cls__chevron">▸</span>
                  {node.title}
                </div>
                <StatusBadge kind={face.cls} text={face.text} />
              </header>

              <div className="cls__rows">
                {node.attempts.map((a) => (
                  <div key={a.attempt} className="atk anim-in">
                    <span className="atk__n">#{a.attempt}</span>
                    <code className="atk__tech">{a.technique}</code>
                    <span className="atk__fill" />
                    {a.verdict ? (
                      <span className={`tag tag--${a.verdict}`}>{a.verdict}</span>
                    ) : (
                      <span className="spinner" />
                    )}
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </div>

      <style>{`
        .cls {
          border: 1px solid var(--line);
          border-radius: var(--r-md);
          background: var(--bg-2);
          margin-bottom: 10px;
          overflow: hidden;
        }
        .cls:last-child { margin-bottom: 0; }
        .cls__head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 11px;
          background: linear-gradient(180deg, rgba(255,255,255,0.02), transparent);
        }
        .cls__title { display: flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 600; }
        .cls__chevron { color: var(--accent); font-size: 10px; }
        .cls__rows { padding: 4px 8px 9px; }
        .atk {
          display: flex; align-items: center; gap: 9px;
          padding: 5px 4px;
          border-top: 1px dashed var(--line);
        }
        .atk:first-child { border-top: 0; }
        .atk__n { font-family: var(--font-mono); font-size: 11px; color: var(--fg-faint); width: 22px; }
        .atk__tech {
          font-size: 11px; color: var(--cyan);
          background: rgba(56,189,248,0.08);
          padding: 1px 6px; border-radius: 4px;
        }
        .atk__fill { flex: 1; border-bottom: 1px dotted var(--line); height: 1px; margin: 0 2px; opacity: 0.6; }
        .blink { animation: pulse 1s step-end infinite; color: var(--accent); }
      `}</style>
    </section>
  );
}

function StatusBadge({ kind, text }: { kind: string; text: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    blocked: { color: "var(--blocked)", bg: "rgba(52,224,161,0.12)" },
    partial: { color: "var(--partial)", bg: "rgba(245,177,61,0.13)" },
    breach: { color: "#fff", bg: "rgba(255,77,77,0.9)" },
    running: { color: "var(--cyan)", bg: "rgba(56,189,248,0.12)" },
    pending: { color: "var(--fg-faint)", bg: "rgba(255,255,255,0.04)" },
  };
  const s = map[kind] ?? map.pending;
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        padding: "2px 8px",
        borderRadius: 5,
        color: s.color,
        background: s.bg,
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
      }}
    >
      {kind === "running" && <span className="spinner" />}
      {text}
    </span>
  );
}
