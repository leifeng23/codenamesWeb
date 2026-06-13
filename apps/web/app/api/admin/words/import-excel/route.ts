import { requireAdmin } from "../../../../../lib/auth";
import { handleApiError, ok } from "../../../../../lib/api";
import { prisma } from "../../../../../lib/prisma";
import { defaultUnityExcelPath, loadWordEntriesFromExcel } from "@cosmere/shared/word-importer";

export async function POST() {
  try {
    await requireAdmin();
    const entries = loadWordEntriesFromExcel(defaultUnityExcelPath());
    await prisma.$transaction(async (tx) => {
      await tx.wordEntry.deleteMany();
      await tx.wordEntry.createMany({ data: entries });
    });
    return ok({ imported: entries.length });
  } catch (error) {
    return handleApiError(error);
  }
}
