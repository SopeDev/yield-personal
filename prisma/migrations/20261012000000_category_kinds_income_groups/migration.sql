-- Category types replace "include in average"; income groups replace the rideshare flag and the built-in Car
-- deduction. New structures are added first, existing data is carried over, then the old columns are dropped.

-- CreateEnum
CREATE TYPE "category_kind" AS ENUM ('EVERYDAY', 'BILLS', 'OCCASIONAL');

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "kind" "category_kind" NOT NULL DEFAULT 'EVERYDAY';

-- AlterTable
ALTER TABLE "income_sources" ADD COLUMN     "group_id" UUID;

-- CreateTable
CREATE TABLE "income_groups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "archived_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "income_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "income_group_deductions" (
    "group_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,

    CONSTRAINT "income_group_deductions_pkey" PRIMARY KEY ("group_id","category_id")
);

-- CreateIndex
CREATE INDEX "income_groups_user_id_idx" ON "income_groups"("user_id");

-- CreateIndex
CREATE INDEX "income_group_deductions_category_id_idx" ON "income_group_deductions"("category_id");

-- CreateIndex
CREATE INDEX "income_sources_group_id_idx" ON "income_sources"("group_id");

-- AddForeignKey
ALTER TABLE "income_sources" ADD CONSTRAINT "income_sources_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "income_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income_groups" ADD CONSTRAINT "income_groups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income_group_deductions" ADD CONSTRAINT "income_group_deductions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "income_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income_group_deductions" ADD CONSTRAINT "income_group_deductions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill category types: excluded from the average → occasional; the built-in Fixed category → bills.
UPDATE "categories" SET "kind" = CASE
  WHEN NOT "include_in_average" THEN 'OCCASIONAL'::"category_kind"
  WHEN "key" = 'fixed' THEN 'BILLS'::"category_kind"
  ELSE 'EVERYDAY'::"category_kind"
END;

-- Backfill income groups: each user with rideshare sources gets a "Rideshare" group holding them that deducts
-- their Car category, as net rideshare income did before.
INSERT INTO "income_groups" ("user_id", "name")
SELECT DISTINCT "user_id", 'Rideshare' FROM "income_sources" WHERE "is_rideshare";

UPDATE "income_sources" AS s SET "group_id" = g."id"
FROM "income_groups" AS g
WHERE g."user_id" = s."user_id" AND s."is_rideshare";

INSERT INTO "income_group_deductions" ("group_id", "category_id")
SELECT g."id", c."id" FROM "income_groups" AS g
JOIN "categories" AS c ON c."user_id" = g."user_id" AND c."key" = 'car';

-- AlterTable
ALTER TABLE "categories" DROP COLUMN "include_in_average";

-- AlterTable
ALTER TABLE "income_sources" DROP COLUMN "is_rideshare";
