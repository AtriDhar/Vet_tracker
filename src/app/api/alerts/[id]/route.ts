import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const row = db()
    .prepare(
      `SELECT a.id FROM alerts a JOIN pets p ON p.id = a.pet_id WHERE a.id = ? AND p.user_id = ?`
    )
    .get(id, user.id);
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  db().prepare("UPDATE alerts SET acknowledged = 1 WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
