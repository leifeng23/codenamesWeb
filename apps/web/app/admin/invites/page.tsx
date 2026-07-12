import { InvitesAdmin } from "../../../components/invites-admin";
import { requireAdmin } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";

export default async function InvitesAdminPage() {
  await requireAdmin();
  const invites = await prisma.inviteCode.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { username: true } },
      usedBy: { select: { username: true } }
    }
  });

  return (
    <div>
      <h1 className="text-3xl font-black md:text-4xl">邀请码</h1>
      <InvitesAdmin initialInvites={JSON.parse(JSON.stringify(invites))} />
    </div>
  );
}
