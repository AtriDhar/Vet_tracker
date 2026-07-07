import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { processDueReminders } from "@/lib/service";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const d = await db();
  await processDueReminders(d, user.id); // lazily materialize due-reminder notifications
  const notifications = await d.all(
    "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
    [user.id]
  );
  const unread = await d.get<{ c: number }>(
    "SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read = 0",
    [user.id]
  );
  return NextResponse.json({ notifications, unread: unread?.c ?? 0 });
}

export async function PATCH() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const d = await db();
  await d.run("UPDATE notifications SET read = 1 WHERE user_id = ?", [user.id]);
  return NextResponse.json({ ok: true });
}
