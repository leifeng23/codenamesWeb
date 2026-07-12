import { requireAdmin } from "../../../../lib/auth";
import { fail, handleApiError, ok } from "../../../../lib/api";
import { prisma } from "../../../../lib/prisma";

interface Params {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    await requireAdmin();
    const { id } = await params;
    const invite = await prisma.inviteCode.findUnique({ where: { id } });
    if (!invite) return fail("邀请码不存在", 404);
    // 已使用的邀请码保留作注册凭证记录，不允许删除
    if (invite.usedById) return fail("邀请码已被使用，无法删除", 400);
    await prisma.inviteCode.delete({ where: { id } });
    return ok({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
