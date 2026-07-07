// First-run seeder, invoked automatically by db() on an empty database.
//
// Two independent layers:
//   · Reference data (vet directory) — always seeded when the vets table is empty.
//   · Demo data (accounts, pets, 14 days of logs, alerts) — seeded unless
//     SEED_DEMO=false. The interesting logs run through the REAL rule engine,
//     so the demo alert history is genuine engine output, not fixtures.

import bcrypt from "bcryptjs";
import type { Db } from "./db";
import { newShareToken } from "./db";
import { processLog } from "./service";

export async function ensureSeeded(d: Db) {
  const vetCount = await d.get<{ c: number }>("SELECT COUNT(*) AS c FROM vets");
  if ((vetCount?.c ?? 0) === 0) await seedVets(d);

  if (process.env.SEED_DEMO === "false") return;
  const userCount = await d.get<{ c: number }>("SELECT COUNT(*) AS c FROM users");
  if ((userCount?.c ?? 0) === 0) await seedDemo(d);
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400_000).toISOString().slice(0, 10);
}
function daysAhead(n: number): string {
  return new Date(Date.now() + n * 86400_000).toISOString().slice(0, 10);
}

async function seedVets(d: Db) {
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
  for (const v of vets) {
    await d.run(
      "INSERT INTO vets (name, clinic, specialty, city, address, phone, hours, emergency, rating) VALUES (?,?,?,?,?,?,?,?,?)",
      v
    );
  }
}

async function seedDemo(d: Db) {
  // ── Users ─────────────────────────────────────────────────────────────────
  const owner = await d.run(
    "INSERT INTO users (email, password_hash, name, phone, address, role) VALUES (?,?,?,?,?,'owner')",
    ["demo@vettracker.app", bcrypt.hashSync("demo1234", 10), "Aarav Sharma", "+91 98765 43210",
      "C-304, Utopia Heights, Patia, Bhubaneswar"]
  );
  const ownerId = owner.lastInsertRowid;
  await d.run(
    "INSERT INTO users (email, password_hash, name, phone, role, vet_id) VALUES (?,?,?,?,'vet',1)",
    ["vet@vettracker.app", bcrypt.hashSync("vet1234", 10), "Dr. Ananya Rao", "+91 98530 11223"]
  );

  // ── Pets ──────────────────────────────────────────────────────────────────
  const insPet = (args: (string | number | null)[]) =>
    d.run(
      `INSERT INTO pets (user_id, name, species, breed, sex, birth_date, weight_kg, photo, notes, share_token)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      args
    );
  const bruno = (await insPet([ownerId, "Bruno", "dog", "Labrador Retriever", "male",
    daysAgo(Math.round(6 * 365.25)), 32, "🐕",
    "Neutered. Mild seasonal skin allergies. Vaccinations up to date except rabies booster due this month.",
    newShareToken()])).lastInsertRowid;
  const misty = (await insPet([ownerId, "Misty", "cat", "Persian", "female",
    daysAgo(Math.round(8 * 365.25)), 3.8, "🐈",
    "Indoor cat. Spayed. Grade 1 dental tartar noted at last checkup.",
    newShareToken()])).lastInsertRowid;
  const coco = (await insPet([ownerId, "Coco", "dog", "Beagle", "female",
    daysAgo(Math.round(2 * 365.25)), 12, "🐶",
    "Very food-motivated. Attends weekend park meetups (dog-park exposure).",
    newShareToken()])).lastInsertRowid;

  // ── 14 days of logs ───────────────────────────────────────────────────────
  const insLog = (args: (string | number | null)[]) =>
    d.run(
      `INSERT INTO logs (pet_id, log_date, food_grams, water_ml, activity_min, weight_kg, sleep_hours, stool, symptoms, notes)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      args
    );
  const jitter = (base: number, spread: number, i: number) =>
    Math.round(base + Math.sin(i * 2.3) * spread);

  const evalQueue: { petId: number; logId: number }[] = [];

  for (let i = 13; i >= 0; i--) {
    const date = daysAgo(i);

    // Bruno — healthy baseline, limps on day -1, crashes today
    if (i >= 2) {
      await insLog([bruno, date, jitter(400, 25, i), jitter(900, 60, i), jitter(90, 12, i), 32, jitter(12, 1, i), "normal", "[]", null]);
    } else if (i === 1) {
      const r = await insLog([bruno, date, 380, 880, 35, 32, 13, "normal",
        JSON.stringify(["limping"]), "Favoring right hind leg after the evening walk."]);
      evalQueue.push({ petId: bruno, logId: r.lastInsertRowid });
    } else {
      const r = await insLog([bruno, date, 0, 400, 30, 31.8, 15, "soft",
        JSON.stringify(["vomiting", "lethargy"]), "Vomited twice this morning, refused breakfast and dinner. Very flat."]);
      evalQueue.push({ petId: bruno, logId: r.lastInsertRowid });
    }

    // Misty — quiet water-intake ramp over the last 3 days (early kidney pattern)
    if (i >= 3) {
      await insLog([misty, date, jitter(60, 5, i), jitter(200, 12, i), jitter(30, 6, i), 3.8, jitter(16, 1, i), "normal", "[]", null]);
    } else if (i === 2) {
      await insLog([misty, date, 58, 300, 28, 3.8, 16, "normal", "[]", "Refilled the bowl earlier than usual."]);
    } else if (i === 1) {
      await insLog([misty, date, 60, 320, 26, 3.8, 17, "normal", "[]", null]);
    } else {
      const r = await insLog([misty, date, 55, 360, 25, 3.75, 17, "normal",
        "[]", "Drinking noticeably more; found her at the water bowl three times today."]);
      evalQueue.push({ petId: misty, logId: r.lastInsertRowid });
    }

    // Coco — healthy until a cough shows up today (dog-park exposure)
    if (i >= 1) {
      await insLog([coco, date, jitter(250, 15, i), jitter(500, 30, i), jitter(120, 15, i), 12, jitter(12, 1, i), "normal", "[]", null]);
    } else {
      const r = await insLog([coco, date, 220, 480, 50, 12, 14, "normal",
        JSON.stringify(["coughing", "sneezing", "lethargy"]), "Dry honking cough since last night. Was at the dog park on Sunday."]);
      evalQueue.push({ petId: coco, logId: r.lastInsertRowid });
    }
  }

  // Run the real engine over the flagged logs (chronological order)
  for (const { petId, logId } of evalQueue) {
    await processLog(d, petId, logId);
  }

  // ── Appointment auto-suggested from Bruno's urgent alert ─────────────────
  const urgentAlert = await d.get<{ id: number }>(
    "SELECT id FROM alerts WHERE pet_id = ? AND severity = 'urgent' ORDER BY id DESC LIMIT 1",
    [bruno]
  );
  await d.run(
    `INSERT INTO appointments (user_id, pet_id, vet_id, datetime, reason, status, triage_alert_id)
     VALUES (?,?,?,?,?,?,?)`,
    [ownerId, bruno, 1, `${daysAhead(1)}T10:30`,
      "Urgent triage: vomiting + no appetite + lethargy (engine score from alert)", "pending",
      urgentAlert?.id ?? null]
  );
  await d.run(
    `INSERT INTO appointments (user_id, pet_id, vet_id, datetime, reason, status)
     VALUES (?,?,?,?,?,'completed')`,
    [ownerId, misty, 3, `${daysAgo(40)}T16:00`, "Annual checkup + dental scaling assessment"]
  );

  // ── Reminders ─────────────────────────────────────────────────────────────
  const insRem = (args: (string | number | null)[]) =>
    d.run("INSERT INTO reminders (pet_id, type, title, due_date, repeat_days) VALUES (?,?,?,?,?)", args);
  await insRem([bruno, "vaccination", "Rabies booster", daysAhead(4), 365]);
  await insRem([coco, "medication", "Monthly deworming tablet", daysAgo(1), 30]);
  await insRem([misty, "checkup", "Senior wellness blood panel", daysAhead(20), 180]);
  await insRem([bruno, "medication", "Tick & flea spot-on", daysAhead(9), 30]);

  // ── Expenses ──────────────────────────────────────────────────────────────
  const insExp = (args: (string | number | null)[]) =>
    d.run("INSERT INTO expenses (pet_id, category, description, amount, expense_date) VALUES (?,?,?,?,?)", args);
  await insExp([bruno, "food", "Royal Canin Labrador 12kg bag", 6800, daysAgo(20)]);
  await insExp([bruno, "medication", "Tick & flea spot-on (3 pack)", 1350, daysAgo(18)]);
  await insExp([bruno, "vet", "Consult — skin allergy flare", 800, daysAgo(45)]);
  await insExp([misty, "vet", "Annual checkup + vaccines", 2400, daysAgo(40)]);
  await insExp([misty, "food", "Persian adult dry food 3kg", 2150, daysAgo(15)]);
  await insExp([misty, "grooming", "Full groom + dematting", 1200, daysAgo(12)]);
  await insExp([coco, "food", "Puppy kibble 10kg", 4300, daysAgo(25)]);
  await insExp([coco, "medication", "Deworming tablets x3", 450, daysAgo(31)]);
  await insExp([coco, "other", "Replacement harness", 900, daysAgo(8)]);

  // ── Welcome notification ─────────────────────────────────────────────────
  await d.run(
    "INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)",
    [ownerId, "system", "Welcome to VetTracker 🐾",
      "Daily logs power the early-warning engine — the more you log, the smarter your pets' personal baselines get.",
      "/dashboard"]
  );
}
