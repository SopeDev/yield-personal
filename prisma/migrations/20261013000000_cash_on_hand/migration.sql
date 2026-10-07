-- AlterTable
ALTER TABLE "users" ADD COLUMN     "cash_on_hand_cents" INTEGER,
ADD COLUMN     "cash_on_hand_set_at" TIMESTAMPTZ(6);
