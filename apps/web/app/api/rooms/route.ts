import { z } from "zod";
import { requireUser } from "../../../lib/auth";
import { handleApiError, makeRoomCode, ok } from "../../../lib/api";
import { prisma } from "../../../lib/prisma";

const createSchema = z.object({
  team: z.enum(["red", "blue", "spectator"]).default("spectator"),
  categoryIds: z.array(z.string().min(1)).min(1)
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = createSchema.parse(await request.json().catch(() => ({})));
    const existingCount = await prisma.wordCategory.count({
      where: { id: { in: input.categoryIds } }
    });
    if (existingCount !== new Set(input.categoryIds).size) {
      return Response.json({ error: "题库分类不存在" }, { status: 400 });
    }
    const enabledCount = await prisma.wordEntry.count({
      where: { enabled: true, wordCategoryId: { in: input.categoryIds } }
    });
    if (enabledCount < 25) {
      return Response.json({ error: "选中的题库不足 25 条，无法创建房间" }, { status: 400 });
    }

    let code = makeRoomCode();
    for (let i = 0; i < 4; i++) {
      const existing = await prisma.room.findUnique({ where: { code } });
      if (!existing) break;
      code = makeRoomCode();
    }

    const room = await prisma.room.create({
      data: {
        code,
        ownerId: user.id,
        members: {
          create: {
            userId: user.id,
            team: input.team,
            canSpy: true
          }
        },
        wordCategories: {
          create: input.categoryIds.map((wordCategoryId) => ({ wordCategoryId }))
        }
      }
    });

    return ok(room, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
