// PUBLIC emergency pet card — reachable by share token only, no auth.
// Shown when someone scans the QR on a lost/injured pet's collar.

import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";

// No cookies are read here, so opt out of static prerendering explicitly:
// the card must always reflect the current DB row.
export const dynamic = "force-dynamic";

export default async function PublicCard({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const row = db()
    .prepare(
      `SELECT p.name, p.species, p.breed, p.sex, p.weight_kg, p.photo, p.notes,
              u.name AS owner_name, u.phone, u.address
       FROM pets p JOIN users u ON u.id = p.user_id WHERE p.share_token = ?`
    )
    .get(token) as Record<string, string | number | null> | undefined;
  if (!row) notFound();

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-3xl border-2 border-teal-700 bg-white p-6 shadow-lg">
        <div className="text-center">
          <div className="text-6xl">{(row.photo as string) ?? "🐾"}</div>
          <h1 className="mt-2 font-display text-3xl font-bold text-stone-900">{row.name}</h1>
          <div className="text-stone-600">
            {(row.breed as string) ?? row.species}
            {row.sex ? ` · ${row.sex}` : ""}
            {row.weight_kg ? ` · ${row.weight_kg} kg` : ""}
          </div>
        </div>

        {row.notes && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <div className="text-xs font-bold uppercase tracking-wide">⚕ Medical notes</div>
            {row.notes}
          </div>
        )}

        <div className="mt-4 rounded-xl bg-teal-50 px-4 py-3 text-center">
          <div className="text-xs font-bold uppercase tracking-wide text-teal-700">
            This pet&apos;s human
          </div>
          <div className="mt-1 font-semibold text-stone-800">{row.owner_name}</div>
          {row.phone && (
            <a
              href={`tel:${String(row.phone).replace(/\s/g, "")}`}
              className="mt-2 block rounded-xl bg-teal-700 py-3 font-display text-lg font-bold text-white hover:bg-teal-800"
            >
              📞 {row.phone}
            </a>
          )}
          {row.address && <div className="mt-2 text-xs text-stone-500">{row.address}</div>}
        </div>

        <p className="mt-4 text-center text-xs text-stone-400">
          Found this pet injured?{" "}
          <Link href="/toxicity" className="underline">
            Check toxicity
          </Link>{" "}
          · card by <span className="font-semibold">🐾 VetTracker</span>
        </p>
      </div>
    </main>
  );
}
