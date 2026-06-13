import { requireUser } from "../../../../../lib/auth";
import { fail, handleApiError, ok } from "../../../../../lib/api";
import { createGameForRoom } from "../../../../../lib/game-state";
import { prisma } from "../../../../../lib/prisma";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const room = await prisma.room.findUnique({
      where: { id },
      include: { members: true }
    });
    if (!room) return fail("房间不存在", 404);
    const member = room.members.find((item) => item.userId === user.id);
    if (!member) return fail("你不在该房间中", 403);
    if (room.ownerId !== user.id && !member.canSpy) return fail("没有开局权限", 403);

    const game = await createGameForRoom(room.id, user.id);
    return ok(game, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
