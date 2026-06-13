import { ALL_WORD_CATEGORIES } from "@cosmere/shared";
import type { WordCategory } from "@prisma/client";
import { z } from "zod";
import { requireUser } from "../../../lib/auth";
import { handleApiError, makeRoomCode, ok } from "../../../lib/api";
import { prisma } from "../../../lib/prisma";

const createSchema = z.object({
  team: z.enum(["red", "blue", "spectator"]).default("spectator"),
  categories: z.array(z.enum(ALL_WORD_CATEGORIES as [WordCategory, ...WordCategory[]])).default(ALL_WORD_CATEGORIES)
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = createSchema.parse(await request.json().catch(() => ({})));
    const enabledCount = await prisma.wordEntry.count({
      where: { enabled: true, category: { in: input.categories } }
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
          create: input.categories.map((category) => ({ category }))
        }
      }
    });

    return ok(room, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
