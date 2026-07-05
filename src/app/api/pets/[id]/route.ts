import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { breedRisksFor } from "@/lib/data/breeds";

function ownPet(userId: number, petId: number) {
  return db().prepare("SELECT * FROM pets WHERE id = ? AND user_id = ?").get(petId, userId) as
    | Record<string, unknown>
    | undefined;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const pet = ownPet(user.id, Number(id));
  if (!pet) return NextResponse.json({ error: "not found" }, { status: 404 });

  const d = db();
  const logs = d.prepare("SELECT * FROM logs WHERE pet_id = ? ORDER BY log_date DESC LIMIT 60").all(id);
  const alerts = d.prepare("SELECT * FROM alerts WHERE pet_id = ? ORDER BY created_at DESC").all(id);
  const reminders = d.prepare("SELECT * FROM reminders WHERE pet_id = ? ORDER BY due_date").all(id);
  const expenses = d.prepare("SELECT * FROM expenses WHERE pet_id = ? ORDER BY expense_date DESC").all(id);
  const appointments = d
    .prepare(
      `SELECT a.*, v.name AS vet_name, v.clinic, v.address AS vet_address, v.phone AS vet_phone
       FROM appointments a JOIN vets v ON v.id = a.vet_id WHERE a.pet_id = ? ORDER BY a.datetime DESC`
    )
    .all(id);
  const risks = breedRisksFor(pet.species as string, pet.breed as string | null);
  return NextResponse.json({ pet, logs, alerts, reminders, expenses, appointments, breedRisks: risks });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!ownPet(user.id, Number(id))) return NextResponse.json({ error: "not found" }, { status: 404 });
  const b = await req.json();
  db()
    .prepare(
      `UPDATE pets SET name = ?, species = ?, breed = ?, sex = ?, birth_date = ?, weight_kg = ?, photo = ?, notes = ?
       WHERE id = ?`
    )
    .run(b.name, b.species, b.breed ?? null, b.sex ?? null, b.birth_date ?? null, b.weight_kg ?? null,
      b.photo ?? "🐾", b.notes ?? null, id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!ownPet(user.id, Number(id))) return NextResponse.json({ error: "not found" }, { status: 404 });
  db().prepare("DELETE FROM pets WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
