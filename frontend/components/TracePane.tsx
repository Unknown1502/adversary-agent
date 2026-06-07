"use client";

import { useEffect, useRef } from "react";
import type { Ev } from "../app/types";

interface Props {
  events: Ev[];
}

function clip(s: string, n = 420): string {
  if (!s) return "";
  return s.length <= n ? s : s.slice(0, n) + "…";
}

interface Rendered {
  kind: string;
  label: string;
  icon: string;
  tone: string;
  body: React.ReactNode;
}

const TONE = {
  blue: "#5e8bff",
  violet: "var(--violet)",
  cyan: "var(--cyan)",
  green: "var(--accent)",
  amber: "var(--amber)",
  red: "var(--breach)",
  dim: "var(--fg-faint)",
};

const VTONE: Record<string, string> = {
  blocked: "var(--blocked)",
  partial: "var(--partial)",
  breach: "var(--breach)",
};

function render(ev: Ev): Rendered {
  switch (ev.type) {
    case "campaign_start":
      return {
        kind: "campaign_start",
        label: "campaign initialized",
        icon: "◆",
        tone: TONE.green,
        body: (
          <span>
            <code className="hl">{ev.campaign_id}</code> vs{" "}
            <code className="hl">{ev.target}</code> · {ev.classes.length} attack classes
          </span>
        ),
      };
    case "warning":
      return { kind: "warning", label: "warning", icon: "!", tone: TONE.amber, body: <em>{ev.message}</em> };
    case "class_start":
      return { kind: "class_start", label: "engaging class", icon: "▸", tone: TONE.dim, body: <b>{ev.title}</b> };
    case "strategy":
      return {
        kind: "strategy",
        label: "strategist · plan",
        icon: "⬡",
        tone: TONE.violet,
        body: <Plan text={ev.plan} />,
      };
    case "replan":
      return {
        kind: "replan",
        label: `strategist · re-plan after #${ev.after_attempt}`,
        icon: "↻",
        tone: TONE.violet,
        body: <Plan text={ev.plan} />,
      };
    case "attack_fired":
      return {
        kind: "attack_fired",
        label: `attacker · fire #${ev.attempt}`,
        icon: "➤",
        tone: TONE.cyan,
        body: (
          <div>
            <div className="sub">technique <code className="hl">{ev.technique}</code></div>
            <pre className="code">{clip(ev.payload)}</pre>
          </div>
        ),
      };
    case "verdict":
      return {
        kind: "verdict",
        label: `analyst · verdict #${ev.attempt}`,
        icon: "⚖",
        tone: VTONE[ev.verdict] ?? TONE.dim,
        body: (
          <div>
            <span className={`tag tag--${ev.verdict}`}>{ev.verdict}</span>{" "}
            <span className="sub" style={{ display: "inline" }}>{ev.evidence}</span>
            {ev.target_output ? (
              <pre className="code code--quiet">{clip(ev.target_output)}</pre>
            ) : null}
          </div>
        ),
      };
    case "breach":
      return {
        kind: "breach",
        label: "BREACH CONFIRMED",
        icon: "✸",
        tone: TONE.red,
        body: (
          <span>
            <code className="hl">{ev.cls}</code> broken on attempt #{ev.attempt} · ground-truth verified
          </span>
        ),
      };
    case "class_done":
      return {
        kind: "class_done",
        label: "class resolved",
        icon: "■",
        tone: VTONE[ev.verdict] ?? TONE.dim,
        body: (
          <span>
            <code className="hl">{ev.cls}</code> → <span className={`tag tag--${ev.verdict}`}>{ev.verdict}</span>
          </span>
        ),
      };
    case "report_ready":
      return {
        kind: "report_ready",
        label: "reporter · artifact written",
        icon: "❑",
        tone: TONE.green,
        body: <span>report → <code className="hl">{ev.report_path}</code></span>,
      };
    case "campaign_done":
      return { kind: "campaign_done", label: "campaign complete", icon: "✓", tone: TONE.green, body: <b>All classes resolved.</b> };
    case "error":
      return {
        kind: "error",
        label: "error",
        icon: "✕",
        tone: TONE.red,
        body: <span style={{ color: "var(--breach)" }}><b>{ev.where}</b>: {ev.message}</span>,
      };
    default:
      return { kind: "event", label: "event", icon: "·", tone: TONE.dim, body: <code>{JSON.stringify(ev)}</code> };
  }
}

export default function TracePane({ events }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [events.length]);

  return (
    <section className="panel">
      <div className="panel__head">
        <span className="panel__dot" />
        <span className="panel__title">Live Reasoning Stream</span>
        <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-faint)" }}>
          {events.length} events
        </span>
      </div>

      <div className="panel__body trace" ref={ref}>
        {events.length === 0 && (
          <p className="empty">
            stream idle — launch a campaign to begin<span className="blink">_</span>
          </p>
        )}

        {events.map((ev, i) => {
          const r = render(ev);
          const isBreach = r.kind === "breach";
          return (
            <div
              key={i}
              className={`ev anim-in ${isBreach ? "ev--breach" : ""}`}
              style={{ ["--tone" as string]: r.tone }}
            >
              <div className="ev__gutter">
                <span className="ev__icon">{r.icon}</span>
              </div>
              <div className="ev__main">
                <div className="ev__label">{r.label}</div>
                <div className="ev__body">{r.body}</div>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        .trace { display: flex; flex-direction: column; gap: 8px; }
        .ev {
          display: flex;
          gap: 10px;
          padding: 9px 11px;
          background: var(--bg-2);
          border: 1px solid var(--line);
          border-left: 2px solid var(--tone);
          border-radius: var(--r-sm);
        }
        .ev--breach {
          border: 1px solid rgba(255,77,77,0.55);
          border-left: 2px solid var(--breach);
          background:
            linear-gradient(90deg, rgba(255,77,77,0.10), transparent 60%),
            var(--bg-2);
          animation: rowIn 0.28s cubic-bezier(0.2,0.8,0.2,1) both, breachFlash 1.1s ease-out 0.28s;
          box-shadow: var(--glow-breach);
        }
        .ev__gutter { flex: 0 0 auto; padding-top: 1px; }
        .ev__icon {
          display: grid; place-items: center;
          width: 20px; height: 20px;
          font-size: 11px;
          color: var(--tone);
          background: color-mix(in srgb, var(--tone) 14%, transparent);
          border-radius: 5px;
        }
        .ev__main { flex: 1 1 auto; min-width: 0; }
        .ev__label {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--tone);
          margin-bottom: 3px;
          font-weight: 600;
        }
        .ev--breach .ev__label { color: var(--breach); letter-spacing: 0.16em; }
        .ev__body { font-size: 12.5px; color: var(--fg); word-break: break-word; }
        .ev__body .sub { display: block; font-size: 11px; color: var(--fg-dim); margin-bottom: 4px; }
        .ev__body .hl { color: var(--accent); }
        .code {
          margin: 5px 0 0;
          padding: 8px 10px;
          background: var(--bg-0);
          border: 1px solid var(--line);
          border-radius: var(--r-sm);
          font-size: 11.5px;
          line-height: 1.55;
          color: #b9c6d4;
          white-space: pre-wrap;
          word-break: break-word;
          max-height: 180px;
          overflow: auto;
        }
        .code--quiet { color: var(--fg-dim); background: rgba(0,0,0,0.35); }
        .blink { animation: pulse 1s step-end infinite; color: var(--accent); }
        .plan { margin: 0; }
        .plan__row { display: flex; gap: 7px; font-size: 12px; padding: 1px 0; }
        .plan__k { color: var(--fg-faint); font-family: var(--font-mono); font-size: 11px; min-width: 74px; }
        .plan__v { color: var(--fg); }
      `}</style>
    </section>
  );
}

/* The Strategist emits a JSON-ish plan. Pretty-print the common keys when we
   can parse it; otherwise fall back to a clean monospace block. */
function Plan({ text }: { text: string }) {
  const parsed = tryParsePlan(text);
  if (!parsed) return <pre className="code">{clip(text, 500)}</pre>;
  return (
    <div className="plan">
      {Object.entries(parsed).map(([k, v]) => (
        <div className="plan__row" key={k}>
          <span className="plan__k">{k}</span>
          <span className="plan__v">{typeof v === "string" ? v : JSON.stringify(v)}</span>
        </div>
      ))}
    </div>
  );
}

function tryParsePlan(text: string): Record<string, unknown> | null {
  if (!text) return null;
  const cleaned = text.replace(/```json|```/g, "").trim();
  try {
    const obj = JSON.parse(cleaned);
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      // Keep it compact: surface the fields that tell the story.
      const keep = ["technique", "rationale", "reason", "based_on", "evidence", "hypothesis", "plan"];
      const out: Record<string, unknown> = {};
      for (const k of keep) if (k in obj) out[k] = obj[k];
      return Object.keys(out).length ? out : obj;
    }
  } catch {
    /* not JSON — fall through */
  }
  return null;
}
