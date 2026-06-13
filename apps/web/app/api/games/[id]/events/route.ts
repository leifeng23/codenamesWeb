import { requireUser } from "../../../../../lib/auth";
import { fail, handleApiError, ok } from "../../../../../lib/api";
import { prisma } from "../../../../../lib/prisma";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const game = await prisma.game.findUnique({
      where: { id },
      include: { room: { include: { members: true } } }
    });
    if (!game) return fail("对局不存在", 404);
    if (!game.room.members.some((member) => member.userId === user.id)) {
      return fail("你不在该房间中", 403);
    }
    const events = await prisma.gameEvent.findMany({
      where: { gameId: id },
      orderBy: { createdAt: "asc" }
    });
    return ok({ events });
  } catch (error) {
    return handleApiError(error);
  }
}
