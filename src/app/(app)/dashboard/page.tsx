"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, fmtDate, ageString } from "@/lib/client";
import { Card, Button, Spinner, EmptyState, SEVERITY_STYLES } from "@/components/ui";

interface PetSummary {
  id: number;
  name: string;
  species: string;
  breed: string | null;
  birth_date: string | null;
  weight_kg: number | null;
  photo: string | null;
  log_count: number;
  open_alerts: number;
  worst_severity: string | null;
  last_log_date: string | null;
}

interface Reminder {
  id: number;
  pet_name: string;
  type: string;
  title: string;
  due_date: string;
}

const REMINDER_EMOJI: Record<string, string> = {
  vaccination: "💉",
  medication: "💊",
  checkup: "🩺",
  grooming: "✂️",
};

export default function Dashboard() {
  const [pets, setPets] = useState<PetSummary[] | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const [weekAhead] = useState(() => new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10));

  useEffect(() => {
    api<{ pets: PetSummary[] }>("/api/pets").then((d) => setPets(d.pets));
    api<{ reminders: Reminder[] }>("/api/reminders").then((d) => setReminders(d.reminders));
  }, []);

  if (!pets) return <Spinner />;

  const dueSoon = reminders.filter((r) => r.due_date <= weekAhead);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-stone-900">Your pets</h1>
        <Button href="/pets/new">+ Add a pet</Button>
      </div>

      {pets.length === 0 ? (
        <EmptyState
          emoji="🐾"
          title="No pets yet"
          body="Add your first pet to start building their health baseline. The engine needs about 3 days of logs before trend alerts kick in."
          action={<Button href="/pets/new">Add your first pet</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pets.map((p) => {
            const sev = p.worst_severity ? SEVERITY_STYLES[p.worst_severity] : null;
            const loggedToday = p.last_log_date === today;
            return (
              <Card key={p.id} className="p-5 transition-shadow hover:shadow-md">
                <Link href={`/pets/${p.id}`} className="block">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-4xl">{p.photo ?? "🐾"}</span>
                      <div>
                        <div className="font-display text-lg font-bold text-stone-900">{p.name}</div>
                        <div className="text-xs text-stone-500">
                          {p.breed ?? p.species} · {ageString(p.birth_date)}
                          {p.weight_kg ? ` · ${p.weight_kg} kg` : ""}
                        </div>
                      </div>
                    </div>
                    {sev && (
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${sev.badge}`}>
                        {p.open_alerts} alert{p.open_alerts > 1 ? "s" : ""} · {sev.label.toLowerCase()}
                      </span>
                    )}
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs text-stone-500">
                    <span>{p.log_count} logs · last {fmtDate(p.last_log_date)}</span>
                    {loggedToday ? (
                      <span className="font-medium text-emerald-600">✓ logged today</span>
                    ) : (
                      <span className="font-medium text-amber-600">not logged today</span>
                    )}
                  </div>
                </Link>
                <div className="mt-4 flex gap-2">
                  <Button href={`/pets/${p.id}/log`} className="flex-1">
                    Log today
                  </Button>
                  <Button href={`/pets/${p.id}`} variant="secondary" className="flex-1">
                    Profile
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {dueSoon.length > 0 && (
        <div>
          <h2 className="mb-3 font-display text-lg font-bold text-stone-900">
            Due in the next 7 days
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {dueSoon.map((r) => {
              const overdue = r.due_date < today;
              return (
                <Card key={r.id} className={`flex items-center gap-3 px-4 py-3 ${overdue ? "border-rose-200 bg-rose-50/40" : ""}`}>
                  <span className="text-xl">{REMINDER_EMOJI[r.type] ?? "⏰"}</span>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-stone-800">
                      {r.title} — {r.pet_name}
                    </div>
                    <div className={`text-xs ${overdue ? "font-semibold text-rose-600" : "text-stone-500"}`}>
                      {overdue ? "Overdue since " : "Due "}
                      {fmtDate(r.due_date)}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
