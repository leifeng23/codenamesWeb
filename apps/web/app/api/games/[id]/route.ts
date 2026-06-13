import { requireUser } from "../../../../lib/auth";
import { fail, handleApiError, ok } from "../../../../lib/api";
import { buildRoomSnapshot } from "../../../../lib/game-state";
import { prisma } from "../../../../lib/prisma";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const game = await prisma.game.findUnique({ where: { id }, include: { room: true } });
    if (!game) return fail("对局不存在", 404);
    const snapshot = await buildRoomSnapshot(game.room.code, user.id);
    return ok(snapshot);
  } catch (error) {
    return handleApiError(error);
  }
}
