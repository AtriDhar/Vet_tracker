"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, fmtDate, fmtDateTime, ageString, INR } from "@/lib/client";
import { Card, Button, Spinner, EmptyState, inputCls } from "@/components/ui";
import AlertCard, { type AlertRow } from "@/components/AlertCard";
import TrendCharts from "@/components/TrendCharts";
import { SYMPTOM_MAP } from "@/lib/data/symptoms";

interface PetDetail {
  pet: {
    id: number;
    name: string;
    species: string;
    breed: string | null;
    sex: string | null;
    birth_date: string | null;
    weight_kg: number | null;
    photo: string | null;
    notes: string | null;
    share_token: string;
  };
  logs: LogRow[];
  alerts: AlertRow[];
  reminders: ReminderRow[];
  expenses: ExpenseRow[];
  appointments: AppointmentRow[];
  breedRisks: { category: string; condition: string; note: string }[];
}

interface LogRow {
  id: number;
  log_date: string;
  food_grams: number | null;
  water_ml: number | null;
  activity_min: number | null;
  weight_kg: number | null;
  sleep_hours: number | null;
  stool: string | null;
  symptoms: string;
  notes: string | null;
  photo: string | null;
}

interface ReminderRow {
  id: number;
  type: string;
  title: string;
  due_date: string;
  repeat_days: number | null;
}

interface ExpenseRow {
  id: number;
  category: string;
  description: string;
  amount: number;
  expense_date: string;
}

interface AppointmentRow {
  id: number;
  datetime: string;
  reason: string | null;
  status: string;
  vet_name: string;
  clinic: string;
}

const TABS = ["overview", "logs", "alerts", "timeline", "expenses"] as const;
type Tab = (typeof TABS)[number];

export default function PetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const search = useSearchParams();
  const router = useRouter();
  const [data, setData] = useState<PetDetail | null>(null);
  const tab = (TABS.includes(search.get("tab") as Tab) ? search.get("tab") : "overview") as Tab;

  const load = useCallback(() => {
    api<PetDetail>(`/api/pets/${id}`).then(setData).catch(() => router.push("/dashboard"));
  }, [id, router]);

  useEffect(load, [load]);

  if (!data) return <Spinner />;
  const { pet, logs, alerts, reminders, expenses, appointments, breedRisks } = data;
  const openAlerts = alerts.filter((a) => !a.acknowledged).length;

  function setTab(t: Tab) {
    router.replace(`/pets/${id}?tab=${t}`, { scroll: false });
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="text-5xl">{pet.photo ?? "🐾"}</span>
            <div>
              <h1 className="font-display text-2xl font-bold text-stone-900">{pet.name}</h1>
              <div className="text-sm text-stone-500">
                {pet.breed ?? pet.species} · {pet.sex ?? "—"} · {ageString(pet.birth_date)}
                {pet.weight_kg ? ` · ${pet.weight_kg} kg` : ""}
              </div>
              {pet.notes && <p className="mt-1 max-w-lg text-xs text-stone-500">{pet.notes}</p>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button href={`/pets/${pet.id}/log`}>+ Daily log</Button>
            <Button href={`/pets/${pet.id}/report`} variant="secondary">
              📄 Vet report
            </Button>
            <Button href={`/pets/${pet.id}/card`} variant="secondary">
              🆘 QR card
            </Button>
            <Button href={`/pets/${pet.id}/edit`} variant="ghost">
              Edit
            </Button>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-stone-100 p-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 whitespace-nowrap rounded-lg px-4 py-1.5 text-sm font-medium capitalize transition ${
              tab === t ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800"
            }`}
          >
            {t}
            {t === "alerts" && openAlerts > 0 && (
              <span className="ml-1.5 rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {openAlerts}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <Overview logs={logs} breedRisks={breedRisks} reminders={reminders} appointments={appointments} petId={pet.id} />
      )}
      {tab === "logs" && <LogsTab logs={logs} alerts={alerts} />}
      {tab === "alerts" && (
        <div className="space-y-3">
          {alerts.length === 0 ? (
            <EmptyState emoji="✅" title="No alerts" body="Nothing concerning so far. Keep logging daily so the engine can maintain an accurate baseline." />
          ) : (
            alerts.map((a) => <AlertCard key={a.id} alert={a} onAcknowledged={load} />)
          )}
        </div>
      )}
      {tab === "timeline" && <Timeline logs={logs} alerts={alerts} appointments={appointments} expenses={expenses} />}
      {tab === "expenses" && <Expenses petId={pet.id} expenses={expenses} onChange={load} />}
    </div>
  );
}

/* ────────────────────────── Overview ────────────────────────── */

function Overview({
  logs,
  breedRisks,
  reminders,
  appointments,
  petId,
}: {
  logs: LogRow[];
  breedRisks: PetDetail["breedRisks"];
  reminders: ReminderRow[];
  appointments: AppointmentRow[];
  petId: number;
}) {
  const upcoming = appointments.filter((a) => ["pending", "confirmed"].includes(a.status));
  return (
    <div className="space-y-5">
      {logs.length >= 2 ? (
        <TrendCharts logs={logs} />
      ) : (
        <EmptyState
          emoji="📈"
          title="Not enough data for trends yet"
          body="Log at least 3 days so the engine can learn this pet's personal baseline — that's what makes the alerts explainable."
          action={<Button href={`/pets/${petId}/log`}>Add today&apos;s log</Button>}
        />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <h3 className="font-display font-bold text-stone-800">🧬 Breed risk profile</h3>
          {breedRisks.length === 0 ? (
            <p className="mt-2 text-sm text-stone-500">
              No specific risk profile for this breed in our table — general rules apply.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {breedRisks.map((r, i) => (
                <li key={i} className="rounded-xl bg-stone-50 px-3 py-2 text-sm">
                  <span className="font-semibold text-stone-800">{r.condition}</span>
                  <p className="text-xs text-stone-500">{r.note}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="font-display font-bold text-stone-800">⏰ Reminders & visits</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {reminders.map((r) => (
              <li key={r.id} className="flex justify-between rounded-xl bg-stone-50 px-3 py-2">
                <span className="text-stone-700">{r.title}</span>
                <span className="text-xs text-stone-500">
                  due {fmtDate(r.due_date)}
                  {r.repeat_days ? ` · every ${r.repeat_days}d` : ""}
                </span>
              </li>
            ))}
            {upcoming.map((a) => (
              <li key={`ap${a.id}`} className="flex justify-between rounded-xl bg-teal-50 px-3 py-2">
                <span className="text-teal-900">🩺 {a.vet_name}</span>
                <span className="text-xs text-teal-700">
                  {fmtDateTime(a.datetime)} · {a.status}
                </span>
              </li>
            ))}
            {reminders.length + upcoming.length === 0 && (
              <li className="text-stone-500">Nothing scheduled.</li>
            )}
          </ul>
          <AddReminder petId={petId} />
        </Card>
      </div>
    </div>
  );
}

function AddReminder({ petId }: { petId: number }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: "vaccination", title: "", due_date: "", repeat_days: "" });
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await api("/api/reminders", {
      method: "POST",
      body: JSON.stringify({
        pet_id: petId,
        ...form,
        repeat_days: form.repeat_days ? Number(form.repeat_days) : null,
      }),
    });
    setOpen(false);
    setForm({ type: "vaccination", title: "", due_date: "", repeat_days: "" });
    router.refresh();
    window.location.reload();
  }

  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="mt-3 text-sm font-medium text-teal-700 hover:underline">
        + Add reminder
      </button>
    );
  return (
    <form onSubmit={submit} className="mt-3 space-y-2 rounded-xl border border-stone-200 p-3">
      <div className="grid grid-cols-2 gap-2">
        <select className={inputCls} value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
          <option value="vaccination">Vaccination</option>
          <option value="medication">Medication</option>
          <option value="checkup">Checkup</option>
          <option value="grooming">Grooming</option>
        </select>
        <input className={inputCls} type="date" required value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
      </div>
      <input className={inputCls} placeholder="Title, e.g. Rabies booster" required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
      <input className={inputCls} type="number" placeholder="Repeat every N days (optional)" value={form.repeat_days} onChange={(e) => setForm((f) => ({ ...f, repeat_days: e.target.value }))} />
      <div className="flex gap-2">
        <Button type="submit" className="flex-1">Save</Button>
        <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}

/* ────────────────────────── Logs tab (table + calendar) ────────────────────────── */

function LogsTab({ logs, alerts }: { logs: LogRow[]; alerts: AlertRow[] }) {
  const [view, setView] = useState<"table" | "calendar">("table");
  const alertByDate = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of alerts) {
      const d = a.created_at.slice(0, 10);
      // keep worst severity per day
      const prev = m.get(d);
      const rank = (s: string) => (s === "urgent" ? 0 : s === "watch" ? 1 : 2);
      if (!prev || rank(a.severity) < rank(prev)) m.set(d, a.severity);
    }
    return m;
  }, [alerts]);

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-1 rounded-xl bg-stone-100 p-1 text-sm w-fit ml-auto">
        {(["table", "calendar"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`rounded-lg px-3 py-1 capitalize ${view === v ? "bg-white shadow-sm" : "text-stone-500"}`}
          >
            {v}
          </button>
        ))}
      </div>

      {logs.length === 0 && <EmptyState emoji="📝" title="No logs yet" body="Daily logs are the fuel for the early-warning engine." />}

      {view === "table" && logs.length > 0 && (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-400">
                <th className="px-4 py-2">Date</th>
                <th className="px-2 py-2">Food (g)</th>
                <th className="px-2 py-2">Water (ml)</th>
                <th className="px-2 py-2">Activity (min)</th>
                <th className="px-2 py-2">Weight (kg)</th>
                <th className="px-2 py-2">Sleep (h)</th>
                <th className="px-2 py-2">Stool</th>
                <th className="px-2 py-2">Symptoms</th>
                <th className="px-2 py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => {
                const syms: string[] = JSON.parse(l.symptoms || "[]");
                return (
                  <tr key={l.id} className="border-b border-stone-100 align-top hover:bg-stone-50/60">
                    <td className="whitespace-nowrap px-4 py-2 font-medium text-stone-700">{fmtDate(l.log_date)}</td>
                    <td className="px-2 py-2">{l.food_grams ?? "—"}</td>
                    <td className="px-2 py-2">{l.water_ml ?? "—"}</td>
                    <td className="px-2 py-2">{l.activity_min ?? "—"}</td>
                    <td className="px-2 py-2">{l.weight_kg ?? "—"}</td>
                    <td className="px-2 py-2">{l.sleep_hours ?? "—"}</td>
                    <td className="px-2 py-2 capitalize">{l.stool ?? "—"}</td>
                    <td className="px-2 py-2">
                      {syms.length === 0
                        ? "—"
                        : syms.map((s) => (
                            <span key={s} className="mr-1 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
                              {SYMPTOM_MAP[s]?.label ?? s}
                            </span>
                          ))}
                      {l.photo && <span title="photo attached"> 📷</span>}
                    </td>
                    <td className="max-w-[16rem] px-2 py-2 text-xs text-stone-500">{l.notes ?? ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {view === "calendar" && <CalendarView logs={logs} alertByDate={alertByDate} />}
    </div>
  );
}

function CalendarView({ logs, alertByDate }: { logs: LogRow[]; alertByDate: Map<string, string> }) {
  const [offset, setOffset] = useState(0); // months back from current
  const now = new Date();
  const month = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const firstDow = month.getDay();
  const logDates = new Set(logs.map((l) => l.log_date));
  const key = (day: number) =>
    `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => setOffset((o) => o + 1)} className="rounded-lg px-2 py-1 hover:bg-stone-100">←</button>
        <div className="font-display font-bold text-stone-800">
          {month.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
        </div>
        <button onClick={() => setOffset((o) => Math.max(0, o - 1))} className="rounded-lg px-2 py-1 hover:bg-stone-100" disabled={offset === 0}>→</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-stone-400">
        {["S", "M", "T", "W", "T2", "F", "S2"].map((d) => (
          <div key={d}>{d[0]}</div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: firstDow }).map((_, i) => (
          <div key={`pad${i}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const d = key(i + 1);
          const sev = alertByDate.get(d);
          const logged = logDates.has(d);
          return (
            <div
              key={d}
              title={sev ? `${sev} alert` : logged ? "logged" : ""}
              className={`flex h-10 items-center justify-center rounded-lg text-sm ${
                sev === "urgent"
                  ? "bg-rose-100 font-bold text-rose-800"
                  : sev === "watch"
                  ? "bg-amber-100 font-bold text-amber-800"
                  : logged
                  ? "bg-emerald-50 text-emerald-800"
                  : "text-stone-400"
              }`}
            >
              {i + 1}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex gap-4 text-xs text-stone-500">
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-300" />logged</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-400" />watch alert</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-rose-500" />urgent alert</span>
      </div>
    </Card>
  );
}

/* ────────────────────────── Timeline (health story) ────────────────────────── */

interface TimelineEvent {
  date: string;
  sort: string;
  emoji: string;
  title: string;
  body?: string;
  tone: "neutral" | "warn" | "danger" | "good";
}

function Timeline({
  logs,
  alerts,
  appointments,
  expenses,
}: {
  logs: LogRow[];
  alerts: AlertRow[];
  appointments: AppointmentRow[];
  expenses: ExpenseRow[];
}) {
  const events: TimelineEvent[] = [];

  for (const l of logs) {
    const syms: string[] = JSON.parse(l.symptoms || "[]");
    if (syms.length || l.notes) {
      events.push({
        date: l.log_date,
        sort: l.log_date + "T08",
        emoji: "📝",
        title: syms.length
          ? `Logged: ${syms.map((s) => SYMPTOM_MAP[s]?.label ?? s).join(", ")}`
          : "Daily log noted",
        body: l.notes ?? undefined,
        tone: syms.length ? "warn" : "neutral",
      });
    }
  }
  for (const a of alerts) {
    events.push({
      date: a.created_at.slice(0, 10),
      sort: a.created_at,
      emoji: a.severity === "urgent" ? "🚨" : a.severity === "watch" ? "⚠️" : "ℹ️",
      title: a.title,
      body: `Triage: ${a.triage === "emergency" ? "emergency now" : a.triage === "vet48" ? "vet within 48h" : "monitor at home"}${a.score ? ` · score ${a.score}` : ""}`,
      tone: a.severity === "urgent" ? "danger" : a.severity === "watch" ? "warn" : "neutral",
    });
  }
  for (const ap of appointments) {
    events.push({
      date: ap.datetime.slice(0, 10),
      sort: ap.datetime,
      emoji: "🩺",
      title: `${ap.status === "completed" ? "Visited" : ap.status === "cancelled" ? "Cancelled visit to" : "Booked"} ${ap.vet_name} (${ap.clinic})`,
      body: ap.reason ?? undefined,
      tone: ap.status === "completed" ? "good" : "neutral",
    });
  }
  for (const e of expenses.filter((x) => x.category === "vet" || x.category === "medication")) {
    events.push({
      date: e.expense_date,
      sort: e.expense_date + "T20",
      emoji: "💳",
      title: `${e.description} — ${INR.format(e.amount)}`,
      tone: "neutral",
    });
  }

  events.sort((a, b) => (a.sort < b.sort ? 1 : -1));

  const toneCls = {
    neutral: "border-stone-200 bg-white",
    warn: "border-amber-200 bg-amber-50/50",
    danger: "border-rose-200 bg-rose-50/50",
    good: "border-emerald-200 bg-emerald-50/50",
  };

  if (events.length === 0)
    return <EmptyState emoji="🕰" title="No story yet" body="Symptoms, alerts, visits and expenses will build a narrative here." />;

  return (
    <div className="relative ml-3 border-l-2 border-stone-200 pl-6">
      {events.map((e, i) => (
        <div key={i} className="relative pb-5">
          <span className="absolute -left-[2.05rem] flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 bg-white text-sm">
            {e.emoji}
          </span>
          <div className={`rounded-2xl border px-4 py-3 ${toneCls[e.tone]}`}>
            <div className="text-xs font-medium uppercase tracking-wide text-stone-400">{fmtDate(e.date)}</div>
            <div className="mt-0.5 text-sm font-semibold text-stone-800">{e.title}</div>
            {e.body && <div className="mt-0.5 text-xs text-stone-500">{e.body}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ────────────────────────── Expenses ────────────────────────── */

const EXPENSE_EMOJI: Record<string, string> = {
  vet: "🩺",
  medication: "💊",
  food: "🍖",
  grooming: "✂️",
  insurance: "🛡",
  other: "🧸",
};

function Expenses({ petId, expenses, onChange }: { petId: number; expenses: ExpenseRow[]; onChange: () => void }) {
  const [form, setForm] = useState({ category: "vet", description: "", amount: "", expense_date: new Date().toISOString().slice(0, 10) });
  const total = expenses.reduce((a, b) => a + b.amount, 0);
  const byCat = expenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount;
    return acc;
  }, {});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await api("/api/expenses", {
      method: "POST",
      body: JSON.stringify({ pet_id: petId, ...form, amount: Number(form.amount) }),
    });
    setForm((f) => ({ ...f, description: "", amount: "" }));
    onChange();
  }

  async function remove(id: number) {
    await api(`/api/expenses/${id}`, { method: "DELETE" });
    onChange();
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-stone-400">Total spent</div>
          <div className="font-display text-2xl font-bold text-stone-900">{INR.format(total)}</div>
        </Card>
        {Object.entries(byCat)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .map(([cat, amt]) => (
            <Card key={cat} className="p-4">
              <div className="text-xs uppercase tracking-wide text-stone-400">
                {EXPENSE_EMOJI[cat]} {cat}
              </div>
              <div className="font-display text-2xl font-bold text-stone-900">{INR.format(amt)}</div>
            </Card>
          ))}
      </div>

      <Card className="p-4">
        <form onSubmit={submit} className="grid gap-2 sm:grid-cols-5">
          <select className={inputCls} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
            {Object.keys(EXPENSE_EMOJI).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input className={`${inputCls} sm:col-span-2`} placeholder="Description" required value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          <input className={inputCls} type="number" min="0" step="0.01" placeholder="₹ amount" required value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
          <Button type="submit">Add</Button>
        </form>
      </Card>

      <Card>
        {expenses.length === 0 ? (
          <div className="p-6 text-center text-sm text-stone-500">No expenses recorded.</div>
        ) : (
          <ul className="divide-y divide-stone-100">
            {expenses.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-lg">{EXPENSE_EMOJI[e.category] ?? "🧸"}</span>
                <div className="flex-1">
                  <div className="text-sm font-medium text-stone-800">{e.description}</div>
                  <div className="text-xs text-stone-400">{fmtDate(e.expense_date)} · {e.category}</div>
                </div>
                <div className="font-medium text-stone-800">{INR.format(e.amount)}</div>
                <button onClick={() => remove(e.id)} className="ml-2 text-stone-300 hover:text-rose-600" title="Delete">
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
