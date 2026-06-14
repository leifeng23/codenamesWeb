import { z } from "zod";
import { requireAdmin } from "../../../../../../lib/auth";
import { fail, handleApiError, ok } from "../../../../../../lib/api";
import { prisma } from "../../../../../../lib/prisma";

const schema = z.object({
  role: z.enum(["USER", "WORD_EDITOR", "ADMIN"])
});

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    await requireAdmin();
    const { id } = await params;
    const input = schema.parse(await request.json());
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return fail("用户不存在", 404);
    if (target.role === "ADMIN" && input.role !== "ADMIN") {
      const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
      if (adminCount <= 1) return fail("至少需要保留一名顶级管理员", 400);
    }
    const user = await prisma.user.update({
      where: { id },
      data: { role: input.role },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        createdAt: true
      }
    });
    return ok(user);
  } catch (error) {
    return handleApiError(error);
  }
}
