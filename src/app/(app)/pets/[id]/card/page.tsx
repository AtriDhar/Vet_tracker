// QR emergency card generator. The QR encodes a PUBLIC (token-gated, no-login)
// card page so a stranger who finds the pet can see conditions + contacts.

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

export default async function CardPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const pet = db()
    .prepare("SELECT * FROM pets WHERE id = ? AND user_id = ?")
    .get(Number(id), user.id) as Record<string, unknown> | undefined;
  if (!pet) notFound();

  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const publicUrl = `${proto}://${host}/card/${pet.share_token}`;
  const qr = await QRCode.toDataURL(publicUrl, { margin: 1, width: 220 });

  return (
    <div className="mx-auto max-w-md">
      <div className="no-print mb-4 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-stone-900">Emergency QR card</h1>
        <div className="flex gap-2">
          <PrintButton />
          <Link href={`/pets/${id}`} className="rounded-xl border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">
            Back
          </Link>
        </div>
      </div>

      <div className="print-page rounded-2xl border-2 border-teal-700 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-stone-200 pb-3">
          <div className="font-display font-bold text-teal-800">🐾 VetTracker · Emergency Pet Card</div>
          <span className="text-3xl">{(pet.photo as string) ?? "🐾"}</span>
        </div>
        <div className="mt-4 flex gap-5">
          <div className="flex-1 space-y-1 text-sm">
            <div className="font-display text-xl font-bold text-stone-900">{pet.name as string}</div>
            <div className="text-stone-600">
              {(pet.breed as string) ?? (pet.species as string)}
              {pet.sex ? ` · ${pet.sex}` : ""}
              {pet.weight_kg ? ` · ${pet.weight_kg} kg` : ""}
            </div>
            {typeof pet.notes === "string" && pet.notes && (
              <div className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-900">
                ⚕ {pet.notes}
              </div>
            )}
            <div className="pt-2 text-xs text-stone-500">
              <div className="font-semibold text-stone-700">If found, contact:</div>
              <div>{user.name}</div>
              {user.phone && <div className="text-base font-bold text-stone-900">{user.phone}</div>}
              {user.address && <div>{user.address}</div>}
            </div>
          </div>
          <div className="flex flex-col items-center gap-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR code to public pet card" className="h-36 w-36" />
            <span className="text-[9px] text-stone-400">scan for full card</span>
          </div>
        </div>
      </div>

      <p className="no-print mt-4 text-sm text-stone-500">
        The QR opens a <strong>public page</strong> (no login) at{" "}
        <a href={publicUrl} className="break-all font-mono text-xs text-teal-700 underline">{publicUrl}</a>{" "}
        showing this card. Print it, laminate it, zip-tie it to the collar. Anyone who finds{" "}
        {pet.name as string} sees medical conditions and your number — nothing else from your account.
      </p>
    </div>
  );
}
