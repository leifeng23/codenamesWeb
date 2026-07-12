import { UsersAdmin } from "../../../components/users-admin";
import { requireAdmin } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";

export default async function UsersAdminPage() {
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

  return (
    <div>
      <h1 className="text-3xl font-black md:text-4xl">用户权限</h1>
      <UsersAdmin initialUsers={JSON.parse(JSON.stringify(users))} />
    </div>
  );
}
