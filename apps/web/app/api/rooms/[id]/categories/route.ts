import { ALL_WORD_CATEGORIES } from "@cosmere/shared";
import type { WordCategory } from "@prisma/client";
import { z } from "zod";
import { requireUser } from "../../../../../lib/auth";
import { fail, handleApiError, ok } from "../../../../../lib/api";
import { prisma } from "../../../../../lib/prisma";

const schema = z.object({
  categories: z.array(z.enum(ALL_WORD_CATEGORIES as [WordCategory, ...WordCategory[]])).min(1)
});

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const input = schema.parse(await request.json());
    const room = await prisma.room.findUnique({ where: { id } });
    if (!room) return fail("房间不存在", 404);
    if (room.ownerId !== user.id) return fail("只有房主可以修改题库", 403);
    const enabledCount = await prisma.wordEntry.count({
      where: { enabled: true, category: { in: input.categories } }
    });
    if (enabledCount < 25) return fail("选中的题库不足 25 条，无法开局", 400);

    await prisma.$transaction(async (tx) => {
      await tx.roomWordCategory.deleteMany({ where: { roomId: id } });
      await tx.roomWordCategory.createMany({
        data: input.categories.map((category) => ({ roomId: id, category }))
      });
      await tx.gameEvent.create({
        data: {
          roomId: id,
          userId: user.id,
          type: "room.categories_updated",
          payload: { categories: input.categories }
        }
      });
    });
    return ok({ categories: input.categories });
  } catch (error) {
    return handleApiError(error);
  }
}
