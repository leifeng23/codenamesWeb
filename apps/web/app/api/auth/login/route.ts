import { z } from "zod";
import { createSession, verifyPassword } from "../../../../lib/auth";
import { fail, handleApiError, ok } from "../../../../lib/api";
import { prisma } from "../../../../lib/prisma";
import { clientIp, rateLimit } from "../../../../lib/rate-limit";

const schema = z.object({
  login: z.string().min(1),
  password: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const login = input.login.trim().toLowerCase();
    // 防暴力尝试：同一 IP + 账号 10 分钟内最多 10 次
    const limited = rateLimit(`login:${clientIp(request)}:${login}`, 10, 10 * 60 * 1000);
    if (!limited.ok) {
      return fail(`尝试次数过多，请约 ${Math.max(1, Math.ceil(limited.retryAfterSec / 60))} 分钟后再试`, 429);
    }
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
