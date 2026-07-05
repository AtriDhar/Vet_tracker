// ─────────────────────────────────────────────────────────────────────────────
// Rule-Based Early Warning Engine
//
// 100% deterministic, 100% explainable. Every point added to the triage score
// carries a human-readable reason that is stored with the alert.
//
// Pipeline for each new daily log:
//   1. Personalized rolling baselines (this pet's own prior 7 logs)
//   2. Threshold rules       (water ↑, food ↓/none, weight drop, activity ↓, sleep ↑)
//   3. Stool rules
//   4. Weighted symptom scoring (each symptom has a point weight)
//   5. Combination rules     (named red-flag combos add bonus points)
//   6. Breed risk modifiers  (breed-prone categories add points + context)
//   7. Age modifier          (seniors escalate faster)
//   8. Tier mapping          score ≥ 8 → Urgent, ≥ 4 → Watch, ≥ 1 → Info
//      + emergency overrides (certain symptoms force Urgent regardless of score)
//   9. Contagion fan-out     (contagious symptoms flag other household pets)
// ─────────────────────────────────────────────────────────────────────────────

import {
  SYMPTOM_MAP,
  COMBO_RULES,
  STOOL_POINTS,
  type SymptomCategory,
} from "@/lib/data/symptoms";
import { breedRisksFor } from "@/lib/data/breeds";

export interface LogInput {
  log_date: string;
  food_grams: number | null;
  water_ml: number | null;
  activity_min: number | null;
  weight_kg: number | null;
  sleep_hours: number | null;
  stool: string | null;
  symptoms: string[];
}

export interface PetInput {
  id: number;
  name: string;
  species: string;
  breed: string | null;
  birth_date: string | null;
}

export type Severity = "info" | "watch" | "urgent";
export type Triage = "home" | "vet48" | "emergency";

export interface EngineResult {
  severity: Severity;
  triage: Triage;
  score: number;
  title: string;
  reasons: string[];
  tips: string[];
  suggestBooking: boolean;
  contagion: { condition: string; symptomLabel: string } | null;
}

const URGENT_AT = 8;
const WATCH_AT = 4;

function avg(nums: number[]): number | null {
  const v = nums.filter((n) => n != null && !isNaN(n));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

function pct(from: number, to: number): number {
  return Math.round(((to - from) / from) * 100);
}

function ageYears(birth: string | null): number | null {
  if (!birth) return null;
  const ms = Date.now() - new Date(birth).getTime();
  return ms / (365.25 * 24 * 3600 * 1000);
}

/** Baseline = mean of a metric over the pet's previous logs (up to 7 most recent). */
function baseline(history: LogInput[], key: keyof LogInput, minPoints = 3): number | null {
  const vals = history
    .slice(0, 7)
    .map((l) => l[key] as number | null)
    .filter((v): v is number => v != null && !isNaN(v) && v > 0);
  if (vals.length < minPoints) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/**
 * Evaluate a new log against the pet's history.
 * `history` must be prior logs sorted newest-first (excluding the new log).
 */
export function evaluateLog(pet: PetInput, log: LogInput, history: LogInput[]): EngineResult | null {
  let score = 0;
  const reasons: string[] = [];
  const tips: string[] = [];
  const touchedCategories = new Set<SymptomCategory | "weight" | "water">();
  let emergencyOverride = false;

  // ── 1–2. Threshold rules against personalized baselines ──────────────────
  const waterBase = baseline(history, "water_ml");
  if (waterBase && log.water_ml && log.water_ml > waterBase * 1.4) {
    const p = log.water_ml > waterBase * 1.8 ? 5 : 3;
    score += p;
    touchedCategories.add("water");
    reasons.push(
      `Water intake is up ${pct(waterBase, log.water_ml)}% vs ${pet.name}'s 7-day baseline (${Math.round(
        waterBase
      )} ml → ${Math.round(log.water_ml)} ml). Sustained thirst increases are an early signal of kidney disease or diabetes. [+${p}]`
    );
    // sustained 3-day check
    const last3 = avg([log.water_ml, ...history.slice(0, 2).map((l) => l.water_ml as number)].filter((n) => n != null) as number[]);
    const prior = baseline(history.slice(2), "water_ml");
    if (last3 && prior && last3 > prior * 1.4) {
      score += 2;
      reasons.push(
        `This is not a one-day spike — average intake over the last 3 days (${Math.round(last3)} ml) is ${pct(
          prior,
          last3
        )}% above the preceding week's baseline (${Math.round(prior)} ml). [+2]`
      );
    }
    tips.push("Measure water precisely for the next 48h (fill a marked bottle each morning).");
  }

  const foodBase = baseline(history, "food_grams");
  if (log.food_grams === 0) {
    score += 5;
    touchedCategories.add("gi");
    reasons.push(`${pet.name} ate nothing today. 24 hours without food is significant for dogs and dangerous for cats (risk of hepatic lipidosis). [+5]`);
    const yesterdayZero = history[0] && history[0].food_grams === 0;
    if (yesterdayZero) {
      score += 4;
      emergencyOverride = true;
      reasons.push(`Second consecutive day with zero food intake — this alone justifies a vet visit now. [+4, escalated]`);
    }
    tips.push("Offer a high-value bland food (boiled chicken + rice). If refused again, see a vet.");
  } else if (foodBase && log.food_grams != null && log.food_grams < foodBase * 0.5) {
    score += 3;
    touchedCategories.add("gi");
    reasons.push(
      `Food intake dropped ${Math.abs(pct(foodBase, log.food_grams))}% below baseline (${Math.round(foodBase)} g → ${Math.round(
        log.food_grams
      )} g). [+3]`
    );
  }

  // Weight: compare to best available reference from the past 7–30 logs
  const weightRef = baseline(history, "weight_kg", 2);
  if (weightRef && log.weight_kg) {
    const drop = (weightRef - log.weight_kg) / weightRef;
    if (drop > 0.1) {
      score += 7;
      touchedCategories.add("weight");
      reasons.push(
        `Weight has fallen ${Math.round(drop * 100)}% (${weightRef.toFixed(1)} kg → ${log.weight_kg.toFixed(
          1
        )} kg). A >10% unplanned loss is a serious systemic red flag. [+7]`
      );
    } else if (drop > 0.05) {
      score += 5;
      touchedCategories.add("weight");
      reasons.push(
        `Weight is down ${Math.round(drop * 100)}% against the recent average (${weightRef.toFixed(1)} kg → ${log.weight_kg.toFixed(
          1
        )} kg) — more than the 5% weekly threshold. [+5]`
      );
      tips.push("Re-weigh at the same time of day tomorrow to rule out scale/timing noise.");
    }
  }

  const actBase = baseline(history, "activity_min");
  if (actBase && log.activity_min != null && log.activity_min < actBase * 0.5) {
    score += 2;
    touchedCategories.add("mobility");
    touchedCategories.add("systemic");
    reasons.push(
      `Activity is down ${Math.abs(pct(actBase, log.activity_min))}% vs baseline (${Math.round(actBase)} min → ${Math.round(
        log.activity_min
      )} min) — pets hide pain by moving less. [+2]`
    );
  }

  const sleepBase = baseline(history, "sleep_hours");
  if (sleepBase && log.sleep_hours && log.sleep_hours > sleepBase * 1.4) {
    score += 2;
    touchedCategories.add("systemic");
    reasons.push(
      `Sleeping ${log.sleep_hours} h vs a baseline of ${sleepBase.toFixed(1)} h (+${pct(sleepBase, log.sleep_hours)}%) — excess sleep often accompanies illness or pain. [+2]`
    );
  }

  // ── 3. Stool ──────────────────────────────────────────────────────────────
  if (log.stool && STOOL_POINTS[log.stool] && STOOL_POINTS[log.stool].points > 0) {
    const s = STOOL_POINTS[log.stool];
    score += s.points;
    touchedCategories.add("gi");
    reasons.push(`${s.note} [+${s.points}]`);
    if (s.emergency) emergencyOverride = true;
    if (log.stool === "diarrhea") {
      const streak = history.slice(0, 2).filter((l) => l.stool === "diarrhea").length;
      if (streak >= 1) {
        score += 2;
        reasons.push(`Diarrhea logged ${streak + 1} days in a row — dehydration risk compounds daily. [+2]`);
      }
      tips.push("Ensure constant water access; feed small bland meals. Persisting past 48h needs a vet.");
    }
  }

  // ── 4. Weighted symptom scoring ───────────────────────────────────────────
  let contagion: EngineResult["contagion"] = null;
  for (const key of log.symptoms) {
    const def = SYMPTOM_MAP[key];
    if (!def) continue;
    score += def.weight;
    touchedCategories.add(def.category);
    reasons.push(`Symptom: ${def.label} (weight ${def.weight}). [+${def.weight}]`);
    if (def.emergency) {
      emergencyOverride = true;
      reasons.push(`⚠ ${def.label} is an emergency-tier symptom — it forces the Urgent tier regardless of total score.`);
    }
    if (def.contagious && !contagion) {
      contagion = { condition: def.contagious, symptomLabel: def.label };
    }
  }

  // ── 5. Combination rules ──────────────────────────────────────────────────
  const symptomSet = new Set(log.symptoms);
  if (log.food_grams === 0) symptomSet.add("no_appetite"); // zero food counts as no appetite for combos
  for (const combo of COMBO_RULES) {
    if (combo.keys.every((k) => symptomSet.has(k))) {
      score += combo.bonus;
      reasons.push(`${combo.explanation} [combo +${combo.bonus}]`);
    }
  }

  // ── 6. Breed risk modifiers ───────────────────────────────────────────────
  const risks = breedRisksFor(pet.species, pet.breed);
  for (const risk of risks) {
    if (touchedCategories.has(risk.category)) {
      score += 2;
      reasons.push(`Breed risk: ${pet.breed} → ${risk.condition}. ${risk.note} [breed +2]`);
    }
  }

  // ── 7. Age modifier ───────────────────────────────────────────────────────
  const age = ageYears(pet.birth_date);
  const seniorAt = pet.species === "cat" ? 10 : 8;
  if (age && age >= seniorAt && score >= 2) {
    score += 1;
    reasons.push(`${pet.name} is a senior (${age.toFixed(0)} yrs) — issues progress faster in older pets, so we escalate slightly sooner. [senior +1]`);
  }

  if (score === 0) return null; // nothing noteworthy — no alert

  // ── 8. Tier mapping ───────────────────────────────────────────────────────
  let severity: Severity = score >= URGENT_AT ? "urgent" : score >= WATCH_AT ? "watch" : "info";
  if (emergencyOverride) severity = "urgent";

  const triage: Triage = severity === "urgent" ? "emergency" : severity === "watch" ? "vet48" : "home";

  if (severity === "info") {
    tips.push("Keep logging daily — trends over 3+ days are far more meaningful than single readings.");
  }
  if (severity === "watch") {
    tips.push("Book a routine vet visit within 48 hours. Bring the exported health report.");
  }
  if (severity === "urgent") {
    tips.length = 0;
    tips.push("Do not wait — contact an emergency vet now. The nearest 24-hr hospitals are listed with this alert.");
  }

  const title =
    severity === "urgent"
      ? `Urgent: ${pet.name} needs veterinary attention`
      : severity === "watch"
      ? `Watch: concerning pattern for ${pet.name}`
      : `Info: minor observation for ${pet.name}`;

  return {
    severity,
    triage,
    score,
    title,
    reasons,
    tips,
    suggestBooking: severity !== "info",
    contagion: contagion && score >= WATCH_AT ? contagion : null,
  };
}

/** Build the household contagion warning for a sibling pet. */
export function contagionAlertFor(
  sourcePet: PetInput,
  siblingPet: PetInput,
  contagion: { condition: string; symptomLabel: string }
): Omit<EngineResult, "contagion" | "suggestBooking"> {
  return {
    severity: "watch",
    triage: "home",
    score: 0,
    title: `Contagion risk for ${siblingPet.name}`,
    reasons: [
      `${sourcePet.name} in the same household triggered an alert including "${contagion.symptomLabel}", which can indicate ${contagion.condition} — a condition transmissible between pets.`,
      `Household pets sharing bowls, bedding or grooming tools are at elevated risk.`,
    ],
    tips: [
      `Separate food/water bowls and bedding for ${siblingPet.name} until ${sourcePet.name} is cleared.`,
      `Watch ${siblingPet.name} closely for the same symptoms over the next 5–7 days and log daily.`,
    ],
  };
}
