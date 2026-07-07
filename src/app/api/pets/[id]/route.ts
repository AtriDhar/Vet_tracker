import { NextRequest, NextResponse } from "next/server";
import { db, type Db, type Row } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { breedRisksFor } from "@/lib/data/breeds";

function ownPet(d: Db, userId: number, petId: number): Promise<Row | undefined> {
  return d.get("SELECT * FROM pets WHERE id = ? AND user_id = ?", [petId, userId]);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const d = await db();
  const pet = await ownPet(d, user.id, Number(id));
  if (!pet) return NextResponse.json({ error: "not found" }, { status: 404 });

  const [logs, alerts, reminders, expenses, appointments] = await Promise.all([
    d.all("SELECT * FROM logs WHERE pet_id = ? ORDER BY log_date DESC LIMIT 60", [id]),
    d.all("SELECT * FROM alerts WHERE pet_id = ? ORDER BY created_at DESC", [id]),
    d.all("SELECT * FROM reminders WHERE pet_id = ? ORDER BY due_date", [id]),
    d.all("SELECT * FROM expenses WHERE pet_id = ? ORDER BY expense_date DESC", [id]),
    d.all(
      `SELECT a.*, v.name AS vet_name, v.clinic, v.address AS vet_address, v.phone AS vet_phone
       FROM appointments a JOIN vets v ON v.id = a.vet_id WHERE a.pet_id = ? ORDER BY a.datetime DESC`,
      [id]
    ),
  ]);
  const risks = breedRisksFor(pet.species as string, pet.breed as string | null);
  return NextResponse.json({ pet, logs, alerts, reminders, expenses, appointments, breedRisks: risks });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const d = await db();
  if (!(await ownPet(d, user.id, Number(id)))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const b = await req.json();
  await d.run(
    `UPDATE pets SET name = ?, species = ?, breed = ?, sex = ?, birth_date = ?, weight_kg = ?, photo = ?, notes = ?
     WHERE id = ?`,
    [b.name, b.species, b.breed ?? null, b.sex ?? null, b.birth_date ?? null, b.weight_kg ?? null,
      b.photo ?? "🐾", b.notes ?? null, id]
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const d = await db();
  if (!(await ownPet(d, user.id, Number(id)))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  await d.run("DELETE FROM pets WHERE id = ?", [id]);
  return NextResponse.json({ ok: true });
}
