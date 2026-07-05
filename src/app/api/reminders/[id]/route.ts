import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const row = db()
    .prepare("SELECT r.id FROM reminders r JOIN pets p ON p.id = r.pet_id WHERE r.id = ? AND p.user_id = ?")
    .get(id, user.id);
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  db().prepare("DELETE FROM reminders WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
