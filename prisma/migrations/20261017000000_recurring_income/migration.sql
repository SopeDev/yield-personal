-- Recurring income: income expected on a schedule (weekly, every two weeks, or days of the month). Income received
-- for one of its paydays links to it, so that payday stops counting as expected.

-- AlterTable
ALTER TABLE "incomes" ADD COLUMN     "expected_on" DATE,
ADD COLUMN     "recurring_income_id" UUID;

-- CreateTable
CREATE TABLE "recurring_incomes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "rhythm" "income_rhythm" NOT NULL,
    "anchor" DATE,
    "pay_days" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "starts_on" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "recurring_incomes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recurring_incomes_user_id_idx" ON "recurring_incomes"("user_id");

-- CreateIndex
CREATE INDEX "recurring_incomes_source_id_idx" ON "recurring_incomes"("source_id");

-- CreateIndex
CREATE UNIQUE INDEX "incomes_recurring_income_id_expected_on_key" ON "incomes"("recurring_income_id", "expected_on");

-- AddForeignKey
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_recurring_income_id_fkey" FOREIGN KEY ("recurring_income_id") REFERENCES "recurring_incomes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_incomes" ADD CONSTRAINT "recurring_incomes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_incomes" ADD CONSTRAINT "recurring_incomes_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "income_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

