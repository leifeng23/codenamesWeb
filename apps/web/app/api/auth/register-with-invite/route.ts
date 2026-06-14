import { z } from "zod";
import { createSession, hashPassword } from "../../../../lib/auth";
import { fail, handleApiError, ok } from "../../../../lib/api";
import { prisma } from "../../../../lib/prisma";

const schema = z.object({
  email: z.string().email(),
  username: z.string().min(2, "用户名至少 2 位").max(24, "用户名最多 24 位").regex(/^[\w\u4e00-\u9fa5-]+$/, "用户名只能包含中文、字母、数字、下划线或短横线"),
  password: z.string().min(8, "密码至少 8 位")
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const email = input.email.toLowerCase();
    const username = input.username.trim().toLowerCase();
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
      select: { email: true, username: true }
    });
    if (existing?.email === email) return fail("这个邮箱已经注册过了", 409);
    if (existing?.username === username) return fail("这个用户名已经被占用了", 409);

    const passwordHash = await hashPassword(input.password);
    const user = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash
      }
    });

    await createSession(user.id);
    return ok({ id: user.id, email: user.email, username: user.username, role: user.role }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
