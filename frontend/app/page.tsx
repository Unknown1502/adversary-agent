"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CampaignTree from "../components/CampaignTree";
import RegressionPanel from "../components/RegressionPanel";
import Scorecard from "../components/Scorecard";
import TracePane from "../components/TracePane";
import type { Ev, Verdict } from "./types";
import { worse } from "./types";

// The backend URL.
// - In production the app is served BY FastAPI from the same Cloud Run
//   service, so we talk to it same-origin (empty base -> relative URLs).
// - For local dev against a separately-run backend, set NEXT_PUBLIC_API_BASE.
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

export default function Console() {
  const [events, setEvents] = useState<Ev[]>([]);
  const [summary, setSummary] = useState<Record<string, Verdict>>({});
  const [running, setRunning] = useState<"idle" | "running">("idle");
  const [target, setTarget] = useState<string | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [regressionRefreshKey, setRegressionRefreshKey] = useState(0);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, []);

  const start = useCallback((nextTarget: "vulnerable" | "patched") => {
    esRef.current?.close();
    setEvents([]);
    setSummary({});
    setCampaignId(null);
    setTarget(nextTarget);
    setRunning("running");

    const url = `${API_BASE}/campaign/stream?target=${nextTarget}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onmessage = (msg) => {
      try {
        const ev = JSON.parse(msg.data) as Ev;
        setEvents((prev) => [...prev, ev]);
        if (ev.type === "campaign_start") setCampaignId(ev.campaign_id);
        if (ev.type === "verdict") {
          setSummary((s) => ({ ...s, [ev.cls]: worse(s[ev.cls], ev.verdict) }));
        }
        if (ev.type === "campaign_done") {
          setRunning("idle");
          es.close();
          esRef.current = null;
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

  const breaches = useMemo(
    () => Object.values(summary).filter((v) => v === "breach").length,
    [summary]
  );

  return (
    <div className="app">
      <Header
        running={running}
        target={target}
        campaignId={campaignId}
        breaches={breaches}
        classesDone={Object.keys(summary).length}
      />

      <main className="grid">
        <CampaignTree events={events} />
        <TracePane events={events} />
        <aside className="rail">
          <Scorecard
            summary={summary}
            running={running}
            target={target}
            onStart={start}
          />
          <RegressionPanel refreshKey={regressionRefreshKey} apiBase={API_BASE} />
        </aside>
      </main>

      <Styles />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Header — the SOC command bar                                        */
/* ------------------------------------------------------------------ */

function Header({
  running,
  target,
  campaignId,
  breaches,
  classesDone,
}: {
  running: "idle" | "running";
  target: string | null;
  campaignId: string | null;
  breaches: number;
  classesDone: number;
}) {
  return (
    <header className="hdr">
      <div className="hdr__brand">
        <span className="hdr__glyph" aria-hidden>
          {/* crosshair mark */}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="8.2" stroke="currentColor" strokeWidth="1.6" />
            <path d="M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="12" cy="12" r="2.2" fill="currentColor" />
          </svg>
        </span>
        <div className="hdr__name">
          <strong>ADVERSARY</strong>
          <span>self-improving red-team agent · Arize Phoenix</span>
        </div>
      </div>

      <div className="hdr__meta">
        <Meta label="campaign" value={campaignId ?? "—"} mono />
        <Meta label="target" value={target ?? "—"} mono />
        <Meta label="breaches" value={String(breaches)} accent={breaches > 0 ? "breach" : undefined} />
        <Meta label="classes" value={`${classesDone}/4`} />
        <span className={`pill ${running === "running" ? "pill--live" : ""}`}>
          <span className="pill__dot" />
          {running === "running" ? "LIVE" : "IDLE"}
        </span>
      </div>
    </header>
  );
}

function Meta({
  label,
  value,
  mono,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: "breach";
}) {
  return (
    <div className="meta">
      <span className="meta__k">{label}</span>
      <span
        className={`meta__v ${mono ? "mono" : ""}`}
        style={accent === "breach" ? { color: "var(--breach)" } : undefined}
      >
        {value}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Layout styles (scoped via a styled tag to keep page self-contained)*/
/* ------------------------------------------------------------------ */

function Styles() {
  return (
    <style>{`
      .app {
        position: relative;
        z-index: 1;
        display: flex;
        flex-direction: column;
        height: 100vh;
        padding: 14px;
        gap: 12px;
        box-sizing: border-box;
      }
      .hdr {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 12px 16px;
        background: linear-gradient(180deg, var(--bg-2), var(--bg-1));
        border: 1px solid var(--line);
        border-radius: var(--r-lg);
        box-shadow: var(--shadow-1);
      }
      .hdr__brand { display: flex; align-items: center; gap: 12px; }
      .hdr__glyph {
        display: grid; place-items: center;
        width: 38px; height: 38px;
        color: var(--accent);
        background: radial-gradient(circle at 50% 40%, rgba(52,224,161,0.18), transparent 70%);
        border: 1px solid rgba(52,224,161,0.35);
        border-radius: 10px;
        box-shadow: inset 0 0 12px rgba(52,224,161,0.15);
      }
      .hdr__name { display: flex; flex-direction: column; line-height: 1.25; }
      .hdr__name strong { font-size: 15px; letter-spacing: 0.18em; }
      .hdr__name span { font-size: 11px; color: var(--fg-dim); }
      .hdr__meta { display: flex; align-items: center; gap: 18px; }
      .meta { display: flex; flex-direction: column; align-items: flex-end; line-height: 1.2; }
      .meta__k { font-size: 9.5px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--fg-faint); }
      .meta__v { font-size: 13px; font-weight: 600; color: var(--fg); }

      .grid {
        flex: 1 1 auto;
        min-height: 0;
        display: grid;
        grid-template-columns: minmax(260px, 0.95fr) minmax(0, 1.5fr) minmax(300px, 0.95fr);
        gap: 12px;
      }
      .rail { display: flex; flex-direction: column; gap: 12px; min-height: 0; }

      @media (max-width: 1100px) {
        .grid { grid-template-columns: 1fr 1fr; grid-auto-rows: minmax(0, 1fr); }
        .rail { grid-column: 1 / -1; flex-direction: row; }
        .rail > * { flex: 1; }
      }
      @media (max-width: 760px) {
        .app { height: auto; min-height: 100vh; }
        .grid { grid-template-columns: 1fr; }
        .rail { flex-direction: column; }
        .hdr { flex-wrap: wrap; }
        .hdr__meta { gap: 12px; flex-wrap: wrap; }
      }
    `}</style>
  );
}
