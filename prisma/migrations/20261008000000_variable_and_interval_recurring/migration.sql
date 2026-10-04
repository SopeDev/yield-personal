-- AlterTable
ALTER TABLE "recurring_payments" ADD COLUMN     "interval_months" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "is_variable" BOOLEAN NOT NULL DEFAULT false;

