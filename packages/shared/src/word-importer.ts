import path from "path";
import * as xlsx from "xlsx";
import { WORD_CATEGORIES, type WordCategoryDefinition } from "./categories";
import type { WordEntrySeed } from "./types";

type Row = Record<string, unknown> & { __rowNum__: number };

function clean(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function rowsForSheet(workbook: xlsx.WorkBook, sheetName: string): Row[] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Missing sheet: ${sheetName}`);
  }

  const rows = xlsx.utils.sheet_to_json<Row>(sheet, {
    defval: "",
    raw: false
  });

  return rows.filter((row) => row.__rowNum__ >= 2);
}

function extractCategory(rows: Row[], definition: WordCategoryDefinition): WordEntrySeed[] {
  return rows.flatMap((row) => {
    const textCn = clean(row[definition.textField]);
    const textEnOrNote = clean(row[definition.noteField]);
    if (!textCn || !textEnOrNote) return [];

    return [
      {
        universe: definition.universe,
        category: definition.category,
        textCn,
        textEnOrNote,
        sourceSheet: definition.sheet,
        sourceRow: row.__rowNum__ + 1,
        enabled: true
      }
    ];
  });
}

export function loadWordEntriesFromExcel(excelPath: string): WordEntrySeed[] {
  const workbook = xlsx.readFile(excelPath);
  const rowsBySheet = new Map<string, Row[]>();

  return WORD_CATEGORIES.flatMap((definition) => {
    if (!rowsBySheet.has(definition.sheet)) {
      rowsBySheet.set(definition.sheet, rowsForSheet(workbook, definition.sheet));
    }
    return extractCategory(rowsBySheet.get(definition.sheet)!, definition);
  });
}

export function defaultUnityExcelPath() {
  const unityPath =
    process.env.UNITY_PROJECT_PATH ??
    path.resolve(process.cwd(), "../CosmereCodesName");
  return path.join(unityPath, "Assets/Excel/CosmereCodesName.xlsx");
}
