import { z } from "zod";
import { requireUser } from "../../../../../../lib/auth";
import { fail, handleApiError, ok } from "../../../../../../lib/api";
import { prisma } from "../../../../../../lib/prisma";

const schema = z.object({
  team: z.enum(["red", "blue", "spectator"]),
  canSpy: z.boolean()
});

interface Params {
  params: Promise<{ id: string; userId: string }>;
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id, userId } = await params;
    const input = schema.parse(await request.json());
    const room = await prisma.room.findUnique({ where: { id } });
    if (!room) return fail("房间不存在", 404);
    if (room.ownerId !== user.id) return fail("只有房主可以分配身份", 403);
    const canSpy = input.team === "spectator" ? false : input.canSpy;
    const member = await prisma.roomMember.update({
      where: { roomId_userId: { roomId: id, userId } },
      data: { team: input.team, canSpy }
    });
    await prisma.gameEvent.create({
      data: {
        roomId: id,
        userId: user.id,
        type: "member.role_assigned",
        payload: { targetUserId: userId, team: input.team, canSpy }
      }
    });
    return ok(member);
  } catch (error) {
    return handleApiError(error);
  }
}
