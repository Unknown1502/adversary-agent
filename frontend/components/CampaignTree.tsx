"use client";

import type { Ev, EvAttackFired, EvClassStart, EvVerdict } from "../app/types";
import { VERDICT_COLOR } from "../app/types";

interface Props {
  events: Ev[];
}

interface ClassNode {
  cls: string;
  title: string;
  attempts: Array<{ attempt: number; technique: string }>;
  verdicts: Record<number, EvVerdict["verdict"]>;
}

function buildTree(events: Ev[]): ClassNode[] {
  const order: string[] = [];
  const map = new Map<string, ClassNode>();

  for (const ev of events) {
    if (ev.type === "class_start") {
      const cs = ev as EvClassStart;
      if (!map.has(cs.cls)) {
        map.set(cs.cls, { cls: cs.cls, title: cs.title, attempts: [], verdicts: {} });
        order.push(cs.cls);
      }
    } else if (ev.type === "attack_fired") {
      const af = ev as EvAttackFired;
      const node = map.get(af.cls);
      if (node) {
        node.attempts.push({ attempt: af.attempt, technique: af.technique });
      }
    } else if (ev.type === "verdict") {
      const vd = ev as EvVerdict;
      const node = map.get(vd.cls);
      if (node) {
        node.verdicts[vd.attempt] = vd.verdict;
      }
    }
  }
  return order.map((k) => map.get(k)!).filter(Boolean);
}

export default function CampaignTree({ events }: Props) {
  const tree = buildTree(events);

  return (
    <section
      style={{
        overflow: "auto",
        padding: 12,
        background: "#11151a",
        borderRadius: 12,
        border: "1px solid #1c222a",
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 14, opacity: 0.8 }}>
        Campaign
      </h3>
      {tree.length === 0 && (
        <p style={{ opacity: 0.5, fontSize: 13 }}>
          No campaign running. Click <b>Run attack</b> on the right.
        </p>
      )}
      {tree.map((node) => (
        <div
          key={node.cls}
          style={{
            padding: 10,
            border: "1px solid #1f2630",
            borderRadius: 10,
            margin: "8px 0",
            background: "#0f1318",
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 13 }}>{node.title}</div>
          <div style={{ marginTop: 6 }}>
            {node.attempts.map((a) => {
              const v = node.verdicts[a.attempt];
              const color = v ? VERDICT_COLOR[v] : "#5a6573";
              return (
                <div
                  key={a.attempt}
                  style={{
                    fontSize: 12,
                    marginLeft: 8,
                    opacity: 0.9,
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "3px 0",
                  }}
                >
                  <span style={{ opacity: 0.85 }}>
                    #{a.attempt} → <code>{a.technique}</code>
                  </span>
                  <span style={{ color, fontWeight: 600 }}>
                    {v ? v.toUpperCase() : "…"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
