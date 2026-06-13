import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { defaultUnityExcelPath, loadWordEntriesFromExcel } from "./word-importer";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@example.com";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "change-me-now";
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      passwordHash,
      role: "ADMIN"
    },
    update: {
      role: "ADMIN"
    }
  });

  const entries = loadWordEntriesFromExcel(defaultUnityExcelPath());
  await prisma.wordEntry.deleteMany();
  await prisma.wordEntry.createMany({ data: entries });

  const invite = await prisma.inviteCode.create({
    data: {
      code: randomBytes(5).toString("hex").toUpperCase(),
      createdById: admin.id
    }
  });

  console.log(`Seeded admin: ${admin.email}`);
  console.log(`Seeded word entries: ${entries.length}`);
  console.log(`Initial invite code: ${invite.code}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
