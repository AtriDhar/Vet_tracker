import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await req.json();
  if (!b.pet_id || !b.category || !b.description || b.amount == null) {
    return NextResponse.json({ error: "all fields are required" }, { status: 400 });
  }
  const pet = db().prepare("SELECT id FROM pets WHERE id = ? AND user_id = ?").get(b.pet_id, user.id);
  if (!pet) return NextResponse.json({ error: "pet not found" }, { status: 404 });
  const id = Number(
    db()
      .prepare("INSERT INTO expenses (pet_id, category, description, amount, expense_date) VALUES (?,?,?,?,?)")
      .run(b.pet_id, b.category, b.description, b.amount,
        b.expense_date ?? new Date().toISOString().slice(0, 10)).lastInsertRowid
  );
  return NextResponse.json({ id }, { status: 201 });
}
