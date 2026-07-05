import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

export default async function Landing() {
  const user = await getSessionUser();
  if (user) redirect(user.role === "vet" ? "/vet-portal" : "/dashboard");

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-5xl px-4 py-16">
        <div className="flex items-center gap-2 font-display text-xl font-bold text-teal-800">
          <span className="text-2xl">🐾</span> VetTracker
        </div>

        <h1 className="mt-10 max-w-3xl font-display text-4xl font-bold leading-tight text-stone-900 sm:text-5xl">
          Catch what your pet can&apos;t tell you —{" "}
          <span className="text-teal-700">days earlier</span>.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-stone-600">
          Log food, water, activity and symptoms in 30 seconds a day. A transparent, rule-based
          early-warning engine watches the trends, explains exactly why it&apos;s concerned, and
          triages like an ER — monitor at home, see a vet in 48 hours, or go now.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/signup"
            className="rounded-xl bg-teal-700 px-6 py-3 font-medium text-white hover:bg-teal-800"
          >
            Create free account
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-stone-300 bg-white px-6 py-3 font-medium text-stone-800 hover:bg-stone-50"
          >
            Sign in (demo inside)
          </Link>
          <Link
            href="/toxicity"
            className="rounded-xl border border-rose-200 bg-rose-50 px-6 py-3 font-medium text-rose-800 hover:bg-rose-100"
          >
            ☠️ Toxicity checker — no login needed
          </Link>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-3">
          {[
            {
              emoji: "🚦",
              title: "ER-style triage",
              body: "Every alert routes you: 🟢 monitor at home with care tips, 🟡 book within 48 hrs, 🔴 nearest 24-hr emergency vet — instantly.",
            },
            {
              emoji: "🔍",
              title: "Explainable alerts",
              body: "No black box. “Water intake +55% vs Misty's own 7-day baseline (232→360 ml)” — every point in the score is justified, including breed-specific risk.",
            },
            {
              emoji: "📄",
              title: "One-click vet report",
              body: "Walk into the clinic with a printable report: trends, alert history and the engine's reasoning — no more “I think she started last Tuesday?”",
            },
            {
              emoji: "🦠",
              title: "Household contagion watch",
              body: "One pet coughs, the others get flagged. Kennel cough, ringworm and parasites don't respect pet profiles.",
            },
            {
              emoji: "🧬",
              title: "Breed-aware rules",
              body: "A Persian drinking more water is not the same as a Beagle doing it. Static veterinary risk tables tune every score.",
            },
            {
              emoji: "🆘",
              title: "QR emergency card",
              body: "A public card with conditions, meds and your vet's number — printable, scannable, on your pet's collar.",
            },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-stone-200 bg-white p-5">
              <div className="text-2xl">{f.emoji}</div>
              <div className="mt-2 font-display font-bold text-stone-800">{f.title}</div>
              <p className="mt-1 text-sm text-stone-600">{f.body}</p>
            </div>
          ))}
        </div>

        <p className="mt-16 text-xs text-stone-400">
          VetTracker assists observation — it is not a diagnosis. Always consult a licensed
          veterinarian for medical decisions.
        </p>
      </div>
    </main>
  );
}
