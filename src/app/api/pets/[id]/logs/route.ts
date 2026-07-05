import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { processLog } from "@/lib/service";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const petId = Number(id);
  const pet = db().prepare("SELECT id FROM pets WHERE id = ? AND user_id = ?").get(petId, user.id);
  if (!pet) return NextResponse.json({ error: "not found" }, { status: 404 });

  const b = await req.json();
  const logDate = b.log_date || new Date().toISOString().slice(0, 10);
  const d = db();

  // one log per day per pet: upsert
  const existing = d.prepare("SELECT id FROM logs WHERE pet_id = ? AND log_date = ?").get(petId, logDate) as
    | { id: number }
    | undefined;
  let logId: number;
  const symptoms = JSON.stringify(Array.isArray(b.symptoms) ? b.symptoms : []);
  if (existing) {
    d.prepare(
      `UPDATE logs SET food_grams=?, water_ml=?, activity_min=?, weight_kg=?, sleep_hours=?, stool=?, symptoms=?, notes=?, photo=?
       WHERE id = ?`
    ).run(b.food_grams ?? null, b.water_ml ?? null, b.activity_min ?? null, b.weight_kg ?? null,
      b.sleep_hours ?? null, b.stool ?? null, symptoms, b.notes ?? null, b.photo ?? null, existing.id);
    logId = existing.id;
    // re-evaluating an edited log: clear alerts previously generated from it
    d.prepare("DELETE FROM alerts WHERE log_id = ?").run(logId);
  } else {
    logId = Number(
      d.prepare(
        `INSERT INTO logs (pet_id, log_date, food_grams, water_ml, activity_min, weight_kg, sleep_hours, stool, symptoms, notes, photo)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`
      ).run(petId, logDate, b.food_grams ?? null, b.water_ml ?? null, b.activity_min ?? null,
        b.weight_kg ?? null, b.sleep_hours ?? null, b.stool ?? null, symptoms, b.notes ?? null,
        b.photo ?? null).lastInsertRowid
    );
  }

  // keep pet's current weight in sync with the newest logged weight
  if (b.weight_kg) {
    d.prepare("UPDATE pets SET weight_kg = ? WHERE id = ?").run(b.weight_kg, petId);
  }

  const result = processLog(petId, logId);
  return NextResponse.json({ logId, alert: result }, { status: existing ? 200 : 201 });
}
