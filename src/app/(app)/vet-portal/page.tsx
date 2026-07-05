"use client";

// Vet-side portal: incoming appointments ordered by triage severity, with the
// engine's full reasoning and the pet's context pre-loaded — the B2B2C angle.

import { useCallback, useEffect, useState } from "react";
import { api, fmtDateTime, ageString } from "@/lib/client";
import { Button, Card, EmptyState, SeverityBadge, Spinner } from "@/components/ui";

interface VetAppointment {
  id: number;
  datetime: string;
  reason: string | null;
  status: string;
  pet_name: string;
  species: string;
  breed: string | null;
  birth_date: string | null;
  weight_kg: number | null;
  pet_notes: string | null;
  owner_name: string;
  owner_phone: string | null;
  triage_severity: string | null;
  triage_score: number | null;
  triage_reasons: string | null;
}

export default function VetPortal() {
  const [rows, setRows] = useState<VetAppointment[] | null>(null);
  const [role, setRole] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ appointments: VetAppointment[]; role: string }>("/api/appointments").then((d) => {
      setRows(d.appointments);
      setRole(d.role);
    });
  }, []);
  useEffect(load, [load]);

  async function setStatus(id: number, status: string) {
    await api(`/api/appointments/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    load();
  }

  if (!rows) return <Spinner />;
  if (role !== "vet")
    return (
      <EmptyState
        emoji="🩺"
        title="Vet accounts only"
        body="This portal shows incoming triage-flagged patients for clinic staff. Sign in with the demo vet account: vet@vettracker.app / vet1234."
      />
    );

  const active = rows.filter((r) => ["pending", "confirmed"].includes(r.status));
  const past = rows.filter((r) => !["pending", "confirmed"].includes(r.status));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-stone-900">Incoming patients</h1>
        <p className="text-sm text-stone-500">
          Triage-flagged bookings arrive with the alert engine&apos;s reasoning and recent history —
          read it before the consult, not during.
        </p>
      </div>

      {active.length === 0 && <EmptyState emoji="🎉" title="Queue is clear" body="No pending or confirmed appointments." />}

      <div className="space-y-4">
        {active.map((a) => {
          const reasons: string[] = a.triage_reasons ? JSON.parse(a.triage_reasons) : [];
          return (
            <Card key={a.id} className={`p-5 ${a.triage_severity === "urgent" ? "border-rose-300" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-lg font-bold text-stone-900">{a.pet_name}</span>
                    {a.triage_severity && <SeverityBadge severity={a.triage_severity} />}
                    {a.triage_score != null && a.triage_score > 0 && (
                      <span className="text-xs text-stone-400">score {a.triage_score}</span>
                    )}
                  </div>
                  <div className="text-sm text-stone-500">
                    {a.breed ?? a.species} · {ageString(a.birth_date)}
                    {a.weight_kg ? ` · ${a.weight_kg} kg` : ""} · owner {a.owner_name}
                    {a.owner_phone ? ` (${a.owner_phone})` : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-stone-800">{fmtDateTime(a.datetime)}</div>
                  <div className="text-xs capitalize text-stone-500">{a.status}</div>
                </div>
              </div>

              {a.reason && (
                <div className="mt-2 text-sm text-stone-600">
                  <span className="font-medium">Owner&apos;s note:</span> {a.reason}
                </div>
              )}
              {a.pet_notes && (
                <div className="mt-1 text-xs text-stone-500">
                  <span className="font-medium">Medical history:</span> {a.pet_notes}
                </div>
              )}

              {reasons.length > 0 && (
                <div className="mt-3 rounded-xl bg-stone-50 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                    Engine triage reasoning
                  </div>
                  <ul className="mt-1.5 space-y-1 text-sm text-stone-700">
                    {reasons.map((r, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-stone-300" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-4 flex gap-2">
                {a.status === "pending" && (
                  <Button onClick={() => setStatus(a.id, "confirmed")}>Confirm</Button>
                )}
                {a.status === "confirmed" && (
                  <Button onClick={() => setStatus(a.id, "completed")}>Mark completed</Button>
                )}
                <Button variant="secondary" onClick={() => setStatus(a.id, "cancelled")}>
                  Decline
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {past.length > 0 && (
        <div>
          <h2 className="mb-2 font-display text-lg font-bold text-stone-700">History</h2>
          <div className="space-y-2">
            {past.map((a) => (
              <Card key={a.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span>
                  {a.pet_name} · {a.owner_name}
                </span>
                <span className="text-stone-500">
                  {fmtDateTime(a.datetime)} · <span className="capitalize">{a.status}</span>
                </span>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
