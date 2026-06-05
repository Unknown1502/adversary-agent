"use client";

import type { Verdict } from "../app/types";
import { VERDICT_COLOR } from "../app/types";

interface Props {
  summary: Record<string, Verdict>;
  running: "idle" | "running";
  target: string | null;
  onStart: (target: "vulnerable" | "patched") => void;
}

const btn: React.CSSProperties = {
  display: "block",
  width: "100%",
  margin: "8px 0",
  padding: "10px 14px",
  borderRadius: 8,
  background: "#1a73e8",
  color: "#fff",
  border: 0,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 500,
};

const btnSecondary: React.CSSProperties = {
  ...btn,
  background: "#1f2630",
  color: "#cdd5df",
};

const btnDisabled: React.CSSProperties = {
  ...btn,
  background: "#1f2630",
  color: "#666",
  cursor: "not-allowed",
};

export default function Scorecard({ summary, running, target, onStart }: Props) {
  const entries = Object.entries(summary);
  const disabled = running === "running";

  return (
    <section
      style={{
        padding: 12,
        background: "#11151a",
        borderRadius: 12,
        border: "1px solid #1c222a",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 14, opacity: 0.8 }}>
        Scorecard{target ? ` — ${target}` : ""}
      </h3>

      {entries.length === 0 && (
        <p style={{ opacity: 0.5, fontSize: 13 }}>
          No verdicts yet. Run a campaign to populate.
        </p>
      )}

      <div style={{ flexGrow: 1 }}>
        {entries.map(([cls, v]) => (
          <div
            key={cls}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "8px 10px",
              borderRadius: 8,
              margin: "6px 0",
              background: VERDICT_COLOR[v] + "22",
              border: `1px solid ${VERDICT_COLOR[v]}55`,
              transition: "background 200ms ease, border 200ms ease",
            }}
          >
            <span style={{ fontSize: 13 }}>{cls}</span>
            <b style={{ color: VERDICT_COLOR[v], fontSize: 12 }}>
              {v.toUpperCase()}
            </b>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12 }}>
        <button
          style={disabled ? btnDisabled : btn}
          onClick={() => !disabled && onStart("vulnerable")}
          disabled={disabled}
        >
          {disabled && target === "vulnerable"
            ? "Running…"
            : "Run attack (vulnerable)"}
        </button>
        <button
          style={disabled ? btnDisabled : btnSecondary}
          onClick={() => !disabled && onStart("patched")}
          disabled={disabled}
        >
          {disabled && target === "patched"
            ? "Running…"
            : "Re-run on patched"}
        </button>
      </div>
    </section>
  );
}
