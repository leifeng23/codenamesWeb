ALTER TABLE "User" ADD COLUMN "username" TEXT;

UPDATE "User"
SET "username" = regexp_replace(split_part("email", '@', 1), '[^A-Za-z0-9_]', '_', 'g')
WHERE "username" IS NULL;

UPDATE "User"
SET "username" = "username" || '_' || substr("id", 1, 6)
WHERE "username" IN (
  SELECT "username"
  FROM "User"
  GROUP BY "username"
  HAVING COUNT(*) > 1
);

ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
