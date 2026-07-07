// Sanity script: seeds a fresh DB (if empty) and prints the engine's alert output.
// Run with: npx tsx scripts/seedtest.ts   (delete ./data first for a clean run)
import { db } from "../src/lib/db";

(async () => {
  const d = await db();
  const alerts = await d.all(
    "SELECT a.id, p.name, a.severity, a.triage, a.score, a.title FROM alerts a JOIN pets p ON p.id=a.pet_id ORDER BY a.id"
  );
  console.table(alerts);

  const urgent = await d.get<{ reasons: string }>(
    "SELECT reasons FROM alerts WHERE severity='urgent' LIMIT 1"
  );
  if (urgent) console.log("URGENT REASONS:\n" + (JSON.parse(urgent.reasons) as string[]).join("\n"));

  const misty = await d.get<{ reasons: string }>(
    "SELECT reasons FROM alerts a JOIN pets p ON p.id=a.pet_id WHERE p.name='Misty' AND a.contagion_source_pet_id IS NULL LIMIT 1"
  );
  if (misty) console.log("\nMISTY REASONS:\n" + (JSON.parse(misty.reasons) as string[]).join("\n"));

  console.log("\nnotifications:", await d.get("SELECT COUNT(*) c FROM notifications"));
  process.exit(0);
})();
