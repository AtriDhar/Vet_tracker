import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { processLog } from "@/lib/service";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const petId = Number(id);
  const d = await db();
  const pet = await d.get("SELECT id FROM pets WHERE id = ? AND user_id = ?", [petId, user.id]);
  if (!pet) return NextResponse.json({ error: "not found" }, { status: 404 });

  const b = await req.json();
  const logDate = b.log_date || new Date().toISOString().slice(0, 10);

  // one log per day per pet: upsert
  const existing = await d.get<{ id: number }>(
    "SELECT id FROM logs WHERE pet_id = ? AND log_date = ?",
    [petId, logDate]
  );
  let logId: number;
  const symptoms = JSON.stringify(Array.isArray(b.symptoms) ? b.symptoms : []);
  if (existing) {
    await d.run(
      `UPDATE logs SET food_grams=?, water_ml=?, activity_min=?, weight_kg=?, sleep_hours=?, stool=?, symptoms=?, notes=?, photo=?
       WHERE id = ?`,
      [b.food_grams ?? null, b.water_ml ?? null, b.activity_min ?? null, b.weight_kg ?? null,
        b.sleep_hours ?? null, b.stool ?? null, symptoms, b.notes ?? null, b.photo ?? null, existing.id]
    );
    logId = existing.id;
    // re-evaluating an edited log: clear alerts previously generated from it
    await d.run("DELETE FROM alerts WHERE log_id = ?", [logId]);
  } else {
    const r = await d.run(
      `INSERT INTO logs (pet_id, log_date, food_grams, water_ml, activity_min, weight_kg, sleep_hours, stool, symptoms, notes, photo)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [petId, logDate, b.food_grams ?? null, b.water_ml ?? null, b.activity_min ?? null,
        b.weight_kg ?? null, b.sleep_hours ?? null, b.stool ?? null, symptoms, b.notes ?? null,
        b.photo ?? null]
    );
    logId = r.lastInsertRowid;
  }

  // keep pet's current weight in sync with the newest logged weight
  if (b.weight_kg) {
    await d.run("UPDATE pets SET weight_kg = ? WHERE id = ?", [b.weight_kg, petId]);
  }

  const result = await processLog(d, petId, logId);
  return NextResponse.json({ logId, alert: result }, { status: existing ? 200 : 201 });
}
