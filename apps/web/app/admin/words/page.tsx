import { WordsAdmin } from "../../../components/words-admin";
import { requireWordEditor } from "../../../lib/auth";
import { buildCategoryTree } from "../../../lib/game-state";
import { prisma } from "../../../lib/prisma";

export default async function WordsAdminPage() {
  const user = await requireWordEditor();
  const [categoryTree, words] = await Promise.all([
    buildCategoryTree(true),
    prisma.wordEntry.findMany({
      select: {
        id: true,
        wordCategoryId: true,
        textCn: true,
        textEnOrNote: true,
        enabled: true,
        sourceSheet: true,
        sourceRow: true,
        category: {
          select: {
            id: true,
            name: true,
            archive: { select: { id: true, name: true } }
          }
        }
      },
      orderBy: [{ category: { archive: { sortOrder: "asc" } } }, { category: { sortOrder: "asc" } }, { textCn: "asc" }]
    })
  ]);

  return (
    <div>
      <h1 className="text-3xl font-black md:text-4xl">题库后台</h1>
      <WordsAdmin
        initialArchives={categoryTree}
        initialWords={JSON.parse(JSON.stringify(words))}
        isTopAdmin={user.role === "ADMIN"}
      />
    </div>
  );
}
