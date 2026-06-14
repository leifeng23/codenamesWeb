import { z } from "zod";
import { requireWordEditor } from "../../../../lib/auth";
import { handleApiError, ok } from "../../../../lib/api";
import { prisma } from "../../../../lib/prisma";

const createSchema = z.object({
  wordCategoryId: z.string().min(1),
  textCn: z.string().trim().min(1),
  textEnOrNote: z.string().trim().min(1),
  enabled: z.boolean().default(true)
});

const patchSchema = createSchema.partial().extend({
  id: z.string().min(1)
});

const wordSelect = {
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
} as const;

export async function GET() {
  await requireWordEditor();
  const words = await prisma.wordEntry.findMany({
    select: wordSelect,
    orderBy: [{ category: { archive: { sortOrder: "asc" } } }, { category: { sortOrder: "asc" } }, { textCn: "asc" }]
  });
  return ok({ words });
}

export async function POST(request: Request) {
  try {
    await requireWordEditor();
    const input = createSchema.parse(await request.json());
    const word = await prisma.wordEntry.create({
      data: input,
      select: wordSelect
    });
    return ok(word, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireWordEditor();
    const input = patchSchema.parse(await request.json());
    const { id, ...data } = input;
    const word = await prisma.wordEntry.update({
      where: { id },
      data,
      select: wordSelect
    });
    return ok(word);
  } catch (error) {
    return handleApiError(error);
  }
}
