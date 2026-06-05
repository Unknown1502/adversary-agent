"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CampaignTree from "../components/CampaignTree";
import RegressionPanel from "../components/RegressionPanel";
import Scorecard from "../components/Scorecard";
import TracePane from "../components/TracePane";
import type { Ev, Verdict } from "./types";
import { worse } from "./types";

// The backend URL. In production, set NEXT_PUBLIC_API_BASE; in dev it
// defaults to the local FastAPI port.
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080";

export default function Console() {
  const [events, setEvents] = useState<Ev[]>([]);
  const [summary, setSummary] = useState<Record<string, Verdict>>({});
  const [running, setRunning] = useState<"idle" | "running">("idle");
  const [target, setTarget] = useState<string | null>(null);
  // Bumped after every completed run so RegressionPanel re-fetches.
  const [regressionRefreshKey, setRegressionRefreshKey] = useState(0);
  const esRef = useRef<EventSource | null>(null);

  // Tear down any open EventSource when the component unmounts so a
  // dev-time HMR reload doesn't leak a dangling SSE connection.
  useEffect(() => {
    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, []);

  const start = useCallback((nextTarget: "vulnerable" | "patched") => {
    // Close any existing stream so back-to-back clicks reset state.
    esRef.current?.close();
    setEvents([]);
    setSummary({});
    setTarget(nextTarget);
    setRunning("running");

    const url = `${API_BASE}/campaign/stream?target=${nextTarget}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onmessage = (msg) => {
      try {
        const ev = JSON.parse(msg.data) as Ev;
        setEvents((prev) => [...prev, ev]);
        if (ev.type === "verdict") {
          setSummary((s) => ({ ...s, [ev.cls]: worse(s[ev.cls], ev.verdict) }));
        }
        if (ev.type === "campaign_done") {
          setRunning("idle");
          es.close();
          esRef.current = null;
          // Force RegressionPanel to refetch /report/regression so the
          // diff updates as soon as each target finishes.
          setRegressionRefreshKey((k) => k + 1);
        }
      } catch (err) {
        console.error("Failed to parse SSE message", err, msg.data);
      }
    };

    es.onerror = (err) => {
      console.error("SSE error", err);
      setRunning("idle");
      es.close();
      esRef.current = null;
    };
  }, []);

  return (
    <main
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1.4fr 0.8fr",
        gap: 16,
        height: "100vh",
        padding: 16,
        boxSizing: "border-box",
      }}
    >
      <CampaignTree events={events} />
      <TracePane events={events} />
      <div style={{ display: "flex", flexDirection: "column", gap: 0, minHeight: 0 }}>
        <Scorecard
          summary={summary}
          running={running}
          target={target}
          onStart={start}
        />
        <RegressionPanel
          refreshKey={regressionRefreshKey}
          apiBase={API_BASE}
        />
      </div>
    </main>
  );
}
