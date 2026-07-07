import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const d = await db();
  const reminders = await d.all(
    `SELECT r.*, p.name AS pet_name FROM reminders r JOIN pets p ON p.id = r.pet_id
     WHERE p.user_id = ? ORDER BY r.due_date`,
    [user.id]
  );
  return NextResponse.json({ reminders });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await req.json();
  if (!b.pet_id || !b.title || !b.due_date || !b.type) {
    return NextResponse.json({ error: "pet, type, title and due date are required" }, { status: 400 });
  }
  const d = await db();
  const pet = await d.get("SELECT id FROM pets WHERE id = ? AND user_id = ?", [b.pet_id, user.id]);
  if (!pet) return NextResponse.json({ error: "pet not found" }, { status: 404 });
  const { lastInsertRowid: id } = await d.run(
    "INSERT INTO reminders (pet_id, type, title, due_date, repeat_days) VALUES (?,?,?,?,?)",
    [b.pet_id, b.type, b.title, b.due_date, b.repeat_days ?? null]
  );
  return NextResponse.json({ id }, { status: 201 });
}
