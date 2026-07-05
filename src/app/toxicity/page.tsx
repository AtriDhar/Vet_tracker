"use client";

// Public medication & food safety checker — deliberately outside the login wall,
// because accidental-ingestion moments are exactly when nobody has time to sign up.

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { Card, inputCls } from "@/components/ui";
import type { ToxEntry } from "@/lib/data/toxicity";

const SEVERITY: Record<string, { label: string; cls: string; emoji: string }> = {
  deadly: { label: "DEADLY — emergency vet now", cls: "border-rose-300 bg-rose-50 text-rose-900", emoji: "☠️" },
  dangerous: { label: "Dangerous — call a vet", cls: "border-orange-300 bg-orange-50 text-orange-900", emoji: "🚨" },
  caution: { label: "Caution — vet guidance advised", cls: "border-amber-300 bg-amber-50 text-amber-900", emoji: "⚠️" },
  safe: { label: "Generally safe in moderation", cls: "border-emerald-300 bg-emerald-50 text-emerald-900", emoji: "✅" },
};

export default function ToxicityPage() {
  const [q, setQ] = useState("");
  const [species, setSpecies] = useState<"dog" | "cat">("dog");
  const [results, setResults] = useState<ToxEntry[]>([]);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!q.trim()) {
        setResults([]);
        setSearched(false);
        return;
      }
      const d = await api<{ results: ToxEntry[] }>(`/api/toxicity?q=${encodeURIComponent(q)}`);
      setResults(d.results);
      setSearched(true);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <Link href="/" className="flex w-fit items-center gap-2 font-display text-lg font-bold text-teal-800">
        <span className="text-xl">🐾</span> VetTracker
      </Link>

      <h1 className="mt-8 font-display text-3xl font-bold text-stone-900">
        ☠️ Can my pet have this?
      </h1>
      <p className="mt-2 text-stone-600">
        Instant lookup against a veterinary toxicity table — foods, human medicines, plants and
        household substances.
      </p>

      <div className="mt-6 flex gap-2">
        <input
          className={`${inputCls} text-base`}
          placeholder='Try "Tylenol", "grapes", "lily", "peanut butter"…'
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
        <div className="flex rounded-xl border border-stone-300 bg-white p-1">
          {(["dog", "cat"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSpecies(s)}
              className={`rounded-lg px-3 text-lg ${species === s ? "bg-teal-50" : "opacity-40"}`}
              title={s}
            >
              {s === "dog" ? "🐕" : "🐈"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {searched && results.length === 0 && (
          <Card className="p-5 text-sm text-stone-600">
            Not in our table. <strong>When in doubt, treat it as unsafe</strong> and call a vet or an
            animal poison helpline before giving anything.
          </Card>
        )}
        {results.map((r) => {
          const sev = SEVERITY[r[species]];
          return (
            <div key={r.name} className={`rounded-2xl border px-5 py-4 ${sev.cls}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="font-display text-lg font-bold">
                  {sev.emoji} {r.name}
                </div>
                <span className="text-xs font-bold uppercase tracking-wide">{sev.label}</span>
              </div>
              <p className="mt-1 text-sm opacity-90">{r.note}</p>
              {r.dog !== r.cat && (
                <p className="mt-2 text-xs font-medium opacity-75">
                  🐕 dogs: {r.dog} · 🐈 cats: {r.cat} — species matters here.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {(results.some((r) => r[species] === "deadly" || r[species] === "dangerous")) && (
        <div className="mt-6 rounded-2xl border border-rose-300 bg-white p-5">
          <div className="font-semibold text-rose-800">If ingestion already happened:</div>
          <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-stone-700">
            <li>Note what, how much, and when.</li>
            <li>Do NOT induce vomiting unless a vet tells you to.</li>
            <li>
              <Link href="/vets?emergency=1" className="font-medium text-teal-700 underline">
                Find a 24-hour emergency vet →
              </Link>
            </li>
          </ol>
        </div>
      )}

      <p className="mt-10 text-xs text-stone-400">
        Educational lookup, not a diagnosis. Dosage and pet-specific factors change everything —
        always confirm with a licensed veterinarian.
      </p>
    </main>
  );
}
