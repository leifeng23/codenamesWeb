import { requireAdmin } from "../../../../lib/auth";
import { ok } from "../../../../lib/api";
import { prisma } from "../../../../lib/prisma";

export async function GET() {
  await requireAdmin();
  const users = await prisma.user.findMany({
    orderBy: [{ role: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      createdAt: true
    }
  });
  return ok({ users });
}
