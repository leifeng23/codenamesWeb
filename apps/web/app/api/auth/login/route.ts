import { z } from "zod";
import { createSession, verifyPassword } from "../../../../lib/auth";
import { fail, handleApiError, ok } from "../../../../lib/api";
import { prisma } from "../../../../lib/prisma";

const schema = z.object({
  login: z.string().min(1),
  password: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const login = input.login.trim().toLowerCase();
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: login }, { username: login }]
      }
    });
    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      return fail("邮箱/用户名或密码错误", 401);
    }
    await createSession(user.id);
    return ok({ id: user.id, email: user.email, username: user.username, role: user.role });
  } catch (error) {
    return handleApiError(error);
  }
}
