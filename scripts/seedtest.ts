// Sanity script: seeds a fresh DB (if empty) and prints the engine's alert output.
// Run with: npx tsx scripts/seedtest.ts   (delete ./data first for a clean run)
import { db } from "../src/lib/db";

const d = db();
const alerts = d
  .prepare(
    "SELECT a.id, p.name, a.severity, a.triage, a.score, a.title FROM alerts a JOIN pets p ON p.id=a.pet_id ORDER BY a.id"
  )
  .all();
console.table(alerts);

const urgent = d.prepare("SELECT reasons FROM alerts WHERE severity='urgent' LIMIT 1").get() as
  | { reasons: string }
  | undefined;
if (urgent) console.log("URGENT REASONS:\n" + (JSON.parse(urgent.reasons) as string[]).join("\n"));

const misty = d
  .prepare(
    "SELECT reasons FROM alerts a JOIN pets p ON p.id=a.pet_id WHERE p.name='Misty' AND a.contagion_source_pet_id IS NULL LIMIT 1"
  )
  .get() as { reasons: string } | undefined;
if (misty) console.log("\nMISTY REASONS:\n" + (JSON.parse(misty.reasons) as string[]).join("\n"));

console.log("\nnotifications:", d.prepare("SELECT COUNT(*) c FROM notifications").get());
