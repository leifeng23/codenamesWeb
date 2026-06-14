import * as xlsx from "xlsx";
import { requireWordEditor } from "../../../../../lib/auth";
import { handleApiError } from "../../../../../lib/api";
import { prisma } from "../../../../../lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireWordEditor();
    const archives = await prisma.wordArchive.findMany({
      include: {
        categories: {
          include: { words: { orderBy: { textCn: "asc" } } },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
        }
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });

    const workbook = xlsx.utils.book_new();
    for (const archive of archives) {
      const rows = archive.categories.flatMap((category) =>
        category.words.map((word) => ({
          "二级分类": category.name,
          "中文词条": word.textCn,
          "英文或备注": word.textEnOrNote,
          "启用": word.enabled ? "是" : "否",
          "词条ID": word.id
        }))
      );
      const sheet = xlsx.utils.json_to_sheet(rows.length > 0 ? rows : [{ "二级分类": "", "中文词条": "", "英文或备注": "", "启用": "是", "词条ID": "" }]);
      xlsx.utils.book_append_sheet(workbook, sheet, archive.name.slice(0, 31));
    }
    const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });
    return new Response(buffer, {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="cosmere-codenames-words.xlsx"`
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
