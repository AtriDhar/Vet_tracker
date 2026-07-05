// Exportable vet report — server-rendered, print-optimized.
// "Print / Save as PDF" uses the browser's print-to-PDF: zero dependencies,
// works offline, and the print stylesheet strips all app chrome.

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { breedRisksFor } from "@/lib/data/breeds";
import { SYMPTOM_MAP } from "@/lib/data/symptoms";
import PrintButton from "@/components/PrintButton";
import { ageString } from "@/lib/client";

export const dynamic = "force-dynamic";

interface Log {
  log_date: string;
  food_grams: number | null;
  water_ml: number | null;
  activity_min: number | null;
  weight_kg: number | null;
  sleep_hours: number | null;
  stool: string | null;
  symptoms: string;
  notes: string | null;
}

function stats(vals: (number | null)[]): string {
  const v = vals.filter((x): x is number => x != null);
  if (!v.length) return "—";
  const avg = v.reduce((a, b) => a + b, 0) / v.length;
  return `${Math.min(...v)}–${Math.max(...v)} (avg ${Math.round(avg * 10) / 10})`;
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const d = db();
  const pet = d.prepare("SELECT * FROM pets WHERE id = ? AND user_id = ?").get(Number(id), user.id) as
    | Record<string, unknown>
    | undefined;
  if (!pet) notFound();

  const logs = d
    .prepare("SELECT * FROM logs WHERE pet_id = ? ORDER BY log_date DESC LIMIT 14")
    .all(id) as unknown as Log[];
  const alerts = d
    .prepare("SELECT * FROM alerts WHERE pet_id = ? ORDER BY created_at DESC LIMIT 10")
    .all(id) as Array<Record<string, unknown>>;
  const reminders = d.prepare("SELECT * FROM reminders WHERE pet_id = ? ORDER BY due_date").all(id) as Array<
    Record<string, unknown>
  >;
  const risks = breedRisksFor(pet.species as string, pet.breed as string | null);

  const age = ageString(pet.birth_date as string | null);

  return (
    <div className="print-page mx-auto max-w-3xl rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between border-b-2 border-stone-800 pb-4">
        <div>
          <div className="font-display text-2xl font-bold text-stone-900">🐾 VetTracker Health Report</div>
          <div className="mt-1 text-sm text-stone-500">
            Generated {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} ·
            prepared for veterinary consultation
          </div>
        </div>
        <div className="flex gap-2">
          <PrintButton />
          <Link href={`/pets/${id}`} className="no-print rounded-xl border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">
            Back
          </Link>
        </div>
      </div>

      {/* Patient */}
      <section className="mt-6">
        <h2 className="font-display text-lg font-bold text-stone-800">Patient</h2>
        <div className="mt-2 grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:grid-cols-3">
          <div><span className="text-stone-400">Name:</span> <strong>{pet.name as string}</strong></div>
          <div><span className="text-stone-400">Species:</span> {pet.species as string}</div>
          <div><span className="text-stone-400">Breed:</span> {(pet.breed as string) ?? "—"}</div>
          <div><span className="text-stone-400">Sex:</span> {(pet.sex as string) ?? "—"}</div>
          <div><span className="text-stone-400">Age:</span> {age}</div>
          <div><span className="text-stone-400">Weight:</span> {pet.weight_kg != null ? `${pet.weight_kg} kg` : "—"}</div>
          <div className="col-span-2 sm:col-span-3">
            <span className="text-stone-400">Owner:</span> {user.name}
            {user.phone ? ` · ${user.phone}` : ""}
          </div>
          {typeof pet.notes === "string" && pet.notes && (
            <div className="col-span-2 sm:col-span-3">
              <span className="text-stone-400">History notes:</span> {pet.notes}
            </div>
          )}
        </div>
      </section>

      {/* 14-day summary */}
      <section className="mt-6">
        <h2 className="font-display text-lg font-bold text-stone-800">Last 14 days — ranges</h2>
        <div className="mt-2 grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:grid-cols-3">
          <div><span className="text-stone-400">Food (g/day):</span> {stats(logs.map((l) => l.food_grams))}</div>
          <div><span className="text-stone-400">Water (ml/day):</span> {stats(logs.map((l) => l.water_ml))}</div>
          <div><span className="text-stone-400">Activity (min):</span> {stats(logs.map((l) => l.activity_min))}</div>
          <div><span className="text-stone-400">Weight (kg):</span> {stats(logs.map((l) => l.weight_kg))}</div>
          <div><span className="text-stone-400">Sleep (h):</span> {stats(logs.map((l) => l.sleep_hours))}</div>
        </div>
      </section>

      {/* Alerts */}
      <section className="mt-6">
        <h2 className="font-display text-lg font-bold text-stone-800">
          Early-warning alerts (rule-engine output)
        </h2>
        {alerts.length === 0 ? (
          <p className="mt-2 text-sm text-stone-500">No alerts in this period.</p>
        ) : (
          <div className="mt-2 space-y-3">
            {alerts.map((a) => (
              <div key={a.id as number} className="rounded-xl border border-stone-200 p-3">
                <div className="flex items-center justify-between text-sm">
                  <strong className="capitalize">
                    {a.severity === "urgent" ? "🔴" : a.severity === "watch" ? "🟡" : "🔵"}{" "}
                    {a.severity as string} — {a.title as string}
                  </strong>
                  <span className="text-xs text-stone-400">
                    {(a.created_at as string).slice(0, 10)}
                    {(a.score as number) > 0 && ` · score ${a.score}`}
                  </span>
                </div>
                <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-xs text-stone-600">
                  {(JSON.parse(a.reasons as string) as string[]).map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Daily logs */}
      <section className="mt-6">
        <h2 className="font-display text-lg font-bold text-stone-800">Daily log detail</h2>
        <table className="mt-2 w-full text-xs">
          <thead>
            <tr className="border-b border-stone-300 text-left text-[10px] uppercase tracking-wide text-stone-400">
              <th className="py-1 pr-2">Date</th>
              <th className="py-1 pr-2">Food g</th>
              <th className="py-1 pr-2">Water ml</th>
              <th className="py-1 pr-2">Act min</th>
              <th className="py-1 pr-2">Wt kg</th>
              <th className="py-1 pr-2">Sleep h</th>
              <th className="py-1 pr-2">Stool</th>
              <th className="py-1">Symptoms / notes</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => {
              const syms = (JSON.parse(l.symptoms || "[]") as string[])
                .map((s) => SYMPTOM_MAP[s]?.label ?? s)
                .join(", ");
              return (
                <tr key={l.log_date} className="border-b border-stone-100 align-top">
                  <td className="whitespace-nowrap py-1 pr-2">{l.log_date}</td>
                  <td className="py-1 pr-2">{l.food_grams ?? "—"}</td>
                  <td className="py-1 pr-2">{l.water_ml ?? "—"}</td>
                  <td className="py-1 pr-2">{l.activity_min ?? "—"}</td>
                  <td className="py-1 pr-2">{l.weight_kg ?? "—"}</td>
                  <td className="py-1 pr-2">{l.sleep_hours ?? "—"}</td>
                  <td className="py-1 pr-2 capitalize">{l.stool ?? "—"}</td>
                  <td className="py-1">
                    {syms}
                    {syms && l.notes ? " — " : ""}
                    <span className="text-stone-500">{l.notes ?? ""}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* Breed risks + schedule */}
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <section>
          <h2 className="font-display text-lg font-bold text-stone-800">Breed risk profile</h2>
          {risks.length === 0 ? (
            <p className="mt-2 text-sm text-stone-500">No breed-specific entries.</p>
          ) : (
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-stone-600">
              {risks.map((r, i) => (
                <li key={i}>
                  <strong>{r.condition}</strong> — {r.note}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h2 className="font-display text-lg font-bold text-stone-800">Preventive schedule</h2>
          {reminders.length === 0 ? (
            <p className="mt-2 text-sm text-stone-500">None recorded.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm text-stone-600">
              {reminders.map((r) => (
                <li key={r.id as number}>
                  {r.type === "vaccination" ? "💉" : r.type === "medication" ? "💊" : "🩺"}{" "}
                  {r.title as string} — due {r.due_date as string}
                  {r.repeat_days ? ` (every ${r.repeat_days}d)` : ""}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="mt-8 border-t border-stone-200 pt-3 text-[10px] text-stone-400">
        Data is owner-reported via daily logs. Alert reasoning is produced by VetTracker&apos;s
        deterministic rule engine (thresholds vs. the pet&apos;s own rolling baseline, weighted symptom
        scoring, breed-risk modifiers). This report supports — and does not replace — clinical judgment.
      </p>
    </div>
  );
}
