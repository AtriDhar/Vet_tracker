// Service layer shared by API routes and the seeder:
// runs the rule engine on a log, persists alerts, fans out contagion
// warnings to household pets, and creates in-app notifications.

import type { Db } from "./db";
import {
  evaluateLog,
  contagionAlertFor,
  type LogInput,
  type PetInput,
  type EngineResult,
} from "./rules/engine";

interface PetRow extends PetInput {
  user_id: number;
}

function toLogInput(r: Record<string, unknown>): LogInput {
  return {
    log_date: r.log_date as string,
    food_grams: r.food_grams as number | null,
    water_ml: r.water_ml as number | null,
    activity_min: r.activity_min as number | null,
    weight_kg: r.weight_kg as number | null,
    sleep_hours: r.sleep_hours as number | null,
    stool: r.stool as string | null,
    symptoms: JSON.parse((r.symptoms as string) || "[]"),
  };
}

export async function processLog(
  d: Db,
  petId: number,
  logId: number
): Promise<(EngineResult & { alertId: number }) | null> {
  const pet = await d.get<PetRow>(
    "SELECT id, user_id, name, species, breed, birth_date FROM pets WHERE id = ?",
    [petId]
  );
  if (!pet) return null;

  const logRow = await d.get("SELECT * FROM logs WHERE id = ?", [logId]);
  if (!logRow) return null;
  const log = toLogInput(logRow);

  const historyRows = await d.all(
    "SELECT * FROM logs WHERE pet_id = ? AND log_date < ? ORDER BY log_date DESC LIMIT 30",
    [petId, log.log_date]
  );
  const history = historyRows.map(toLogInput);

  const result = evaluateLog(pet, log, history);
  if (!result) return null;

  const ins = await d.run(
    `INSERT INTO alerts (pet_id, log_id, severity, triage, title, score, reasons, tips)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [petId, logId, result.severity, result.triage, result.title, result.score,
      JSON.stringify(result.reasons), JSON.stringify(result.tips)]
  );
  const alertId = ins.lastInsertRowid;

  await notify(
    d,
    pet.user_id,
    "alert",
    result.title,
    result.severity === "urgent"
      ? `Score ${result.score} — emergency triage recommended. Tap to see why and find a 24-hr vet.`
      : `Score ${result.score} — ${result.reasons.length} contributing factor(s). Tap for the full explanation.`,
    `/pets/${petId}?tab=alerts`
  );

  // Contagion fan-out to other pets in the same household
  if (result.contagion) {
    const siblings = await d.all<PetRow>(
      "SELECT id, user_id, name, species, breed, birth_date FROM pets WHERE user_id = ? AND id != ?",
      [pet.user_id, pet.id]
    );
    for (const sib of siblings) {
      const warn = contagionAlertFor(pet, sib, result.contagion);
      await d.run(
        `INSERT INTO alerts (pet_id, log_id, severity, triage, title, score, reasons, tips, contagion_source_pet_id)
         VALUES (?, NULL, ?, ?, ?, 0, ?, ?, ?)`,
        [sib.id, warn.severity, warn.triage, warn.title, JSON.stringify(warn.reasons),
          JSON.stringify(warn.tips), pet.id]
      );
      await notify(d, pet.user_id, "contagion", warn.title, warn.reasons[0], `/pets/${sib.id}?tab=alerts`);
    }
  }

  return { ...result, alertId };
}

export async function notify(
  d: Db,
  userId: number,
  type: string,
  title: string,
  body: string,
  link: string
) {
  await d.run(
    "INSERT INTO notifications (user_id, type, title, body, link) VALUES (?, ?, ?, ?, ?)",
    [userId, type, title, body, link]
  );
}

/** Generate notifications for reminders due within 3 days (called lazily on dashboard load). */
export async function processDueReminders(d: Db, userId: number) {
  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + 3 * 86400_000).toISOString().slice(0, 10);
  const due = await d.all(
    `SELECT r.*, p.name AS pet_name FROM reminders r
     JOIN pets p ON p.id = r.pet_id
     WHERE p.user_id = ? AND r.due_date <= ?
       AND (r.last_notified IS NULL OR r.last_notified < ?)`,
    [userId, soon, today]
  );

  for (const r of due) {
    const overdue = (r.due_date as string) < today;
    await notify(
      d,
      userId,
      "reminder",
      `${overdue ? "Overdue" : "Upcoming"}: ${r.title} for ${r.pet_name}`,
      `${r.type} ${overdue ? "was due" : "is due"} on ${r.due_date}.`,
      `/dashboard`
    );
    await d.run("UPDATE reminders SET last_notified = ? WHERE id = ?", [today, r.id as number]);
    // roll recurring reminders forward once overdue
    if (overdue && r.repeat_days) {
      const next = new Date(
        new Date(r.due_date as string).getTime() + (r.repeat_days as number) * 86400_000
      );
      await d.run("UPDATE reminders SET due_date = ?, last_notified = NULL WHERE id = ?", [
        next.toISOString().slice(0, 10),
        r.id as number,
      ]);
    }
  }
}
