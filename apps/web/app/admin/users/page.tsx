import Link from "next/link";
import { Starfield } from "../../../components/starfield";
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
    <main className="min-h-screen px-4 py-8">
      <Starfield />
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/" className="text-storm hover:text-white">
            返回行动台
          </Link>
          <Link href="/admin/words" className="text-white/55 hover:text-white">
            题库后台
          </Link>
        </div>
        <div className="mt-4">
          <p className="text-xs uppercase tracking-[0.3em] text-brass">Admin Console</p>
          <h1 className="mt-2 text-4xl font-black">用户权限</h1>
        </div>
        <UsersAdmin initialUsers={JSON.parse(JSON.stringify(users))} />
      </div>
    </main>
  );
}
