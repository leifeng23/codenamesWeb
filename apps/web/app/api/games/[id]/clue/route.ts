import { z } from "zod";
import { requireUser } from "../../../../../lib/auth";
import { fail, handleApiError, ok } from "../../../../../lib/api";
import { submitClue } from "../../../../../lib/game-state";
import { prisma } from "../../../../../lib/prisma";

const schema = z.object({
  clueWord: z.string().trim().min(1).max(40),
  clueCount: z.coerce.number().int().min(1).max(9)
});

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const game = await prisma.game.findUnique({
      where: { id },
      include: { room: { include: { members: true } } }
    });
    if (!game) return fail("对局不存在", 404);
    if (!game.room.members.some((member) => member.userId === user.id)) return fail("你不在该房间中", 403);
    const input = schema.parse(await request.json());
    const updated = await submitClue(id, user.id, input.clueWord, input.clueCount);
    return ok(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
