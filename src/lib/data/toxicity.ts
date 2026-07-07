// Medication & food toxicity lookup table.
// Severity ladder: deadly > dangerous > caution > safe.

export interface ToxEntry {
  name: string;
  aliases: string[];
  dog: "deadly" | "dangerous" | "caution" | "safe";
  cat: "deadly" | "dangerous" | "caution" | "safe";
  note: string;
}

export const TOXICITY: ToxEntry[] = [
  { name: "Chocolate", aliases: ["cocoa", "dark chocolate", "cacao", "brownie"], dog: "dangerous", cat: "dangerous", note: "Theobromine poisoning — darker chocolate is worse. Causes vomiting, tremors, seizures, heart arrhythmia." },
  { name: "Xylitol", aliases: ["sugar-free gum", "birch sugar", "sugar free candy", "sugarfree"], dog: "deadly", cat: "caution", note: "Even tiny amounts cause fatal insulin spikes and liver failure in dogs. Check peanut butter and gum labels." },
  { name: "Grapes / Raisins", aliases: ["grape", "raisin", "sultana", "currant"], dog: "deadly", cat: "dangerous", note: "Causes acute kidney failure in dogs — no known safe dose. Go to a vet immediately if ingested." },
  { name: "Onion", aliases: ["onions", "shallot", "leek", "chives"], dog: "dangerous", cat: "deadly", note: "Damages red blood cells causing anemia. Cats are especially sensitive — includes onion powder in cooked food." },
  { name: "Garlic", aliases: ["garlic powder"], dog: "dangerous", cat: "deadly", note: "5x more potent than onion. Small repeated doses accumulate." },
  { name: "Paracetamol (Tylenol)", aliases: ["tylenol", "acetaminophen", "crocin", "dolo", "calpol"], dog: "dangerous", cat: "deadly", note: "A single tablet can kill a cat — cats cannot metabolize it. Toxic to dogs at moderate doses. Never give without a vet." },
  { name: "Ibuprofen", aliases: ["advil", "brufen", "nurofen", "motrin"], dog: "deadly", cat: "deadly", note: "Human NSAIDs cause stomach ulcers and kidney failure in pets. Never give human painkillers." },
  { name: "Aspirin", aliases: ["disprin", "ecosprin", "acetylsalicylic"], dog: "dangerous", cat: "deadly", note: "Cats cannot clear aspirin. Only ever use under direct veterinary dosing." },
  { name: "Naproxen", aliases: ["aleve", "naprosyn"], dog: "deadly", cat: "deadly", note: "One of the most toxic human NSAIDs for pets — a single tablet can cause kidney failure." },
  { name: "Lilies", aliases: ["lily", "easter lily", "tiger lily", "daylily"], dog: "caution", cat: "deadly", note: "Every part — even pollen or vase water — causes fatal kidney failure in cats within days." },
  { name: "Macadamia nuts", aliases: ["macadamia"], dog: "dangerous", cat: "caution", note: "Causes weakness, tremors and hyperthermia in dogs within 12 hours." },
  { name: "Avocado", aliases: ["guacamole"], dog: "caution", cat: "caution", note: "Persin causes GI upset; the pit is a dangerous obstruction hazard." },
  { name: "Alcohol", aliases: ["beer", "wine", "whiskey", "vodka", "ethanol"], dog: "dangerous", cat: "dangerous", note: "Pets are far more sensitive than humans — even small amounts cause dangerous drops in blood sugar and temperature." },
  { name: "Caffeine", aliases: ["coffee", "tea", "energy drink", "espresso", "red bull"], dog: "dangerous", cat: "dangerous", note: "Causes racing heart, tremors and seizures. Coffee grounds and tea bags are concentrated sources." },
  { name: "Raw bread dough", aliases: ["yeast dough", "raw dough"], dog: "dangerous", cat: "dangerous", note: "Expands in the stomach and ferments into alcohol — double emergency." },
  { name: "Antifreeze", aliases: ["ethylene glycol", "coolant", "radiator fluid"], dog: "deadly", cat: "deadly", note: "Sweet-tasting and rapidly fatal via kidney failure. Minutes matter — go to an emergency vet immediately." },
  { name: "Rat poison", aliases: ["rodenticide", "rat bait", "mouse poison"], dog: "deadly", cat: "deadly", note: "Causes internal bleeding days after ingestion. Bring the packaging to the emergency vet." },
  { name: "Cannabis", aliases: ["marijuana", "weed", "thc", "edibles"], dog: "dangerous", cat: "dangerous", note: "Causes wobbliness, urine dribbling, and in edibles is often combined with chocolate/xylitol." },
  { name: "Permethrin", aliases: ["dog flea treatment on cat", "flea spot-on"], dog: "safe", cat: "deadly", note: "Dog flea treatments containing permethrin kill cats. Never use dog spot-ons on cats." },
  { name: "Sago palm", aliases: ["cycad", "sago"], dog: "deadly", cat: "deadly", note: "All parts, especially seeds, cause liver failure. Common decorative plant." },
  { name: "Tulips / Daffodils", aliases: ["tulip", "daffodil", "hyacinth", "bulb plants"], dog: "dangerous", cat: "dangerous", note: "Bulbs are the most toxic part — a risk for digging dogs." },
  { name: "Essential oils", aliases: ["tea tree oil", "eucalyptus oil", "peppermint oil", "diffuser"], dog: "caution", cat: "dangerous", note: "Cats lack the liver enzymes to process essential oils — diffusers in closed rooms are a real risk." },
  { name: "Cooked bones", aliases: ["chicken bones", "cooked bone"], dog: "dangerous", cat: "dangerous", note: "Splinter and perforate the gut. Raw meaty bones are safer but still supervise." },
  { name: "Salt / salty snacks", aliases: ["chips", "namkeen", "pretzels", "salt dough"], dog: "caution", cat: "caution", note: "Large amounts cause sodium poisoning — tremors, seizures. Keep party snacks away." },
  { name: "Milk / dairy", aliases: ["milk", "cream", "ice cream"], dog: "caution", cat: "caution", note: "Most adult pets are lactose intolerant — expect diarrhea, not death. Small amounts of cheese are usually fine." },
  { name: "Peanut butter (xylitol-free)", aliases: ["peanut butter"], dog: "safe", cat: "safe", note: "Safe in moderation — but ALWAYS check the label for xylitol, which is deadly." },
  { name: "Plain rice", aliases: ["rice", "boiled rice"], dog: "safe", cat: "safe", note: "Bland and safe — classic upset-stomach food with boiled chicken." },
  { name: "Pumpkin", aliases: ["boiled pumpkin", "pumpkin puree"], dog: "safe", cat: "safe", note: "Plain cooked pumpkin helps both diarrhea and constipation." },
  { name: "Carrots", aliases: ["carrot"], dog: "safe", cat: "safe", note: "Healthy low-calorie treat. Cut to size to avoid choking." },
  { name: "Blueberries", aliases: ["blueberry", "strawberry", "banana", "watermelon"], dog: "safe", cat: "safe", note: "Safe fruits in moderation. Remove seeds/rind from melon; no grapes ever." },
  { name: "Cetirizine (Zyrtec)", aliases: ["zyrtec", "cetirizine"], dog: "caution", cat: "caution", note: "Sometimes prescribed by vets for allergies — but dose is weight-specific. Ask your vet first; never use formulations with decongestants (pseudoephedrine is toxic)." },
  { name: "Diphenhydramine (Benadryl)", aliases: ["benadryl"], dog: "caution", cat: "caution", note: "Vets do prescribe it, but the dose is per-kg and some formulations contain toxic additives. Confirm with your vet before giving." },
];

export function searchToxicity(query: string): ToxEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return TOXICITY.filter(
    (t) => t.name.toLowerCase().includes(q) || t.aliases.some((a) => a.includes(q) || q.includes(a))
  );
}
