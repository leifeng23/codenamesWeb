import Link from "next/link";
import { WordsAdmin } from "../../../components/words-admin";
import { Starfield } from "../../../components/starfield";
import { requireWordEditor } from "../../../lib/auth";
import { buildCategoryTree } from "../../../lib/game-state";
import { prisma } from "../../../lib/prisma";

export default async function WordsAdminPage() {
  const user = await requireWordEditor();
  const [categoryTree, words] = await Promise.all([
    buildCategoryTree(),
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
    <main className="min-h-screen px-4 py-8">
      <Starfield />
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/" className="text-storm hover:text-white">
            返回行动台
          </Link>
          {user.role === "ADMIN" ? (
            <Link href="/admin/users" className="text-white/55 hover:text-white">
              用户权限
            </Link>
          ) : null}
        </div>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-brass">Admin Console</p>
            <h1 className="mt-2 text-4xl font-black">题库后台</h1>
          </div>
          <div className="flex max-w-full gap-2 overflow-x-auto pb-1 text-xs lg:max-w-[58%]">
            {categoryTree.flatMap((archive) =>
              archive.categories.map((category) => (
                <div key={category.id} className="min-w-[120px] rounded-md border border-white/10 bg-white/[0.04] p-2">
                  <p className="truncate text-white/52">
                    {archive.name} {category.name}
                  </p>
                  <p className="text-lg font-black">{category.count}</p>
                </div>
              ))
            )}
          </div>
        </div>
        <WordsAdmin
          initialArchives={categoryTree}
          initialWords={JSON.parse(JSON.stringify(words))}
          isTopAdmin={user.role === "ADMIN"}
        />
      </div>
    </main>
  );
}
