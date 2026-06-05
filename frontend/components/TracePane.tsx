"use client";

import { useEffect, useRef } from "react";
import type { Ev } from "../app/types";
import { VERDICT_COLOR } from "../app/types";

interface Props {
  events: Ev[];
}

// Truncate long strings for display without losing the head — the head
// is what tells the story (the injected instruction, the refusal phrase).
function clip(s: string, n = 280): string {
  if (s.length <= n) return s;
  return s.slice(0, n) + "…";
}

function eventLine(ev: Ev): { label: string; body: React.ReactNode; tone: string } {
  switch (ev.type) {
    case "campaign_start":
      return {
        label: "campaign",
        body: (
          <span>
            <b>{ev.campaign_id}</b> against <b>{ev.target}</b> · classes:{" "}
            <code>{ev.classes.join(", ")}</code>
          </span>
        ),
        tone: "#5e8bff",
      };
    case "warning":
      return { label: "warn", body: <em>{ev.message}</em>, tone: "#b8860b" };
    case "class_start":
      return { label: "class", body: <b>{ev.title}</b>, tone: "#9aa6b2" };
    case "strategy":
      return {
        label: "strategy",
        body: <pre style={preStyle}>{clip(ev.plan, 600)}</pre>,
        tone: "#5e8bff",
      };
    case "replan":
      return {
        label: "replan",
        body: (
          <pre style={preStyle}>
            after attempt #{ev.after_attempt}{"\n"}
            {clip(ev.plan, 600)}
          </pre>
        ),
        tone: "#5e8bff",
      };
    case "attack_fired":
      return {
        label: `fire #${ev.attempt}`,
        body: (
          <div>
            <div style={{ opacity: 0.7, fontSize: 11 }}>
              technique: <code>{ev.technique}</code>
            </div>
            <pre style={preStyle}>{clip(ev.payload, 600)}</pre>
          </div>
        ),
        tone: "#c79ad6",
      };
    case "verdict":
      return {
        label: `verdict #${ev.attempt}`,
        body: (
          <div>
            <b style={{ color: VERDICT_COLOR[ev.verdict] }}>
              {ev.verdict.toUpperCase()}
            </b>{" "}
            — {ev.evidence}
            <pre style={{ ...preStyle, opacity: 0.7 }}>
              {clip(ev.target_output, 600)}
            </pre>
          </div>
        ),
        tone: VERDICT_COLOR[ev.verdict],
      };
    case "breach":
      return {
        label: "BREACH",
        body: (
          <b style={{ color: VERDICT_COLOR.breach }}>
            class <code>{ev.cls}</code> broken on attempt #{ev.attempt}
          </b>
        ),
        tone: VERDICT_COLOR.breach,
      };
    case "class_done":
      return {
        label: "class done",
        body: (
          <span>
            <code>{ev.cls}</code> final:{" "}
            <b style={{ color: VERDICT_COLOR[ev.verdict] }}>{ev.verdict}</b>
          </span>
        ),
        tone: VERDICT_COLOR[ev.verdict],
      };
    case "report_ready":
      return {
        label: "report",
        body: (
          <span>
            written to <code>{ev.report_path}</code>
          </span>
        ),
        tone: "#1f7a4d",
      };
    case "campaign_done":
      return {
        label: "done",
        body: <b>Campaign complete.</b>,
        tone: "#1f7a4d",
      };
    case "error":
      return {
        label: "error",
        body: (
          <span style={{ color: VERDICT_COLOR.breach }}>
            <b>{ev.where}</b>: {ev.message}
          </span>
        ),
        tone: VERDICT_COLOR.breach,
      };
    default:
      return { label: "event", body: <code>{JSON.stringify(ev)}</code>, tone: "#666" };
  }
}

const preStyle: React.CSSProperties = {
  margin: "4px 0 0 0",
  padding: 6,
  background: "#0a0d11",
  borderRadius: 6,
  fontSize: 12,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  border: "1px solid #1a1f27",
};

export default function TracePane({ events }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new events so the live action stays visible.
  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [events.length]);

  return (
    <section
      ref={ref}
      style={{
        overflow: "auto",
        padding: 12,
        background: "#11151a",
        borderRadius: 12,
        border: "1px solid #1c222a",
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 14, opacity: 0.8 }}>
        Live reasoning + Phoenix
      </h3>
      {events.length === 0 && (
        <p style={{ opacity: 0.5, fontSize: 13 }}>
          Waiting for the orchestrator. Events stream here in real time.
        </p>
      )}
      {events.map((ev, i) => {
        const { label, body, tone } = eventLine(ev);
        return (
          <div
            key={i}
            style={{
              fontSize: 13,
              padding: "8px 10px",
              borderLeft: `3px solid ${tone}`,
              margin: "6px 0",
              background: "#0f1318",
              borderRadius: 6,
            }}
          >
            <div style={{ fontSize: 11, opacity: 0.55, marginBottom: 4 }}>
              {label}
            </div>
            <div>{body}</div>
          </div>
        );
      })}
    </section>
  );
}
