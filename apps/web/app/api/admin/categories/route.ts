import { z } from "zod";
import { requireWordEditor } from "../../../../lib/auth";
import { handleApiError, ok } from "../../../../lib/api";
import { buildCategoryTree } from "../../../../lib/game-state";
import { prisma } from "../../../../lib/prisma";

const createSchema = z.object({
  archiveId: z.string().min(1),
  name: z.string().trim().min(1).max(60)
});

const patchSchema = z.object({
  id: z.string().min(1),
  archiveId: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(60).optional()
});

export async function GET() {
  await requireWordEditor();
  return ok({ archives: await buildCategoryTree() });
}

export async function POST(request: Request) {
  try {
    await requireWordEditor();
    const input = createSchema.parse(await request.json());
    const count = await prisma.wordCategory.count({ where: { archiveId: input.archiveId } });
    await prisma.wordCategory.create({
      data: {
        archiveId: input.archiveId,
        name: input.name,
        sortOrder: (count + 1) * 10
      }
    });
    return ok({ archives: await buildCategoryTree() }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireWordEditor();
    const input = patchSchema.parse(await request.json());
    const { id, ...data } = input;
    await prisma.wordCategory.update({ where: { id }, data });
    return ok({ archives: await buildCategoryTree() });
  } catch (error) {
    return handleApiError(error);
  }
}
