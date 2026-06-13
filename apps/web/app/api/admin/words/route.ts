import { z } from "zod";
import { WORD_CATEGORIES } from "@cosmere/shared";
import type { Universe, WordCategory } from "@prisma/client";
import { requireAdmin } from "../../../../lib/auth";
import { handleApiError, ok } from "../../../../lib/api";
import { prisma } from "../../../../lib/prisma";

const categoryValues = WORD_CATEGORIES.map((category) => category.category) as [WordCategory, ...WordCategory[]];
const universeValues = ["cosmere", "cytonic", "qq"] as const;

const createSchema = z.object({
  universe: z.enum(universeValues),
  category: z.enum(categoryValues),
  textCn: z.string().min(1),
  textEnOrNote: z.string().min(1),
  enabled: z.boolean().default(true)
});

const patchSchema = createSchema.partial().extend({
  id: z.string().min(1)
});

export async function GET() {
  await requireAdmin();
  const words = await prisma.wordEntry.findMany({
    orderBy: [{ category: "asc" }, { textCn: "asc" }]
  });
  const duplicateKeys = new Set<string>();
  const seen = new Map<string, number>();
  for (const word of words) {
    const key = `${word.textCn}\u0000${word.textEnOrNote}`;
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    if (count > 1) duplicateKeys.add(key);
  }
  return ok({
    words: words.map((word) => ({
      ...word,
      duplicate: duplicateKeys.has(`${word.textCn}\u0000${word.textEnOrNote}`)
    }))
  });
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const input = createSchema.parse(await request.json());
    const word = await prisma.wordEntry.create({
      data: {
        ...input,
        universe: input.universe as Universe,
        category: input.category as WordCategory
      }
    });
    return ok(word, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const input = patchSchema.parse(await request.json());
    const { id, ...data } = input;
    const word = await prisma.wordEntry.update({
      where: { id },
      data: {
        ...data,
        universe: data.universe as Universe | undefined,
        category: data.category as WordCategory | undefined
      }
    });
    return ok(word);
  } catch (error) {
    return handleApiError(error);
  }
}
