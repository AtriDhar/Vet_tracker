// Service layer shared by API routes and the seeder:
// runs the rule engine on a log, persists alerts, fans out contagion
// warnings to household pets, and creates in-app notifications.

import { db } from "./db";
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

export function processLog(petId: number, logId: number): EngineResult | null {
  const d = db();
  const pet = d.prepare("SELECT id, user_id, name, species, breed, birth_date FROM pets WHERE id = ?").get(petId) as PetRow | undefined;
  if (!pet) return null;

  const logRow = d.prepare("SELECT * FROM logs WHERE id = ?").get(logId) as Record<string, unknown>;
  const log: LogInput = {
    log_date: logRow.log_date as string,
    food_grams: logRow.food_grams as number | null,
    water_ml: logRow.water_ml as number | null,
    activity_min: logRow.activity_min as number | null,
    weight_kg: logRow.weight_kg as number | null,
    sleep_hours: logRow.sleep_hours as number | null,
    stool: logRow.stool as string | null,
    symptoms: JSON.parse((logRow.symptoms as string) || "[]"),
  };

  const historyRows = d
    .prepare("SELECT * FROM logs WHERE pet_id = ? AND log_date < ? ORDER BY log_date DESC LIMIT 30")
    .all(petId, log.log_date) as Record<string, unknown>[];
  const history: LogInput[] = historyRows.map((r) => ({
    log_date: r.log_date as string,
    food_grams: r.food_grams as number | null,
    water_ml: r.water_ml as number | null,
    activity_min: r.activity_min as number | null,
    weight_kg: r.weight_kg as number | null,
    sleep_hours: r.sleep_hours as number | null,
    stool: r.stool as string | null,
    symptoms: JSON.parse((r.symptoms as string) || "[]"),
  }));

  const result = evaluateLog(pet, log, history);
  if (!result) return null;

  const ins = d.prepare(
    `INSERT INTO alerts (pet_id, log_id, severity, triage, title, score, reasons, tips)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const alertId = Number(
    ins.run(petId, logId, result.severity, result.triage, result.title, result.score,
      JSON.stringify(result.reasons), JSON.stringify(result.tips)).lastInsertRowid
  );

  notify(
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
    const siblings = d
      .prepare("SELECT id, user_id, name, species, breed, birth_date FROM pets WHERE user_id = ? AND id != ?")
      .all(pet.user_id, pet.id) as PetRow[];
    for (const sib of siblings) {
      const warn = contagionAlertFor(pet, sib, result.contagion);
      d.prepare(
        `INSERT INTO alerts (pet_id, log_id, severity, triage, title, score, reasons, tips, contagion_source_pet_id)
         VALUES (?, NULL, ?, ?, ?, 0, ?, ?, ?)`
      ).run(sib.id, warn.severity, warn.triage, warn.title, JSON.stringify(warn.reasons), JSON.stringify(warn.tips), pet.id);
      notify(pet.user_id, "contagion", warn.title, warn.reasons[0], `/pets/${sib.id}?tab=alerts`);
    }
  }

  return { ...result, ...( { alertId } as object) } as EngineResult & { alertId: number };
}

export function notify(userId: number, type: string, title: string, body: string, link: string) {
  db()
    .prepare("INSERT INTO notifications (user_id, type, title, body, link) VALUES (?, ?, ?, ?, ?)")
    .run(userId, type, title, body, link);
}

/** Generate notifications for reminders due within 3 days (called lazily on dashboard load). */
export function processDueReminders(userId: number) {
  const d = db();
  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + 3 * 86400_000).toISOString().slice(0, 10);
  const due = d
    .prepare(
      `SELECT r.*, p.name AS pet_name, p.user_id FROM reminders r
       JOIN pets p ON p.id = r.pet_id
       WHERE p.user_id = ? AND r.due_date <= ?
         AND (r.last_notified IS NULL OR r.last_notified < ?)`
    )
    .all(userId, soon, today) as Array<Record<string, unknown>>;

  for (const r of due) {
    const overdue = (r.due_date as string) < today;
    notify(
      userId,
      "reminder",
      `${overdue ? "Overdue" : "Upcoming"}: ${r.title} for ${r.pet_name}`,
      `${r.type} ${overdue ? "was due" : "is due"} on ${r.due_date}.`,
      `/dashboard`
    );
    d.prepare("UPDATE reminders SET last_notified = ? WHERE id = ?").run(today, r.id);
    // roll recurring reminders forward once overdue
    if (overdue && r.repeat_days) {
      const next = new Date(new Date(r.due_date as string).getTime() + (r.repeat_days as number) * 86400_000);
      d.prepare("UPDATE reminders SET due_date = ?, last_notified = NULL WHERE id = ?").run(
        next.toISOString().slice(0, 10),
        r.id
      );
    }
  }
}
