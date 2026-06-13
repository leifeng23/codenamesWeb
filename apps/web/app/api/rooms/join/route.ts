import { z } from "zod";
import { requireUser } from "../../../../lib/auth";
import { fail, handleApiError, ok } from "../../../../lib/api";
import { prisma } from "../../../../lib/prisma";

const schema = z.object({
  code: z.string().min(4),
  team: z.enum(["red", "blue", "spectator"]).default("spectator")
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = schema.parse(await request.json());
    const code = input.code.trim().toUpperCase();
    const room = await prisma.room.findUnique({ where: { code } });
    if (!room) return fail("房间不存在", 404);

    await prisma.roomMember.upsert({
      where: { roomId_userId: { roomId: room.id, userId: user.id } },
      create: {
        roomId: room.id,
        userId: user.id,
        team: input.team,
        canSpy: false
      },
      update: {
        team: input.team
      }
    });

    return ok({ code });
  } catch (error) {
    return handleApiError(error);
  }
}
