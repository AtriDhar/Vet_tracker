"use client";

import { useCallback, useEffect, useState } from "react";
import { api, fmtDateTime } from "@/lib/client";
import { Button, Card, EmptyState, Spinner } from "@/components/ui";

interface Appointment {
  id: number;
  datetime: string;
  reason: string | null;
  status: string;
  pet_name: string;
  vet_name: string;
  clinic: string;
  vet_address: string;
  vet_phone: string;
  emergency: number;
}

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-emerald-100 text-emerald-800",
  completed: "bg-stone-100 text-stone-600",
  cancelled: "bg-rose-100 text-rose-700 line-through",
};

export default function AppointmentsPage() {
  const [rows, setRows] = useState<Appointment[] | null>(null);

  const load = useCallback(() => {
    api<{ appointments: Appointment[] }>("/api/appointments").then((d) => setRows(d.appointments));
  }, []);
  useEffect(load, [load]);

  async function cancel(id: number) {
    await api(`/api/appointments/${id}`, { method: "PATCH", body: JSON.stringify({ status: "cancelled" }) });
    load();
  }

  if (!rows) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-stone-900">Appointments</h1>
        <Button href="/vets">+ Book new</Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          emoji="📅"
          title="No appointments"
          body="Book from the vet directory, or let an urgent alert auto-suggest one."
          action={<Button href="/vets">Find a vet</Button>}
        />
      ) : (
        <div className="space-y-3">
          {rows.map((a) => (
            <Card key={a.id} className="flex flex-wrap items-center gap-4 p-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-stone-800">{a.pet_name}</span>
                  <span className="text-stone-400">→</span>
                  <span className="text-stone-700">{a.vet_name}</span>
                  {a.emergency === 1 && (
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-700">24hr</span>
                  )}
                </div>
                <div className="text-sm text-stone-500">
                  {a.clinic} · {a.vet_address}
                </div>
                {a.reason && <div className="mt-1 text-xs text-stone-500">Reason: {a.reason}</div>}
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-stone-800">{fmtDateTime(a.datetime)}</div>
                <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLE[a.status]}`}>
                  {a.status}
                </span>
              </div>
              {["pending", "confirmed"].includes(a.status) && (
                <Button variant="ghost" onClick={() => cancel(a.id)}>
                  Cancel
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
