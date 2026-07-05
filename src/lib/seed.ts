// First-run seeder. Inserts demo accounts, vets, pets and 14 days of logs,
// then runs the REAL rule engine on the interesting days so the alert history
// is genuine engine output, not hand-written fixtures.

import type { Database } from "better-sqlite3";
import bcrypt from "bcryptjs";
import { newShareToken } from "./db";
import { processLog } from "./service";

let seeded = false;

export function ensureSeeded(d: Database) {
  if (seeded) return;
  seeded = true;
  const count = (d.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number }).c;
  if (count > 0) return;
  seedAll(d);
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400_000).toISOString().slice(0, 10);
}
function daysAhead(n: number): string {
  return new Date(Date.now() + n * 86400_000).toISOString().slice(0, 10);
}

function seedAll(d: Database) {
  // ── Vet directory ─────────────────────────────────────────────────────────
  const vets: Array<[string, string, string, string, string, string, string, number, number]> = [
    ["Dr. Ananya Rao", "PawCare Veterinary Clinic", "General practice", "Bhubaneswar", "Plot 12, Saheed Nagar", "+91 98530 11223", "Mon–Sat 9:00–20:00", 0, 4.8],
    ["Dr. Vikram Patnaik", "Companion Animal Hospital", "Internal medicine", "Bhubaneswar", "Janpath Rd, Ashok Nagar", "+91 98610 44556", "Mon–Sat 10:00–19:00", 0, 4.6],
    ["Dr. Sneha Mishra", "Feline First Cat Clinic", "Feline specialist", "Bhubaneswar", "Patia Square, KIIT Rd", "+91 99370 77889", "Tue–Sun 10:00–18:00", 0, 4.9],
    ["Dr. Rohit Das", "24x7 Animal Emergency Centre", "Emergency & critical care", "Bhubaneswar", "NH-16 Service Rd, Rasulgarh", "+91 90400 22334", "Open 24 hours", 1, 4.7],
    ["Dr. Priya Senapati", "OrthoPet Speciality Centre", "Orthopedics", "Bhubaneswar", "Jaydev Vihar", "+91 94370 66778", "Mon–Fri 9:00–17:00", 0, 4.5],
    ["Dr. Kunal Behera", "VetPlus Skin & Allergy", "Dermatology", "Bhubaneswar", "Old Town, Near Lingaraj", "+91 91240 99001", "Mon–Sat 11:00–19:00", 0, 4.3],
    ["Dr. Meera Iyer", "NightOwl Pet ER", "Emergency & trauma", "Bhubaneswar", "Chandrasekharpur", "+91 98220 55667", "Open 24 hours", 1, 4.6],
    ["Dr. Arjun Mohanty", "Happy Tails Mobile Vet", "Home visits", "Bhubaneswar", "Serves all zones", "+91 93370 88990", "Mon–Sun 8:00–21:00", 0, 4.4],
  ];
  const insVet = d.prepare(
    "INSERT INTO vets (name, clinic, specialty, city, address, phone, hours, emergency, rating) VALUES (?,?,?,?,?,?,?,?,?)"
  );
  for (const v of vets) insVet.run(...v);

  // ── Users ─────────────────────────────────────────────────────────────────
  const hash = bcrypt.hashSync("demo1234", 10);
  const ownerId = Number(
    d.prepare(
      "INSERT INTO users (email, password_hash, name, phone, address, role) VALUES (?,?,?,?,?,'owner')"
    ).run("demo@vettracker.app", hash, "Aarav Sharma", "+91 98765 43210", "C-304, Utopia Heights, Patia, Bhubaneswar").lastInsertRowid
  );
  d.prepare(
    "INSERT INTO users (email, password_hash, name, phone, role, vet_id) VALUES (?,?,?,?,'vet',1)"
  ).run("vet@vettracker.app", bcrypt.hashSync("vet1234", 10), "Dr. Ananya Rao", "+91 98530 11223");

  // ── Pets ──────────────────────────────────────────────────────────────────
  const insPet = d.prepare(
    `INSERT INTO pets (user_id, name, species, breed, sex, birth_date, weight_kg, photo, notes, share_token)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  );
  const bruno = Number(insPet.run(ownerId, "Bruno", "dog", "Labrador Retriever", "male",
    daysAgo(Math.round(6 * 365.25)), 32, "🐕",
    "Neutered. Mild seasonal skin allergies. Vaccinations up to date except rabies booster due this month.",
    newShareToken()).lastInsertRowid);
  const misty = Number(insPet.run(ownerId, "Misty", "cat", "Persian", "female",
    daysAgo(Math.round(8 * 365.25)), 3.8, "🐈",
    "Indoor cat. Spayed. Grade 1 dental tartar noted at last checkup.",
    newShareToken()).lastInsertRowid);
  const coco = Number(insPet.run(ownerId, "Coco", "dog", "Beagle", "female",
    daysAgo(Math.round(2 * 365.25)), 12, "🐶",
    "Very food-motivated. Attends weekend park meetups (dog-park exposure).",
    newShareToken()).lastInsertRowid);

  // ── 14 days of logs ───────────────────────────────────────────────────────
  const insLog = d.prepare(
    `INSERT INTO logs (pet_id, log_date, food_grams, water_ml, activity_min, weight_kg, sleep_hours, stool, symptoms, notes)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  );
  const jitter = (base: number, spread: number, i: number) =>
    Math.round(base + Math.sin(i * 2.3) * spread);

  const evalQueue: number[] = []; // log ids to run through the engine, chronological

  for (let i = 13; i >= 0; i--) {
    const date = daysAgo(i);

    // Bruno — healthy baseline, limps on day -1, crashes today
    if (i >= 2) {
      insLog.run(bruno, date, jitter(400, 25, i), jitter(900, 60, i), jitter(90, 12, i), 32, jitter(12, 1, i), "normal", "[]", null);
    } else if (i === 1) {
      const id = Number(insLog.run(bruno, date, 380, 880, 35, 32, 13, "normal",
        JSON.stringify(["limping"]), "Favoring right hind leg after the evening walk.").lastInsertRowid);
      evalQueue.push(id);
    } else {
      const id = Number(insLog.run(bruno, date, 0, 400, 30, 31.8, 15, "soft",
        JSON.stringify(["vomiting", "lethargy"]), "Vomited twice this morning, refused breakfast and dinner. Very flat.").lastInsertRowid);
      evalQueue.push(id);
    }

    // Misty — quiet water-intake ramp over the last 3 days (early kidney pattern)
    if (i >= 3) {
      insLog.run(misty, date, jitter(60, 5, i), jitter(200, 12, i), jitter(30, 6, i), 3.8, jitter(16, 1, i), "normal", "[]", null);
    } else if (i === 2) {
      insLog.run(misty, date, 58, 300, 28, 3.8, 16, "normal", "[]", "Refilled the bowl earlier than usual.");
    } else if (i === 1) {
      insLog.run(misty, date, 60, 320, 26, 3.8, 17, "normal", "[]", null);
    } else {
      const id = Number(insLog.run(misty, date, 55, 360, 25, 3.75, 17, "normal",
        "[]", "Drinking noticeably more; found her at the water bowl three times today.").lastInsertRowid);
      evalQueue.push(id);
    }

    // Coco — healthy until a cough shows up today (dog-park exposure)
    if (i >= 1) {
      insLog.run(coco, date, jitter(250, 15, i), jitter(500, 30, i), jitter(120, 15, i), 12, jitter(12, 1, i), "normal", "[]", null);
    } else {
      const id = Number(insLog.run(coco, date, 220, 480, 50, 12, 14, "normal",
        JSON.stringify(["coughing", "sneezing", "lethargy"]), "Dry honking cough since last night. Was at the dog park on Sunday.").lastInsertRowid);
      evalQueue.push(id);
    }
  }

  // Run the real engine over the flagged logs (chronological order)
  const logPet = d.prepare("SELECT pet_id FROM logs WHERE id = ?");
  for (const logId of evalQueue) {
    const petId = (logPet.get(logId) as { pet_id: number }).pet_id;
    processLog(petId, logId);
  }

  // ── Appointment auto-suggested from Bruno's urgent alert ─────────────────
  const urgentAlert = d
    .prepare("SELECT id FROM alerts WHERE pet_id = ? AND severity = 'urgent' ORDER BY id DESC LIMIT 1")
    .get(bruno) as { id: number } | undefined;
  d.prepare(
    `INSERT INTO appointments (user_id, pet_id, vet_id, datetime, reason, status, triage_alert_id)
     VALUES (?,?,?,?,?,?,?)`
  ).run(ownerId, bruno, 1, `${daysAhead(1)}T10:30`, "Urgent triage: vomiting + no appetite + lethargy (engine score from alert)", "pending", urgentAlert?.id ?? null);
  d.prepare(
    `INSERT INTO appointments (user_id, pet_id, vet_id, datetime, reason, status)
     VALUES (?,?,?,?,?,'completed')`
  ).run(ownerId, misty, 3, `${daysAgo(40)}T16:00`, "Annual checkup + dental scaling assessment");

  // ── Reminders ─────────────────────────────────────────────────────────────
  const insRem = d.prepare(
    "INSERT INTO reminders (pet_id, type, title, due_date, repeat_days) VALUES (?,?,?,?,?)"
  );
  insRem.run(bruno, "vaccination", "Rabies booster", daysAhead(4), 365);
  insRem.run(coco, "medication", "Monthly deworming tablet", daysAgo(1), 30);
  insRem.run(misty, "checkup", "Senior wellness blood panel", daysAhead(20), 180);
  insRem.run(bruno, "medication", "Tick & flea spot-on", daysAhead(9), 30);

  // ── Expenses ──────────────────────────────────────────────────────────────
  const insExp = d.prepare(
    "INSERT INTO expenses (pet_id, category, description, amount, expense_date) VALUES (?,?,?,?,?)"
  );
  insExp.run(bruno, "food", "Royal Canin Labrador 12kg bag", 6800, daysAgo(20));
  insExp.run(bruno, "medication", "Tick & flea spot-on (3 pack)", 1350, daysAgo(18));
  insExp.run(bruno, "vet", "Consult — skin allergy flare", 800, daysAgo(45));
  insExp.run(misty, "vet", "Annual checkup + vaccines", 2400, daysAgo(40));
  insExp.run(misty, "food", "Persian adult dry food 3kg", 2150, daysAgo(15));
  insExp.run(misty, "grooming", "Full groom + dematting", 1200, daysAgo(12));
  insExp.run(coco, "food", "Puppy kibble 10kg", 4300, daysAgo(25));
  insExp.run(coco, "medication", "Deworming tablets x3", 450, daysAgo(31));
  insExp.run(coco, "other", "Replacement harness", 900, daysAgo(8));

  // ── Welcome notification ─────────────────────────────────────────────────
  d.prepare(
    "INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)"
  ).run(ownerId, "system", "Welcome to VetTracker 🐾",
    "Daily logs power the early-warning engine — the more you log, the smarter your pets' personal baselines get.",
    "/dashboard");
}
