-- CreateEnum
CREATE TYPE "income_rhythm" AS ENUM ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTH_DAYS');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "income_pay_days" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "income_rhythm" "income_rhythm" NOT NULL DEFAULT 'DAILY',
ADD COLUMN     "income_rhythm_anchor" DATE,
ADD COLUMN     "summary_cards" JSONB;

