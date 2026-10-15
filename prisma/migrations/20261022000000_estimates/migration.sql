-- Starting estimates from the setup wizard (encrypted), and the day a new account's records start.
ALTER TABLE "users" ADD COLUMN "tracking_from" DATE,
ADD COLUMN "income_estimate_enc" TEXT;

ALTER TABLE "categories" ADD COLUMN "monthly_estimate_enc" TEXT;
