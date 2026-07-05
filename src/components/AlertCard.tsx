"use client";

// Explainable alert card — renders the full "why this fired" reasoning chain,
// the triage banner, self-care tips, and severity-appropriate actions
// (acknowledge / book within 48h / find emergency vet now).

import { useState } from "react";
import { Card, SeverityBadge, TRIAGE_COPY, Button } from "./ui";
import { api, fmtDateTime } from "@/lib/client";

export interface AlertRow {
  id: number;
  pet_id: number;
  severity: string;
  triage: string;
  title: string;
  score: number;
  reasons: string; // JSON
  tips: string; // JSON
  contagion_source_pet_id: number | null;
  acknowledged: number;
  created_at: string;
}

export default function AlertCard({
  alert,
  petName,
  onAcknowledged,
}: {
  alert: AlertRow;
  petName?: string;
  onAcknowledged?: (id: number) => void;
}) {
  const [acked, setAcked] = useState(alert.acknowledged === 1);
  const [expanded, setExpanded] = useState(alert.acknowledged === 0);
  const reasons: string[] = JSON.parse(alert.reasons || "[]");
  const tips: string[] = JSON.parse(alert.tips || "[]");
  const triage = TRIAGE_COPY[alert.triage] ?? TRIAGE_COPY.home;

  async function acknowledge() {
    await api(`/api/alerts/${alert.id}`, { method: "PATCH" });
    setAcked(true);
    onAcknowledged?.(alert.id);
  }

  return (
    <Card className={`overflow-hidden ${acked ? "opacity-70" : ""}`}>
      <button
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-center gap-3">
          <SeverityBadge severity={alert.severity} />
          <div>
            <div className="text-sm font-semibold text-stone-800">
              {alert.contagion_source_pet_id ? "🦠 " : ""}
              {alert.title}
            </div>
            <div className="text-xs text-stone-500">
              {petName ? `${petName} · ` : ""}
              {fmtDateTime(alert.created_at)}
              {alert.score > 0 && ` · triage score ${alert.score}`}
              {acked && " · acknowledged"}
            </div>
          </div>
        </div>
        <span className="text-stone-400">{expanded ? "▾" : "▸"}</span>
      </button>

      {expanded && (
        <div className="border-t border-stone-100 px-4 pb-4">
          <div className={`mt-3 rounded-xl border px-3 py-2 text-sm ${triage.style}`}>
            <div className="font-semibold">{triage.title}</div>
            <div className="mt-0.5 text-xs opacity-90">{triage.body}</div>
          </div>

          <div className="mt-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-stone-400">
              Why this alert fired
            </div>
            <ul className="mt-1.5 space-y-1.5">
              {reasons.map((r, i) => (
                <li key={i} className="flex gap-2 text-sm text-stone-700">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-stone-300" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>

          {tips.length > 0 && (
            <div className="mt-3 rounded-xl bg-stone-50 px-3 py-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                What to do
              </div>
              <ul className="mt-1 list-inside list-disc space-y-1 text-sm text-stone-600">
                {tips.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {alert.triage === "emergency" && (
              <Button href={`/vets?emergency=1&book=${alert.pet_id}&alert=${alert.id}`} variant="danger">
                Find 24-hr emergency vet
              </Button>
            )}
            {alert.triage === "vet48" && (
              <Button href={`/vets?book=${alert.pet_id}&alert=${alert.id}`}>Book a vet visit</Button>
            )}
            {!acked && (
              <Button variant="secondary" onClick={acknowledge}>
                Acknowledge
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
