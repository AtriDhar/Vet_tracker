"use client";

// Vet directory + booking. Supports deep links from alerts:
//   /vets?book=<petId>&alert=<alertId>      → open booking, pre-linked to triage alert
//   /vets?emergency=1&book=<petId>          → emergency mode: 24-hr clinics on top
import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Button, Card, Field, Spinner, inputCls } from "@/components/ui";

interface Vet {
  id: number;
  name: string;
  clinic: string;
  specialty: string;
  city: string;
  address: string;
  phone: string;
  hours: string;
  emergency: number;
  rating: number;
}

interface Pet {
  id: number;
  name: string;
  photo: string | null;
}

function VetsInner() {
  const params = useSearchParams();
  const router = useRouter();
  const emergencyMode = params.get("emergency") === "1";
  const bookPetId = params.get("book");
  const alertId = params.get("alert");

  const [vets, setVets] = useState<Vet[] | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [booking, setBooking] = useState<Vet | null>(null);
  const [form, setForm] = useState({ pet_id: bookPetId ?? "", datetime: "", reason: "" });
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ vets: Vet[] }>("/api/vets").then((d) => setVets(d.vets));
    api<{ pets: Pet[] }>("/api/pets").then((d) => setPets(d.pets));
  }, []);

  if (!vets) return <Spinner />;

  const sorted = emergencyMode ? [...vets].sort((a, b) => b.emergency - a.emergency) : vets;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/api/appointments", {
        method: "POST",
        body: JSON.stringify({
          pet_id: Number(form.pet_id),
          vet_id: booking!.id,
          datetime: form.datetime,
          reason: form.reason || null,
          triage_alert_id: alertId ? Number(alertId) : null,
        }),
      });
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      {emergencyMode && (
        <div className="rounded-2xl border border-rose-300 bg-rose-50 px-5 py-4">
          <div className="font-display text-lg font-bold text-rose-900">
            🔴 Emergency mode — 24-hour clinics first
          </div>
          <p className="mt-1 text-sm text-rose-800">
            Call ahead while travelling — it lets the team prepare. If your pet ingested something,
            bring the packaging.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-stone-900">Find a vet</h1>
        <span className="text-sm text-stone-500">{vets.length} clinics · Bhubaneswar</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {sorted.map((v) => (
          <Card key={v.id} className={`p-5 ${v.emergency ? "border-rose-200" : ""}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-display font-bold text-stone-900">{v.name}</div>
                <div className="text-sm text-stone-600">{v.clinic}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-sm font-semibold text-amber-600">★ {v.rating.toFixed(1)}</span>
                {v.emergency === 1 && (
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-700">
                    24 hr
                  </span>
                )}
              </div>
            </div>
            <dl className="mt-3 space-y-1 text-sm text-stone-600">
              <div>🩺 {v.specialty}</div>
              <div>📍 {v.address}, {v.city}</div>
              <div>🕐 {v.hours}</div>
              <div>📞 <a href={`tel:${v.phone.replace(/\s/g, "")}`} className="text-teal-700 hover:underline">{v.phone}</a></div>
            </dl>
            <div className="mt-4">
              <Button onClick={() => { setBooking(v); setDone(false); }} className="w-full" variant={v.emergency && emergencyMode ? "danger" : "primary"}>
                Book appointment
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Booking modal */}
      {booking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setBooking(null)}>
          <Card className="w-full max-w-md p-6">
            <div onClick={(e) => e.stopPropagation()}>
              {done ? (
                <div className="text-center">
                  <div className="text-4xl">📅</div>
                  <h2 className="mt-2 font-display text-xl font-bold">Request sent</h2>
                  <p className="mt-1 text-sm text-stone-500">
                    {booking.clinic} will confirm shortly. Track it under Appointments.
                  </p>
                  <div className="mt-4 flex justify-center gap-2">
                    <Button onClick={() => router.push("/appointments")}>View appointments</Button>
                    <Button variant="secondary" onClick={() => setBooking(null)}>Close</Button>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="font-display text-xl font-bold text-stone-900">
                    Book with {booking.name}
                  </h2>
                  <p className="text-sm text-stone-500">{booking.clinic} · {booking.hours}</p>
                  {alertId && (
                    <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      This booking is linked to a triage alert — the clinic will see the engine&apos;s
                      reasoning and your pet&apos;s recent logs before you arrive.
                    </p>
                  )}
                  <form onSubmit={submit} className="mt-4 space-y-3">
                    <Field label="Pet">
                      <select className={inputCls} required value={form.pet_id} onChange={(e) => setForm((f) => ({ ...f, pet_id: e.target.value }))}>
                        <option value="">Select…</option>
                        {pets.map((p) => (
                          <option key={p.id} value={p.id}>{p.photo} {p.name}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Date & time">
                      <input className={inputCls} type="datetime-local" required min={new Date().toISOString().slice(0, 16)} value={form.datetime} onChange={(e) => setForm((f) => ({ ...f, datetime: e.target.value }))} />
                    </Field>
                    <Field label="Reason (optional)">
                      <input className={inputCls} placeholder="e.g. vomiting since yesterday" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
                    </Field>
                    {error && <p className="text-sm text-rose-600">{error}</p>}
                    <div className="flex gap-2">
                      <Button type="submit" className="flex-1">Request booking</Button>
                      <Button variant="secondary" onClick={() => setBooking(null)}>Cancel</Button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function VetsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <VetsInner />
    </Suspense>
  );
}
