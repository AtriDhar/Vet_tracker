import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { notify } from "@/lib/service";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const d = await db();

  if (user.role === "vet" && user.vet_id) {
    // Vet portal: incoming appointments for this clinic, with triage context pre-loaded
    const rows = await d.all(
      `SELECT ap.*, p.name AS pet_name, p.species, p.breed, p.birth_date, p.weight_kg, p.notes AS pet_notes,
              u.name AS owner_name, u.phone AS owner_phone,
              al.severity AS triage_severity, al.score AS triage_score, al.reasons AS triage_reasons
       FROM appointments ap
       JOIN pets p ON p.id = ap.pet_id
       JOIN users u ON u.id = ap.user_id
       LEFT JOIN alerts al ON al.id = ap.triage_alert_id
       WHERE ap.vet_id = ?
       ORDER BY CASE ap.status WHEN 'pending' THEN 0 WHEN 'confirmed' THEN 1 ELSE 2 END, ap.datetime`,
      [user.vet_id]
    );
    return NextResponse.json({ appointments: rows, role: "vet" });
  }

  const rows = await d.all(
    `SELECT ap.*, p.name AS pet_name, v.name AS vet_name, v.clinic, v.address AS vet_address, v.phone AS vet_phone, v.emergency
     FROM appointments ap
     JOIN pets p ON p.id = ap.pet_id
     JOIN vets v ON v.id = ap.vet_id
     WHERE ap.user_id = ? ORDER BY ap.datetime DESC`,
    [user.id]
  );
  return NextResponse.json({ appointments: rows, role: "owner" });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await req.json();
  if (!b.pet_id || !b.vet_id || !b.datetime) {
    return NextResponse.json({ error: "pet, vet and time are required" }, { status: 400 });
  }
  const d = await db();
  const pet = await d.get<{ id: number; name: string }>(
    "SELECT id, name FROM pets WHERE id = ? AND user_id = ?",
    [b.pet_id, user.id]
  );
  if (!pet) return NextResponse.json({ error: "pet not found" }, { status: 404 });

  const { lastInsertRowid: id } = await d.run(
    `INSERT INTO appointments (user_id, pet_id, vet_id, datetime, reason, status, triage_alert_id)
     VALUES (?,?,?,?,?,'pending',?)`,
    [user.id, b.pet_id, b.vet_id, b.datetime, b.reason ?? null, b.triage_alert_id ?? null]
  );
  const vet = await d.get<{ name: string; clinic: string }>(
    "SELECT name, clinic FROM vets WHERE id = ?",
    [b.vet_id]
  );
  await notify(d, user.id, "appointment", `Appointment requested for ${pet.name}`,
    `${vet?.name} · ${vet?.clinic} · ${String(b.datetime).replace("T", " at ")}. Status: pending confirmation.`,
    "/appointments");
  return NextResponse.json({ id }, { status: 201 });
}
