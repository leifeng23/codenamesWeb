import { z } from "zod";
import { createSession, hashPassword } from "../../../../lib/auth";
import { fail, handleApiError, ok } from "../../../../lib/api";
import { prisma } from "../../../../lib/prisma";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "密码至少 8 位"),
  inviteCode: z.string().min(4)
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const code = input.inviteCode.trim().toUpperCase();
    const invite = await prisma.inviteCode.findUnique({ where: { code } });
    if (!invite || invite.usedAt || (invite.expiresAt && invite.expiresAt < new Date())) {
      return fail("邀请码无效或已使用", 403);
    }

    const passwordHash = await hashPassword(input.password);
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: input.email.toLowerCase(),
          passwordHash
        }
      });
      await tx.inviteCode.update({
        where: { id: invite.id },
        data: {
          usedById: created.id,
          usedAt: new Date()
        }
      });
      return created;
    });

    await createSession(user.id);
    return ok({ id: user.id, email: user.email, role: user.role }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
