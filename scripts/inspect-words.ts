import { WORD_CATEGORY_LABELS } from "@cosmere/shared";
import { defaultUnityExcelPath, loadWordEntriesFromExcel } from "./word-importer";

const entries = loadWordEntriesFromExcel(defaultUnityExcelPath());
const byCategory = entries.reduce<Record<string, number>>((counts, entry) => {
  counts[entry.category] = (counts[entry.category] ?? 0) + 1;
  return counts;
}, {});

console.log(`Loaded ${entries.length} word entries`);
for (const [category, count] of Object.entries(byCategory)) {
  console.log(`${WORD_CATEGORY_LABELS[category as keyof typeof WORD_CATEGORY_LABELS]} (${category}): ${count}`);
}

const duplicatePairs = new Map<string, number>();
for (const entry of entries) {
  const key = `${entry.textCn}\u0000${entry.textEnOrNote}`;
  duplicatePairs.set(key, (duplicatePairs.get(key) ?? 0) + 1);
}

const duplicates = [...duplicatePairs.entries()].filter(([, count]) => count > 1);
console.log(`Duplicate cn+note pairs: ${duplicates.length}`);
