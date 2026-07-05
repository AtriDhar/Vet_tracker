import { NextRequest, NextResponse } from "next/server";
import { db, newShareToken } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const pets = db()
    .prepare(
      `SELECT p.*,
        (SELECT COUNT(*) FROM logs l WHERE l.pet_id = p.id) AS log_count,
        (SELECT COUNT(*) FROM alerts a WHERE a.pet_id = p.id AND a.acknowledged = 0) AS open_alerts,
        (SELECT a.severity FROM alerts a WHERE a.pet_id = p.id AND a.acknowledged = 0
           ORDER BY CASE a.severity WHEN 'urgent' THEN 0 WHEN 'watch' THEN 1 ELSE 2 END LIMIT 1) AS worst_severity,
        (SELECT l.log_date FROM logs l WHERE l.pet_id = p.id ORDER BY l.log_date DESC LIMIT 1) AS last_log_date
       FROM pets p WHERE p.user_id = ? ORDER BY p.created_at`
    )
    .all(user.id);
  return NextResponse.json({ pets });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await req.json();
  if (!b.name || !b.species) {
    return NextResponse.json({ error: "Name and species are required." }, { status: 400 });
  }
  const id = Number(
    db()
      .prepare(
        `INSERT INTO pets (user_id, name, species, breed, sex, birth_date, weight_kg, photo, notes, share_token)
         VALUES (?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        user.id, b.name, b.species, b.breed ?? null, b.sex ?? null, b.birth_date ?? null,
        b.weight_kg ?? null, b.photo ?? (b.species === "cat" ? "🐈" : b.species === "dog" ? "🐕" : "🐾"),
        b.notes ?? null, newShareToken()
      ).lastInsertRowid
  );
  return NextResponse.json({ id }, { status: 201 });
}
