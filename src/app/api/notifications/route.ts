import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { processDueReminders } from "@/lib/service";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  processDueReminders(user.id); // lazily materialize due-reminder notifications
  const rows = db()
    .prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50")
    .all(user.id);
  const unread = db()
    .prepare("SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read = 0")
    .get(user.id) as { c: number };
  return NextResponse.json({ notifications: rows, unread: unread.c });
}

export async function PATCH() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  db().prepare("UPDATE notifications SET read = 1 WHERE user_id = ?").run(user.id);
  return NextResponse.json({ ok: true });
}
