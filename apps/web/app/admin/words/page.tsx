import Link from "next/link";
import { WORD_CATEGORY_LABELS } from "@cosmere/shared";
import { WordsAdmin } from "../../../components/words-admin";
import { Starfield } from "../../../components/starfield";
import { requireAdmin } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";

export default async function WordsAdminPage() {
  await requireAdmin();
  const words = await prisma.wordEntry.findMany({
    orderBy: [{ category: "asc" }, { textCn: "asc" }]
  });
  const counts = words.reduce<Record<string, number>>((acc, word) => {
    acc[word.category] = (acc[word.category] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <main className="min-h-screen px-4 py-8">
      <Starfield />
      <div className="mx-auto max-w-7xl">
        <Link href="/" className="text-sm text-storm hover:text-white">
          返回行动台
        </Link>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-brass">Admin Console</p>
            <h1 className="mt-2 text-4xl font-black">题库后台</h1>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-5">
            {Object.entries(counts).map(([category, count]) => (
              <div key={category} className="rounded-md border border-white/10 bg-white/[0.04] p-2">
                <p className="truncate text-white/52">{WORD_CATEGORY_LABELS[category as keyof typeof WORD_CATEGORY_LABELS]}</p>
                <p className="text-lg font-black">{count}</p>
              </div>
            ))}
          </div>
        </div>
        <WordsAdmin initialWords={JSON.parse(JSON.stringify(words))} />
      </div>
    </main>
  );
}
