-- Savings funds earn interest (with an optional promotional rate and what follows it) and can have a planned deposit.
ALTER TABLE "savings_funds" ADD COLUMN "interest_rate_bps" INTEGER,
ADD COLUMN "interest_until" DATE,
ADD COLUMN "interest_after_bps" INTEGER,
ADD COLUMN "deposit_enc" TEXT,
ADD COLUMN "deposit_rhythm" "income_rhythm",
ADD COLUMN "deposit_anchor" DATE,
ADD COLUMN "deposit_days" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
