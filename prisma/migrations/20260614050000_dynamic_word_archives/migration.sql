ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'WORD_EDITOR';

CREATE TABLE "word_archives" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "word_archives_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "word_categories" (
  "id" TEXT NOT NULL,
  "archiveId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "word_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "word_archives_name_key" ON "word_archives"("name");
CREATE UNIQUE INDEX "word_categories_archiveId_name_key" ON "word_categories"("archiveId", "name");
CREATE INDEX "word_categories_archiveId_sortOrder_idx" ON "word_categories"("archiveId", "sortOrder");

ALTER TABLE "word_categories"
  ADD CONSTRAINT "word_categories_archiveId_fkey"
  FOREIGN KEY ("archiveId") REFERENCES "word_archives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "word_archives" ("id", "name", "sortOrder") VALUES
  ('archive_cosmere', '三界宙', 10),
  ('archive_cytonic', '赛托宙', 20),
  ('archive_qq', '三界宙旅者群友', 30)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "word_categories" ("id", "archiveId", "name", "sortOrder") VALUES
  ('cat_cosmere_characters', 'archive_cosmere', '人物', 10),
  ('cat_cosmere_culture', 'archive_cosmere', '文化', 20),
  ('cat_cosmere_lifeforms', 'archive_cosmere', '生命形式', 30),
  ('cat_cosmere_locations', 'archive_cosmere', '地点', 40),
  ('cat_cosmere_magic', 'archive_cosmere', '魔法', 50),
  ('cat_cosmere_object_material', 'archive_cosmere', '物品与材料', 60),
  ('cat_cytonic_characters', 'archive_cytonic', '人物', 10),
  ('cat_cytonic_spots', 'archive_cytonic', '地点', 20),
  ('cat_cytonic_concepts', 'archive_cytonic', '概念', 30),
  ('cat_qq_friends', 'archive_qq', '群友', 10)
ON CONFLICT ("archiveId", "name") DO NOTHING;

ALTER TABLE "WordEntry" ADD COLUMN "wordCategoryId" TEXT;

UPDATE "WordEntry"
SET "wordCategoryId" = CASE "category"::TEXT
  WHEN 'cosmere_characters' THEN 'cat_cosmere_characters'
  WHEN 'cosmere_culture' THEN 'cat_cosmere_culture'
  WHEN 'cosmere_lifeforms' THEN 'cat_cosmere_lifeforms'
  WHEN 'cosmere_locations' THEN 'cat_cosmere_locations'
  WHEN 'cosmere_magic' THEN 'cat_cosmere_magic'
  WHEN 'cosmere_object_material' THEN 'cat_cosmere_object_material'
  WHEN 'cytonic_characters' THEN 'cat_cytonic_characters'
  WHEN 'cytonic_spots' THEN 'cat_cytonic_spots'
  WHEN 'cytonic_concepts' THEN 'cat_cytonic_concepts'
  WHEN 'qq_friends' THEN 'cat_qq_friends'
END;

ALTER TABLE "WordEntry" ALTER COLUMN "wordCategoryId" SET NOT NULL;

ALTER TABLE "RoomWordCategory" ADD COLUMN "wordCategoryId" TEXT;

UPDATE "RoomWordCategory"
SET "wordCategoryId" = CASE "category"::TEXT
  WHEN 'cosmere_characters' THEN 'cat_cosmere_characters'
  WHEN 'cosmere_culture' THEN 'cat_cosmere_culture'
  WHEN 'cosmere_lifeforms' THEN 'cat_cosmere_lifeforms'
  WHEN 'cosmere_locations' THEN 'cat_cosmere_locations'
  WHEN 'cosmere_magic' THEN 'cat_cosmere_magic'
  WHEN 'cosmere_object_material' THEN 'cat_cosmere_object_material'
  WHEN 'cytonic_characters' THEN 'cat_cytonic_characters'
  WHEN 'cytonic_spots' THEN 'cat_cytonic_spots'
  WHEN 'cytonic_concepts' THEN 'cat_cytonic_concepts'
  WHEN 'qq_friends' THEN 'cat_qq_friends'
END;

ALTER TABLE "RoomWordCategory" ALTER COLUMN "wordCategoryId" SET NOT NULL;

DROP INDEX IF EXISTS "WordEntry_category_enabled_idx";
DROP INDEX IF EXISTS "RoomWordCategory_category_idx";
DROP INDEX IF EXISTS "RoomWordCategory_roomId_category_key";

CREATE INDEX "WordEntry_wordCategoryId_enabled_idx" ON "WordEntry"("wordCategoryId", "enabled");
CREATE INDEX "RoomWordCategory_wordCategoryId_idx" ON "RoomWordCategory"("wordCategoryId");
CREATE UNIQUE INDEX "RoomWordCategory_roomId_wordCategoryId_key" ON "RoomWordCategory"("roomId", "wordCategoryId");

ALTER TABLE "WordEntry"
  ADD CONSTRAINT "WordEntry_wordCategoryId_fkey"
  FOREIGN KEY ("wordCategoryId") REFERENCES "word_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RoomWordCategory"
  ADD CONSTRAINT "RoomWordCategory_wordCategoryId_fkey"
  FOREIGN KEY ("wordCategoryId") REFERENCES "word_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WordEntry" DROP COLUMN "universe";
ALTER TABLE "WordEntry" DROP COLUMN "category";
ALTER TABLE "RoomWordCategory" DROP COLUMN "category";
