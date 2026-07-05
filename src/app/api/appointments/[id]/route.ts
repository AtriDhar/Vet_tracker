import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { notify } from "@/lib/service";

const OWNER_TRANSITIONS = new Set(["cancelled"]);
const VET_TRANSITIONS = new Set(["confirmed", "completed", "cancelled"]);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const { status } = await req.json();
  const d = db();
  const ap = d
    .prepare("SELECT ap.*, p.name AS pet_name FROM appointments ap JOIN pets p ON p.id = ap.pet_id WHERE ap.id = ?")
    .get(id) as Record<string, unknown> | undefined;
  if (!ap) return NextResponse.json({ error: "not found" }, { status: 404 });

  const isOwner = ap.user_id === user.id;
  const isVet = user.role === "vet" && user.vet_id === ap.vet_id;
  const allowed = (isOwner && OWNER_TRANSITIONS.has(status)) || (isVet && VET_TRANSITIONS.has(status));
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  d.prepare("UPDATE appointments SET status = ? WHERE id = ?").run(status, id);
  if (isVet) {
    notify(ap.user_id as number, "appointment",
      `Appointment ${status} for ${ap.pet_name}`,
      `Your ${String(ap.datetime).replace("T", " ")} appointment was ${status} by the clinic.`,
      "/appointments");
  }
  return NextResponse.json({ ok: true });
}
