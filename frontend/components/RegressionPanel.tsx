"use client";

import { useEffect, useState } from "react";
import type { Verdict } from "../app/types";
import { VERDICT_COLOR } from "../app/types";

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
  // Bump this number to re-fetch (e.g. when a patched campaign finishes).
  refreshKey: number;
  apiBase: string;
}

export default function RegressionPanel({ refreshKey, apiBase }: Props) {
  const [data, setData] = useState<RegressionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (refreshKey === 0) return; // nothing to show until at least one run
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`${apiBase}/report/regression`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as RegressionResponse;
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey, apiBase]);

  if (refreshKey === 0 || data === null) {
    return null;
  }

  const rows = Object.entries(data.diff);
  const fixedCount = rows.filter(([, r]) => r.fixed).length;
  const regressedCount = rows.filter(([, r]) => r.regressed).length;
  const haveBoth = data.have_vulnerable && data.have_patched;

  return (
    <section
      style={{
        marginTop: 12,
        padding: 12,
        background: "#11151a",
        borderRadius: 12,
        border: "1px solid #1c222a",
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: 8, fontSize: 14, opacity: 0.85 }}>
        Regression diff{" "}
        <span style={{ fontSize: 11, opacity: 0.6 }}>
          {haveBoth ? "vulnerable → patched" : "partial — run both targets"}
        </span>
      </h3>

      {error && (
        <p style={{ color: VERDICT_COLOR.breach, fontSize: 12 }}>{error}</p>
      )}

      {haveBoth && (
        <div
          style={{
            fontSize: 12,
            opacity: 0.85,
            marginBottom: 8,
            display: "flex",
            gap: 12,
          }}
        >
          <span>
            fixed:{" "}
            <b style={{ color: VERDICT_COLOR.blocked }}>{fixedCount}</b>
          </span>
          <span>
            regressed:{" "}
            <b style={{ color: VERDICT_COLOR.breach }}>{regressedCount}</b>
          </span>
        </div>
      )}

      <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ opacity: 0.6, textAlign: "left" }}>
            <th style={{ padding: "4px 6px" }}>class</th>
            <th style={{ padding: "4px 6px" }}>before</th>
            <th style={{ padding: "4px 6px" }}>after</th>
            <th style={{ padding: "4px 6px" }}>delta</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([cls, r]) => (
            <tr key={cls} style={{ borderTop: "1px solid #1a1f27" }}>
              <td style={{ padding: "5px 6px" }}>{cls}</td>
              <td style={{ padding: "5px 6px", color: VERDICT_COLOR[r.before] }}>
                {r.before}
              </td>
              <td style={{ padding: "5px 6px", color: VERDICT_COLOR[r.after] }}>
                {r.after}
              </td>
              <td style={{ padding: "5px 6px", fontWeight: 600 }}>
                {r.fixed ? (
                  <span style={{ color: VERDICT_COLOR.blocked }}>FIXED</span>
                ) : r.regressed ? (
                  <span style={{ color: VERDICT_COLOR.breach }}>REGRESSED</span>
                ) : (
                  <span style={{ opacity: 0.5 }}>—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
