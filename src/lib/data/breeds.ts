// Breed-specific risk profiles — static veterinary knowledge table.
// The engine matches the pet's breed (substring, case-insensitive) and adds
// modifier points + an explanation when a triggered rule touches a risk category.

import type { SymptomCategory } from "./symptoms";

export interface BreedRisk {
  match: string[]; // lowercase substrings to match against pet.breed
  species: "dog" | "cat";
  risks: { category: SymptomCategory | "weight" | "water"; condition: string; note: string }[];
}

export const BREED_RISKS: BreedRisk[] = [
  {
    match: ["labrador", "lab retriever"],
    species: "dog",
    risks: [
      { category: "mobility", condition: "Hip/elbow dysplasia", note: "Labradors are high-risk for joint disorders — limping and activity drops are weighted higher." },
      { category: "weight", condition: "Obesity", note: "Labradors gain weight easily; weight changes deserve closer attention." },
    ],
  },
  {
    match: ["golden retriever"],
    species: "dog",
    risks: [
      { category: "mobility", condition: "Hip dysplasia", note: "Golden Retrievers are predisposed to hip dysplasia." },
      { category: "systemic", condition: "Cancer (lymphoma, hemangiosarcoma)", note: "Goldens have elevated cancer rates — persistent lethargy or appetite loss should be checked early." },
    ],
  },
  {
    match: ["german shepherd", "gsd", "alsatian"],
    species: "dog",
    risks: [
      { category: "mobility", condition: "Hip dysplasia / degenerative myelopathy", note: "German Shepherds are prone to hip and spinal disease." },
      { category: "gi", condition: "Bloat (GDV)", note: "Deep-chested breed — GI distress with a bloated abdomen is a true emergency." },
    ],
  },
  {
    match: ["pug", "bulldog", "boxer", "shih tzu", "boston terrier", "pekingese"],
    species: "dog",
    risks: [
      { category: "respiratory", condition: "Brachycephalic airway syndrome", note: "Flat-faced breeds have narrow airways — any breathing symptom is more serious than in other breeds." },
    ],
  },
  {
    match: ["dachshund", "corgi", "basset"],
    species: "dog",
    risks: [
      { category: "mobility", condition: "IVDD (spinal disc disease)", note: "Long-backed breeds are prone to disc disease — limping, trembling or reluctance to move can signal spinal pain." },
      { category: "neuro", condition: "IVDD (spinal disc disease)", note: "Trembling or sudden behavior change in this breed can be spinal pain — handle gently and see a vet." },
    ],
  },
  {
    match: ["beagle"],
    species: "dog",
    risks: [
      { category: "neuro", condition: "Epilepsy", note: "Beagles have above-average epilepsy rates — tremors or seizures need neurological workup." },
      { category: "weight", condition: "Obesity", note: "Beagles are food-driven and gain weight easily." },
    ],
  },
  {
    match: ["poodle"],
    species: "dog",
    risks: [
      { category: "neuro", condition: "Epilepsy", note: "Poodles carry elevated epilepsy risk." },
      { category: "gi", condition: "Bloat (standard poodles)", note: "Standard Poodles are deep-chested and at risk of bloat." },
    ],
  },
  {
    match: ["yorkshire", "yorkie"],
    species: "dog",
    risks: [
      { category: "respiratory", condition: "Tracheal collapse", note: "Yorkies commonly develop tracheal collapse — a honking cough is characteristic." },
    ],
  },
  {
    match: ["rottweiler", "great dane", "doberman"],
    species: "dog",
    risks: [
      { category: "cardiac", condition: "Dilated cardiomyopathy", note: "Large breeds are prone to heart muscle disease — collapse, pale gums or exercise intolerance are red flags." },
      { category: "gi", condition: "Bloat (GDV)", note: "Deep-chested giant breed — bloated abdomen with retching is an emergency." },
    ],
  },
  {
    match: ["persian", "himalayan", "exotic shorthair"],
    species: "cat",
    risks: [
      { category: "water", condition: "Polycystic kidney disease", note: "Persian-type cats carry high PKD risk — rising water intake is an early kidney red flag for this breed." },
      { category: "urinary", condition: "Kidney disease", note: "Persians are predisposed to kidney disease; urinary changes matter more in this breed." },
      { category: "respiratory", condition: "Brachycephalic airway", note: "Flat-faced cats have compromised airways." },
    ],
  },
  {
    match: ["siamese", "oriental"],
    species: "cat",
    risks: [
      { category: "respiratory", condition: "Feline asthma", note: "Siamese cats are prone to asthma — coughing/wheezing warrants a chest exam." },
    ],
  },
  {
    match: ["maine coon", "ragdoll", "sphynx", "british shorthair"],
    species: "cat",
    risks: [
      { category: "cardiac", condition: "Hypertrophic cardiomyopathy (HCM)", note: "This breed is predisposed to HCM — breathing changes, lethargy or collapse need urgent cardiac assessment." },
    ],
  },
  {
    match: ["domestic shorthair", "domestic longhair", "moggie", "indie"],
    species: "cat",
    risks: [
      { category: "urinary", condition: "Feline lower urinary tract disease (FLUTD)", note: "Straining to urinate — especially in male cats — can mean a blocked bladder, which is fatal within days if untreated." },
    ],
  },
];

export function breedRisksFor(species: string, breed: string | null | undefined): BreedRisk["risks"] {
  if (!breed) return [];
  const b = breed.toLowerCase();
  const out: BreedRisk["risks"] = [];
  for (const entry of BREED_RISKS) {
    if (entry.species !== species) continue;
    if (entry.match.some((m) => b.includes(m))) out.push(...entry.risks);
  }
  return out;
}
