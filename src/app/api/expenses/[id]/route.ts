import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const row = db()
    .prepare("SELECT e.id FROM expenses e JOIN pets p ON p.id = e.pet_id WHERE e.id = ? AND p.user_id = ?")
    .get(id, user.id);
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  db().prepare("DELETE FROM expenses WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
