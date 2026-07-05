"use client";

// Daily log form. On submit the rule engine runs synchronously and the
// resulting alert (if any) is shown immediately with its full explanation —
// this is the app's core "aha" moment.

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Button, Card, Field, inputCls, TRIAGE_COPY, SeverityBadge } from "@/components/ui";
import { SYMPTOMS } from "@/lib/data/symptoms";

interface EngineAlert {
  severity: string;
  triage: string;
  score: number;
  title: string;
  reasons: string[];
  tips: string[];
  suggestBooking: boolean;
}

const STOOLS = ["normal", "soft", "diarrhea", "constipated", "bloody"];

export default function LogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [petName, setPetName] = useState("");
  const [form, setForm] = useState({
    log_date: new Date().toISOString().slice(0, 10),
    food_grams: "",
    water_ml: "",
    activity_min: "",
    weight_kg: "",
    sleep_hours: "",
    stool: "normal",
    notes: "",
  });
  const [symptoms, setSymptoms] = useState<Set<string>>(new Set());
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<EngineAlert | null | "none">(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<{ pet: { name: string } }>(`/api/pets/${id}`).then((d) => setPetName(d.pet.name));
  }, [id]);

  function toggle(key: string) {
    setSymptoms((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  }

  function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2_000_000) {
      setError("Photo must be under 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const num = (v: string) => (v === "" ? null : Number(v));
      const res = await api<{ alert: EngineAlert | null }>(`/api/pets/${id}/logs`, {
        method: "POST",
        body: JSON.stringify({
          log_date: form.log_date,
          food_grams: num(form.food_grams),
          water_ml: num(form.water_ml),
          activity_min: num(form.activity_min),
          weight_kg: num(form.weight_kg),
          sleep_hours: num(form.sleep_hours),
          stool: form.stool,
          symptoms: Array.from(symptoms),
          notes: form.notes || null,
          photo,
        }),
      });
      setResult(res.alert ?? "none");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /* Post-submit: show engine verdict */
  if (result) {
    const alert = result === "none" ? null : result;
    const triage = alert ? TRIAGE_COPY[alert.triage] : null;
    return (
      <Card className="mx-auto max-w-2xl p-8">
        {!alert ? (
          <>
            <div className="text-4xl">✅</div>
            <h1 className="mt-2 font-display text-2xl font-bold text-stone-900">
              All clear — log saved
            </h1>
            <p className="mt-1 text-sm text-stone-600">
              Nothing in today&apos;s entry crossed a threshold against {petName}&apos;s baseline. Keep it up —
              consistent logs make the engine sharper.
            </p>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <SeverityBadge severity={alert.severity} />
              <span className="text-xs text-stone-400">triage score {alert.score}</span>
            </div>
            <h1 className="mt-2 font-display text-2xl font-bold text-stone-900">{alert.title}</h1>
            {triage && (
              <div className={`mt-4 rounded-xl border px-4 py-3 ${triage.style}`}>
                <div className="font-semibold">{triage.title}</div>
                <div className="mt-0.5 text-sm opacity-90">{triage.body}</div>
              </div>
            )}
            <div className="mt-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                Why the engine flagged this
              </div>
              <ul className="mt-2 space-y-1.5">
                {alert.reasons.map((r, i) => (
                  <li key={i} className="flex gap-2 text-sm text-stone-700">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-stone-300" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
            {alert.tips.length > 0 && (
              <div className="mt-4 rounded-xl bg-stone-50 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-stone-400">What to do</div>
                <ul className="mt-1 list-inside list-disc space-y-1 text-sm text-stone-600">
                  {alert.tips.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
        <div className="mt-6 flex flex-wrap gap-2">
          {alert?.triage === "emergency" && (
            <Button href={`/vets?emergency=1&book=${id}`} variant="danger">
              Find 24-hr emergency vet now
            </Button>
          )}
          {alert?.triage === "vet48" && <Button href={`/vets?book=${id}`}>Book a vet (within 48h)</Button>}
          <Button href={`/pets/${id}`} variant="secondary">
            Back to {petName || "pet"}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-2xl p-8">
      <h1 className="font-display text-2xl font-bold text-stone-900">
        Daily log {petName && `— ${petName}`}
      </h1>
      <p className="mt-1 text-sm text-stone-500">
        30 seconds a day. Leave anything unknown blank — the engine only reasons over what you give it.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Date">
            <input className={inputCls} type="date" max={new Date().toISOString().slice(0, 10)} value={form.log_date} onChange={(e) => setForm((f) => ({ ...f, log_date: e.target.value }))} />
          </Field>
          <Field label="Food eaten (g)">
            <input className={inputCls} type="number" min="0" placeholder="e.g. 400" value={form.food_grams} onChange={(e) => setForm((f) => ({ ...f, food_grams: e.target.value }))} />
          </Field>
          <Field label="Water drunk (ml)">
            <input className={inputCls} type="number" min="0" placeholder="e.g. 900" value={form.water_ml} onChange={(e) => setForm((f) => ({ ...f, water_ml: e.target.value }))} />
          </Field>
          <Field label="Activity (min)">
            <input className={inputCls} type="number" min="0" placeholder="e.g. 90" value={form.activity_min} onChange={(e) => setForm((f) => ({ ...f, activity_min: e.target.value }))} />
          </Field>
          <Field label="Weight (kg)">
            <input className={inputCls} type="number" min="0" step="0.05" placeholder="optional" value={form.weight_kg} onChange={(e) => setForm((f) => ({ ...f, weight_kg: e.target.value }))} />
          </Field>
          <Field label="Sleep (hours)">
            <input className={inputCls} type="number" min="0" max="24" step="0.5" placeholder="e.g. 12" value={form.sleep_hours} onChange={(e) => setForm((f) => ({ ...f, sleep_hours: e.target.value }))} />
          </Field>
        </div>

        <Field label="Stool">
          <div className="flex flex-wrap gap-1.5">
            {STOOLS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setForm((f) => ({ ...f, stool: s }))}
                className={`rounded-xl border px-3 py-1.5 text-sm capitalize transition ${
                  form.stool === s
                    ? s === "bloody"
                      ? "border-rose-600 bg-rose-50 text-rose-800"
                      : "border-teal-600 bg-teal-50 text-teal-800"
                    : "border-stone-200 text-stone-600 hover:bg-stone-50"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Symptoms observed" hint="Tap all that apply — each carries a weight in the triage score.">
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {SYMPTOMS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => toggle(s.key)}
                className={`rounded-xl border px-3 py-2 text-left text-xs transition ${
                  symptoms.has(s.key)
                    ? s.emergency
                      ? "border-rose-600 bg-rose-50 text-rose-900"
                      : "border-amber-500 bg-amber-50 text-amber-900"
                    : "border-stone-200 text-stone-600 hover:bg-stone-50"
                }`}
              >
                {s.label}
                {s.emergency && <span className="ml-1 text-rose-500">⚠</span>}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Photo (rash, injury, etc.)" hint="Stored with today's entry. Max 2 MB.">
            <input ref={fileRef} type="file" accept="image/*" onChange={onPhoto} className="block w-full text-sm text-stone-500 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-teal-700" />
            {photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="attachment preview" className="mt-2 h-20 rounded-lg object-cover" />
            )}
          </Field>
          <Field label="Notes">
            <textarea className={inputCls} rows={3} placeholder="Anything unusual…" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </Field>
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={busy} className="flex-1">
            {busy ? "Running rule engine…" : "Save & evaluate"}
          </Button>
          <Button variant="secondary" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
