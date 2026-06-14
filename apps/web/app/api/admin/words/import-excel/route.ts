import * as xlsx from "xlsx";
import { requireWordEditor } from "../../../../../lib/auth";
import { fail, handleApiError, ok } from "../../../../../lib/api";
import { prisma } from "../../../../../lib/prisma";

export const dynamic = "force-dynamic";

type ImportRow = Record<string, unknown>;

function clean(value: unknown) {
  return value == null ? "" : String(value).trim();
}

function enabledFrom(value: unknown) {
  const text = clean(value).toLowerCase();
  if (!text) return true;
  return !["false", "0", "否", "停用", "disabled"].includes(text);
}

export async function POST(request: Request) {
  try {
    await requireWordEditor();
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return fail("请上传 Excel 文件", 400);
    const selectedArchiveNames = new Set(
      formData
        .getAll("archiveNames")
        .map((value) => clean(value))
        .filter(Boolean)
    );

    const bytes = Buffer.from(await file.arrayBuffer());
    const workbook = xlsx.read(bytes, { type: "buffer" });
    if (workbook.SheetNames.length === 0) return fail("Excel 没有工作表", 400);

    let imported = 0;
    await prisma.$transaction(async (tx) => {
      const existingArchives = await tx.wordArchive.findMany({
        select: { name: true }
      });
      const existingArchiveNames = new Set(existingArchives.map((archive) => archive.name));
      for (const [sheetIndex, sheetName] of workbook.SheetNames.entries()) {
        if (
          selectedArchiveNames.size > 0 &&
          existingArchiveNames.has(sheetName) &&
          !selectedArchiveNames.has(sheetName)
        ) {
          continue;
        }
        const sheet = workbook.Sheets[sheetName];
        const rows = xlsx.utils.sheet_to_json<ImportRow>(sheet, { defval: "", raw: false });
        if (rows.length === 0) continue;

        const columns = Object.keys(rows[0] ?? {});
        for (const required of ["二级分类", "中文词条", "英文或备注"]) {
          if (!columns.includes(required)) throw new Error(`工作表「${sheetName}」缺少列：${required}`);
        }

        const archive = await tx.wordArchive.upsert({
          where: { name: sheetName },
          update: {},
          create: { name: sheetName, sortOrder: (sheetIndex + 1) * 10 }
        });
        const existingCategories = await tx.wordCategory.findMany({
          where: { archiveId: archive.id },
          select: { id: true }
        });
        await tx.wordEntry.deleteMany({
          where: { wordCategoryId: { in: existingCategories.map((category) => category.id) } }
        });
        await tx.wordCategory.deleteMany({ where: { archiveId: archive.id } });

        const categoryIds = new Map<string, string>();
        for (const row of rows) {
          const categoryName = clean(row["二级分类"]);
          const textCn = clean(row["中文词条"]);
          const textEnOrNote = clean(row["英文或备注"]);
          if (!categoryName || !textCn || !textEnOrNote) continue;

          let categoryId = categoryIds.get(categoryName);
          if (!categoryId) {
            const category = await tx.wordCategory.create({
              data: {
                archiveId: archive.id,
                name: categoryName,
                sortOrder: (categoryIds.size + 1) * 10
              }
            });
            categoryId = category.id;
            categoryIds.set(categoryName, categoryId);
          }
          await tx.wordEntry.create({
            data: {
              wordCategoryId: categoryId,
              textCn,
              textEnOrNote,
              enabled: enabledFrom(row["启用"]),
              sourceSheet: sheetName,
              sourceRow: imported + 2
            }
          });
          imported += 1;
        }
      }
    });

    return ok({ imported });
  } catch (error) {
    return handleApiError(error);
  }
}
