-- Multi-currency: payment methods, incomes, and savings funds get a currency (existing ones take the user's main
-- currency), money on hand moves from the user to their cash wallet, and currency exchanges get their own table.
-- New columns come first, existing data is carried over, then the old columns are dropped.

-- AlterTable
ALTER TABLE "payment_methods" ADD COLUMN     "cash_count_cents" INTEGER,
ADD COLUMN     "cash_counted_at" TIMESTAMPTZ(6),
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'MXN';

-- AlterTable
ALTER TABLE "incomes" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'MXN';

-- AlterTable
ALTER TABLE "savings_funds" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'MXN';

-- CreateTable
CREATE TABLE "currency_exchanges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "from_currency" TEXT NOT NULL,
    "from_cents" INTEGER NOT NULL,
    "to_currency" TEXT NOT NULL,
    "to_cents" INTEGER NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "currency_exchanges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "currency_exchanges_user_id_date_idx" ON "currency_exchanges"("user_id", "date");

-- AddForeignKey
ALTER TABLE "currency_exchanges" ADD CONSTRAINT "currency_exchanges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: everything recorded so far was in the user's main currency.
UPDATE "payment_methods" AS p SET "currency" = u."currency" FROM "users" AS u WHERE u."id" = p."user_id";
UPDATE "incomes" AS i SET "currency" = u."currency" FROM "users" AS u WHERE u."id" = i."user_id";
UPDATE "savings_funds" AS f SET "currency" = u."currency" FROM "users" AS u WHERE u."id" = f."user_id";

-- Backfill: money on hand, as last counted, moves to the user's cash wallet (their first cash payment method).
UPDATE "payment_methods" AS p SET "cash_count_cents" = u."cash_on_hand_cents", "cash_counted_at" = u."cash_on_hand_set_at"
FROM "users" AS u
WHERE u."cash_on_hand_cents" IS NOT NULL AND u."cash_on_hand_set_at" IS NOT NULL
  AND p."id" = (SELECT c."id" FROM "payment_methods" AS c WHERE c."user_id" = u."id" AND c."kind" = 'CASH' ORDER BY c."created_at" LIMIT 1);

-- AlterTable
ALTER TABLE "users" DROP COLUMN "cash_on_hand_cents",
DROP COLUMN "cash_on_hand_set_at";
