-- CreateEnum
CREATE TYPE "savings_fund_kind" AS ENUM ('EMERGENCY', 'GOAL');

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "archived_at" TIMESTAMPTZ(6),
ADD COLUMN     "include_in_average" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "savings_funds" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "kind" "savings_fund_kind" NOT NULL,
    "name" TEXT,
    "target_cents" INTEGER,
    "cover_months" INTEGER NOT NULL DEFAULT 3,
    "archived_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "savings_funds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "savings_movements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "fund_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "savings_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "savings_funds_user_id_idx" ON "savings_funds"("user_id");

-- CreateIndex
CREATE INDEX "savings_movements_user_id_date_idx" ON "savings_movements"("user_id", "date");

-- CreateIndex
CREATE INDEX "savings_movements_fund_id_idx" ON "savings_movements"("fund_id");

-- AddForeignKey
ALTER TABLE "savings_funds" ADD CONSTRAINT "savings_funds_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "savings_movements" ADD CONSTRAINT "savings_movements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "savings_movements" ADD CONSTRAINT "savings_movements_fund_id_fkey" FOREIGN KEY ("fund_id") REFERENCES "savings_funds"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Extras are one-off purchases, so they are not part of average monthly spending.
UPDATE "categories" SET "include_in_average" = false WHERE "key" = 'extras';

-- Every existing user gets an emergency fund.
INSERT INTO "savings_funds" ("user_id", "kind") SELECT "id", 'EMERGENCY' FROM "users";
