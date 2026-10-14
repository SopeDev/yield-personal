-- Encrypted copies of amounts, names and notes, filled on write and by scripts/encrypt-existing.ts; reads prefer them.
-- Purely additive: the plaintext columns stay until every row is encrypted, then a later migration drops them.
-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "name_enc" TEXT;

-- AlterTable
ALTER TABLE "currency_exchanges" ADD COLUMN     "from_enc" TEXT,
ADD COLUMN     "note_enc" TEXT,
ADD COLUMN     "to_enc" TEXT;

-- AlterTable
ALTER TABLE "expense_items" ADD COLUMN     "name_enc" TEXT,
ADD COLUMN     "name_index" TEXT;

-- AlterTable
ALTER TABLE "income_groups" ADD COLUMN     "name_enc" TEXT;

-- AlterTable
ALTER TABLE "income_sources" ADD COLUMN     "name_enc" TEXT;

-- AlterTable
ALTER TABLE "incomes" ADD COLUMN     "amount_enc" TEXT,
ADD COLUMN     "note_enc" TEXT;

-- AlterTable
ALTER TABLE "payment_methods" ADD COLUMN     "cash_count_enc" TEXT,
ADD COLUMN     "name_enc" TEXT;

-- AlterTable
ALTER TABLE "purchases" ADD COLUMN     "amount_enc" TEXT,
ADD COLUMN     "note_enc" TEXT;

-- AlterTable
ALTER TABLE "recurring_incomes" ADD COLUMN     "amount_enc" TEXT;

-- AlterTable
ALTER TABLE "recurring_occurrences" ADD COLUMN     "amount_enc" TEXT;

-- AlterTable
ALTER TABLE "recurring_payments" ADD COLUMN     "amount_enc" TEXT;

-- AlterTable
ALTER TABLE "savings_funds" ADD COLUMN     "name_enc" TEXT,
ADD COLUMN     "target_enc" TEXT;

-- AlterTable
ALTER TABLE "savings_movements" ADD COLUMN     "amount_enc" TEXT,
ADD COLUMN     "note_enc" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "balance_goal_enc" TEXT;

-- CreateTable
CREATE TABLE "encryption_key_checks" (
    "id" TEXT NOT NULL,
    "check" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "encryption_key_checks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "expense_items_user_id_name_index_key" ON "expense_items"("user_id", "name_index");


-- A plaintext value changed without its encrypted copy (an older deployment still serving while this one builds)
-- leaves that copy stale, so it is cleared: reads fall back to the plaintext until the copy is written again.
-- Dropped with the plaintext columns.
CREATE FUNCTION "users_clear_stale_copies"() RETURNS trigger AS $$
BEGIN
  IF NEW."balance_goal_cents" IS DISTINCT FROM OLD."balance_goal_cents" AND NEW."balance_goal_enc" IS NOT DISTINCT FROM OLD."balance_goal_enc" THEN NEW."balance_goal_enc" := NULL; END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
CREATE TRIGGER "users_clear_stale_copies" BEFORE UPDATE ON "users" FOR EACH ROW EXECUTE FUNCTION "users_clear_stale_copies"();

CREATE FUNCTION "payment_methods_clear_stale_copies"() RETURNS trigger AS $$
BEGIN
  IF NEW."name" IS DISTINCT FROM OLD."name" AND NEW."name_enc" IS NOT DISTINCT FROM OLD."name_enc" THEN NEW."name_enc" := NULL; END IF;
  IF NEW."cash_count_cents" IS DISTINCT FROM OLD."cash_count_cents" AND NEW."cash_count_enc" IS NOT DISTINCT FROM OLD."cash_count_enc" THEN NEW."cash_count_enc" := NULL; END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
CREATE TRIGGER "payment_methods_clear_stale_copies" BEFORE UPDATE ON "payment_methods" FOR EACH ROW EXECUTE FUNCTION "payment_methods_clear_stale_copies"();

CREATE FUNCTION "categories_clear_stale_copies"() RETURNS trigger AS $$
BEGIN
  IF NEW."name" IS DISTINCT FROM OLD."name" AND NEW."name_enc" IS NOT DISTINCT FROM OLD."name_enc" THEN NEW."name_enc" := NULL; END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
CREATE TRIGGER "categories_clear_stale_copies" BEFORE UPDATE ON "categories" FOR EACH ROW EXECUTE FUNCTION "categories_clear_stale_copies"();

CREATE FUNCTION "purchases_clear_stale_copies"() RETURNS trigger AS $$
BEGIN
  IF NEW."amount_cents" IS DISTINCT FROM OLD."amount_cents" AND NEW."amount_enc" IS NOT DISTINCT FROM OLD."amount_enc" THEN NEW."amount_enc" := NULL; END IF;
  IF NEW."note" IS DISTINCT FROM OLD."note" AND NEW."note_enc" IS NOT DISTINCT FROM OLD."note_enc" THEN NEW."note_enc" := NULL; END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
CREATE TRIGGER "purchases_clear_stale_copies" BEFORE UPDATE ON "purchases" FOR EACH ROW EXECUTE FUNCTION "purchases_clear_stale_copies"();

CREATE FUNCTION "expense_items_clear_stale_copies"() RETURNS trigger AS $$
BEGIN
  IF NEW."name" IS DISTINCT FROM OLD."name" AND NEW."name_enc" IS NOT DISTINCT FROM OLD."name_enc" THEN NEW."name_enc" := NULL; END IF;
  IF NEW."normalized_name" IS DISTINCT FROM OLD."normalized_name" AND NEW."name_index" IS NOT DISTINCT FROM OLD."name_index" THEN NEW."name_index" := NULL; END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
CREATE TRIGGER "expense_items_clear_stale_copies" BEFORE UPDATE ON "expense_items" FOR EACH ROW EXECUTE FUNCTION "expense_items_clear_stale_copies"();

CREATE FUNCTION "income_sources_clear_stale_copies"() RETURNS trigger AS $$
BEGIN
  IF NEW."name" IS DISTINCT FROM OLD."name" AND NEW."name_enc" IS NOT DISTINCT FROM OLD."name_enc" THEN NEW."name_enc" := NULL; END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
CREATE TRIGGER "income_sources_clear_stale_copies" BEFORE UPDATE ON "income_sources" FOR EACH ROW EXECUTE FUNCTION "income_sources_clear_stale_copies"();

CREATE FUNCTION "income_groups_clear_stale_copies"() RETURNS trigger AS $$
BEGIN
  IF NEW."name" IS DISTINCT FROM OLD."name" AND NEW."name_enc" IS NOT DISTINCT FROM OLD."name_enc" THEN NEW."name_enc" := NULL; END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
CREATE TRIGGER "income_groups_clear_stale_copies" BEFORE UPDATE ON "income_groups" FOR EACH ROW EXECUTE FUNCTION "income_groups_clear_stale_copies"();

CREATE FUNCTION "incomes_clear_stale_copies"() RETURNS trigger AS $$
BEGIN
  IF NEW."amount_cents" IS DISTINCT FROM OLD."amount_cents" AND NEW."amount_enc" IS NOT DISTINCT FROM OLD."amount_enc" THEN NEW."amount_enc" := NULL; END IF;
  IF NEW."note" IS DISTINCT FROM OLD."note" AND NEW."note_enc" IS NOT DISTINCT FROM OLD."note_enc" THEN NEW."note_enc" := NULL; END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
CREATE TRIGGER "incomes_clear_stale_copies" BEFORE UPDATE ON "incomes" FOR EACH ROW EXECUTE FUNCTION "incomes_clear_stale_copies"();

CREATE FUNCTION "recurring_incomes_clear_stale_copies"() RETURNS trigger AS $$
BEGIN
  IF NEW."amount_cents" IS DISTINCT FROM OLD."amount_cents" AND NEW."amount_enc" IS NOT DISTINCT FROM OLD."amount_enc" THEN NEW."amount_enc" := NULL; END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
CREATE TRIGGER "recurring_incomes_clear_stale_copies" BEFORE UPDATE ON "recurring_incomes" FOR EACH ROW EXECUTE FUNCTION "recurring_incomes_clear_stale_copies"();

CREATE FUNCTION "recurring_payments_clear_stale_copies"() RETURNS trigger AS $$
BEGIN
  IF NEW."amount_cents" IS DISTINCT FROM OLD."amount_cents" AND NEW."amount_enc" IS NOT DISTINCT FROM OLD."amount_enc" THEN NEW."amount_enc" := NULL; END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
CREATE TRIGGER "recurring_payments_clear_stale_copies" BEFORE UPDATE ON "recurring_payments" FOR EACH ROW EXECUTE FUNCTION "recurring_payments_clear_stale_copies"();

CREATE FUNCTION "recurring_occurrences_clear_stale_copies"() RETURNS trigger AS $$
BEGIN
  IF NEW."amount_cents" IS DISTINCT FROM OLD."amount_cents" AND NEW."amount_enc" IS NOT DISTINCT FROM OLD."amount_enc" THEN NEW."amount_enc" := NULL; END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
CREATE TRIGGER "recurring_occurrences_clear_stale_copies" BEFORE UPDATE ON "recurring_occurrences" FOR EACH ROW EXECUTE FUNCTION "recurring_occurrences_clear_stale_copies"();

CREATE FUNCTION "savings_funds_clear_stale_copies"() RETURNS trigger AS $$
BEGIN
  IF NEW."name" IS DISTINCT FROM OLD."name" AND NEW."name_enc" IS NOT DISTINCT FROM OLD."name_enc" THEN NEW."name_enc" := NULL; END IF;
  IF NEW."target_cents" IS DISTINCT FROM OLD."target_cents" AND NEW."target_enc" IS NOT DISTINCT FROM OLD."target_enc" THEN NEW."target_enc" := NULL; END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
CREATE TRIGGER "savings_funds_clear_stale_copies" BEFORE UPDATE ON "savings_funds" FOR EACH ROW EXECUTE FUNCTION "savings_funds_clear_stale_copies"();

CREATE FUNCTION "savings_movements_clear_stale_copies"() RETURNS trigger AS $$
BEGIN
  IF NEW."amount_cents" IS DISTINCT FROM OLD."amount_cents" AND NEW."amount_enc" IS NOT DISTINCT FROM OLD."amount_enc" THEN NEW."amount_enc" := NULL; END IF;
  IF NEW."note" IS DISTINCT FROM OLD."note" AND NEW."note_enc" IS NOT DISTINCT FROM OLD."note_enc" THEN NEW."note_enc" := NULL; END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
CREATE TRIGGER "savings_movements_clear_stale_copies" BEFORE UPDATE ON "savings_movements" FOR EACH ROW EXECUTE FUNCTION "savings_movements_clear_stale_copies"();

CREATE FUNCTION "currency_exchanges_clear_stale_copies"() RETURNS trigger AS $$
BEGIN
  IF NEW."from_cents" IS DISTINCT FROM OLD."from_cents" AND NEW."from_enc" IS NOT DISTINCT FROM OLD."from_enc" THEN NEW."from_enc" := NULL; END IF;
  IF NEW."to_cents" IS DISTINCT FROM OLD."to_cents" AND NEW."to_enc" IS NOT DISTINCT FROM OLD."to_enc" THEN NEW."to_enc" := NULL; END IF;
  IF NEW."note" IS DISTINCT FROM OLD."note" AND NEW."note_enc" IS NOT DISTINCT FROM OLD."note_enc" THEN NEW."note_enc" := NULL; END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
CREATE TRIGGER "currency_exchanges_clear_stale_copies" BEFORE UPDATE ON "currency_exchanges" FOR EACH ROW EXECUTE FUNCTION "currency_exchanges_clear_stale_copies"();
