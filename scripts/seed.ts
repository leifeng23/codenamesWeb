import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
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
      username: "admin",
      passwordHash,
      role: "ADMIN"
    },
    update: {
      role: "ADMIN"
    }
  });

  const entries = loadWordEntriesFromExcel(defaultUnityExcelPath());
  await prisma.wordEntry.deleteMany();
  const categoryCache = new Map<string, string>();
  for (const entry of entries) {
    const archive = await prisma.wordArchive.upsert({
      where: { name: entry.archiveName },
      update: {},
      create: { name: entry.archiveName, sortOrder: categoryCache.size * 10 }
    });
    const cacheKey = `${archive.id}\u0000${entry.categoryName}`;
    let categoryId = categoryCache.get(cacheKey);
    if (!categoryId) {
      const category = await prisma.wordCategory.upsert({
        where: { archiveId_name: { archiveId: archive.id, name: entry.categoryName } },
        update: {},
        create: { archiveId: archive.id, name: entry.categoryName, sortOrder: categoryCache.size * 10 }
      });
      categoryId = category.id;
      categoryCache.set(cacheKey, categoryId);
    }
    await prisma.wordEntry.create({
      data: {
        wordCategoryId: categoryId,
        textCn: entry.textCn,
        textEnOrNote: entry.textEnOrNote,
        sourceSheet: entry.sourceSheet,
        sourceRow: entry.sourceRow,
        enabled: entry.enabled
      }
    });
  }

  console.log(`Seeded admin: ${admin.email}`);
  console.log(`Seeded word entries: ${entries.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
