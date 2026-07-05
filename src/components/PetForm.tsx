"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Button, Card, Field, inputCls } from "./ui";

const EMOJI_CHOICES = ["🐕", "🐶", "🦮", "🐕‍🦺", "🐩", "🐈", "🐱", "🐈‍⬛", "🐇", "🦜", "🐹", "🐢"];

export interface PetFormValues {
  name: string;
  species: string;
  breed: string;
  sex: string;
  birth_date: string;
  weight_kg: string;
  photo: string;
  notes: string;
}

export default function PetForm({
  petId,
  initial,
}: {
  petId?: number;
  initial?: Partial<PetFormValues>;
}) {
  const router = useRouter();
  const [form, setForm] = useState<PetFormValues>({
    name: initial?.name ?? "",
    species: initial?.species ?? "dog",
    breed: initial?.breed ?? "",
    sex: initial?.sex ?? "",
    birth_date: initial?.birth_date ?? "",
    weight_kg: initial?.weight_kg ?? "",
    photo: initial?.photo ?? "🐕",
    notes: initial?.notes ?? "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function set(k: keyof PetFormValues, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = {
        ...form,
        weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
        breed: form.breed || null,
        sex: form.sex || null,
        birth_date: form.birth_date || null,
        notes: form.notes || null,
      };
      if (petId) {
        await api(`/api/pets/${petId}`, { method: "PUT", body: JSON.stringify(payload) });
        router.push(`/pets/${petId}`);
      } else {
        const res = await api<{ id: number }>("/api/pets", { method: "POST", body: JSON.stringify(payload) });
        router.push(`/pets/${res.id}/log?first=1`);
      }
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Card className="mx-auto max-w-xl p-8">
      <h1 className="font-display text-2xl font-bold text-stone-900">
        {petId ? "Edit pet profile" : "Add a pet"}
      </h1>
      {!petId && (
        <p className="mt-1 text-sm text-stone-500">
          Breed matters: it feeds the breed-specific risk rules (e.g. Persians → kidney disease,
          Labradors → joints).
        </p>
      )}

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Name">
            <input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} required autoFocus />
          </Field>
          <Field label="Species">
            <select className={inputCls} value={form.species} onChange={(e) => set("species", e.target.value)}>
              <option value="dog">Dog</option>
              <option value="cat">Cat</option>
              <option value="other">Other</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Breed" hint="e.g. Labrador Retriever, Persian, Indie">
            <input className={inputCls} value={form.breed} onChange={(e) => set("breed", e.target.value)} />
          </Field>
          <Field label="Sex">
            <select className={inputCls} value={form.sex} onChange={(e) => set("sex", e.target.value)}>
              <option value="">—</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Date of birth (approx.)">
            <input className={inputCls} type="date" value={form.birth_date} onChange={(e) => set("birth_date", e.target.value)} />
          </Field>
          <Field label="Weight (kg)">
            <input className={inputCls} type="number" step="0.1" min="0" value={form.weight_kg} onChange={(e) => set("weight_kg", e.target.value)} />
          </Field>
        </div>
        <Field label="Avatar">
          <div className="flex flex-wrap gap-1.5">
            {EMOJI_CHOICES.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => set("photo", e)}
                className={`rounded-xl border px-2.5 py-1.5 text-xl transition ${
                  form.photo === e ? "border-teal-600 bg-teal-50" : "border-stone-200 hover:bg-stone-50"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Medical history notes" hint="Allergies, past surgeries, chronic conditions, current medication — this appears on the vet report and QR emergency card.">
          <textarea className={inputCls} rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={busy} className="flex-1">
            {busy ? "Saving…" : petId ? "Save changes" : "Add pet"}
          </Button>
          <Button variant="secondary" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
