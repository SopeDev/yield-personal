-- The setup wizard and its checklist. Accounts that already exist are set up, so they never see either.
ALTER TABLE "users" ADD COLUMN "onboarded_at" TIMESTAMPTZ(6),
ADD COLUMN "setup_dismissed_at" TIMESTAMPTZ(6);

UPDATE "users" SET "onboarded_at" = now(), "setup_dismissed_at" = now();
