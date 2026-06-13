import { z } from "zod";
import { createSession, verifyPassword } from "../../../../lib/auth";
import { fail, handleApiError, ok } from "../../../../lib/api";
import { prisma } from "../../../../lib/prisma";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      return fail("邮箱或密码错误", 401);
    }
    await createSession(user.id);
    return ok({ id: user.id, email: user.email, role: user.role });
  } catch (error) {
    return handleApiError(error);
  }
}
