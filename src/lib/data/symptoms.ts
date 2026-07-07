// Symptom catalog — the heart of the weighted rule engine.
// Each symptom has a point weight; the engine sums weights (plus threshold-rule
// points and breed/age modifiers) into a triage score.
// `emergency: true` symptoms force the Urgent tier regardless of total score.
// `contagious` names the condition used for household contagion warnings.

export type SymptomCategory =
  | "gi"
  | "respiratory"
  | "neuro"
  | "mobility"
  | "skin"
  | "systemic"
  | "urinary"
  | "cardiac";

export interface SymptomDef {
  key: string;
  label: string;
  weight: number;
  category: SymptomCategory;
  emergency?: boolean;
  contagious?: string; // condition name shown in household warnings
}

export const SYMPTOMS: SymptomDef[] = [
  { key: "vomiting", label: "Vomiting", weight: 3, category: "gi" },
  { key: "no_appetite", label: "No appetite", weight: 3, category: "gi" },
  { key: "lethargy", label: "Lethargy / low energy", weight: 2, category: "systemic" },
  { key: "coughing", label: "Coughing", weight: 2, category: "respiratory", contagious: "kennel cough / respiratory infection" },
  { key: "sneezing", label: "Sneezing", weight: 1, category: "respiratory", contagious: "upper respiratory infection" },
  { key: "limping", label: "Limping", weight: 2, category: "mobility" },
  { key: "scratching", label: "Excessive scratching", weight: 1, category: "skin", contagious: "fleas / mites / ringworm" },
  { key: "hair_loss", label: "Hair loss / bald patches", weight: 2, category: "skin", contagious: "ringworm / mange" },
  { key: "fever", label: "Fever / hot ears & nose", weight: 3, category: "systemic" },
  { key: "shaking", label: "Shaking / trembling", weight: 3, category: "neuro" },
  { key: "excessive_thirst", label: "Excessive thirst", weight: 2, category: "urinary" },
  { key: "frequent_urination", label: "Frequent urination", weight: 2, category: "urinary" },
  { key: "straining_urinate", label: "Straining to urinate", weight: 5, category: "urinary", emergency: true },
  { key: "breathing_difficulty", label: "Difficulty breathing", weight: 6, category: "respiratory", emergency: true },
  { key: "seizure", label: "Seizure", weight: 6, category: "neuro", emergency: true },
  { key: "collapse", label: "Collapse / fainting", weight: 6, category: "cardiac", emergency: true },
  { key: "bleeding", label: "Visible bleeding", weight: 5, category: "systemic", emergency: true },
  { key: "bloated_abdomen", label: "Bloated / hard abdomen", weight: 5, category: "gi", emergency: true },
  { key: "pale_gums", label: "Pale / white gums", weight: 5, category: "cardiac", emergency: true },
  { key: "eye_discharge", label: "Eye discharge / redness", weight: 1, category: "systemic", contagious: "conjunctivitis" },
  { key: "bad_breath", label: "Unusually bad breath", weight: 1, category: "gi" },
  { key: "aggression", label: "Sudden aggression / hiding", weight: 2, category: "neuro" },
];

export const SYMPTOM_MAP: Record<string, SymptomDef> = Object.fromEntries(
  SYMPTOMS.map((s) => [s.key, s])
);

// Named combination rules: when every symptom in `keys` is present,
// bonus points are added and the explanation is included in the alert.
export const COMBO_RULES: { keys: string[]; bonus: number; explanation: string }[] = [
  {
    keys: ["vomiting", "lethargy", "no_appetite"],
    bonus: 3,
    explanation:
      "Red-flag combination: vomiting + lethargy + no appetite together suggest a systemic issue (GI obstruction, pancreatitis, infection) rather than a simple upset stomach.",
  },
  {
    keys: ["excessive_thirst", "frequent_urination"],
    bonus: 3,
    explanation:
      "Combination of excessive thirst + frequent urination is the classic presentation of diabetes or kidney disease and warrants blood work.",
  },
  {
    keys: ["coughing", "breathing_difficulty"],
    bonus: 2,
    explanation:
      "Coughing combined with labored breathing can indicate heart or serious lower-airway disease.",
  },
  {
    keys: ["vomiting", "bloated_abdomen"],
    bonus: 4,
    explanation:
      "Vomiting (or retching) with a bloated abdomen is the hallmark of GDV/bloat — a life-threatening emergency in dogs.",
  },
  {
    keys: ["shaking", "fever"],
    bonus: 2,
    explanation: "Trembling with fever suggests pain or infection that needs professional assessment.",
  },
];

export const STOOL_POINTS: Record<string, { points: number; note?: string; emergency?: boolean }> = {
  normal: { points: 0 },
  soft: { points: 1, note: "Soft stool logged — monitor hydration and diet." },
  diarrhea: { points: 2, note: "Diarrhea logged — risk of dehydration; withhold rich food, ensure water access." },
  constipated: { points: 1, note: "Constipation logged — monitor; can indicate dehydration or obstruction if persistent." },
  bloody: { points: 5, note: "Blood in stool is never normal — this alone warrants a vet visit.", emergency: true },
};
