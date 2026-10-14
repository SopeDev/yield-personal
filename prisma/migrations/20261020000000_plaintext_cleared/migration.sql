-- Amounts, names and notes are now kept only encrypted. The plaintext columns are emptied wherever their encrypted
-- copy exists (scripts/encrypt-existing.ts, run before and after this migration, encrypts any row without one) and
-- no longer required; a later migration drops them, once no deployment that reads them can still be serving.

-- The step-1 triggers kept copies from going stale while plaintext was still written; nothing writes it any more.
DROP TRIGGER IF EXISTS "users_clear_stale_copies" ON "users";
DROP FUNCTION IF EXISTS "users_clear_stale_copies"();
DROP TRIGGER IF EXISTS "payment_methods_clear_stale_copies" ON "payment_methods";
DROP FUNCTION IF EXISTS "payment_methods_clear_stale_copies"();
DROP TRIGGER IF EXISTS "categories_clear_stale_copies" ON "categories";
DROP FUNCTION IF EXISTS "categories_clear_stale_copies"();
DROP TRIGGER IF EXISTS "purchases_clear_stale_copies" ON "purchases";
DROP FUNCTION IF EXISTS "purchases_clear_stale_copies"();
DROP TRIGGER IF EXISTS "expense_items_clear_stale_copies" ON "expense_items";
DROP FUNCTION IF EXISTS "expense_items_clear_stale_copies"();
DROP TRIGGER IF EXISTS "income_sources_clear_stale_copies" ON "income_sources";
DROP FUNCTION IF EXISTS "income_sources_clear_stale_copies"();
DROP TRIGGER IF EXISTS "income_groups_clear_stale_copies" ON "income_groups";
DROP FUNCTION IF EXISTS "income_groups_clear_stale_copies"();
DROP TRIGGER IF EXISTS "incomes_clear_stale_copies" ON "incomes";
DROP FUNCTION IF EXISTS "incomes_clear_stale_copies"();
DROP TRIGGER IF EXISTS "recurring_incomes_clear_stale_copies" ON "recurring_incomes";
DROP FUNCTION IF EXISTS "recurring_incomes_clear_stale_copies"();
DROP TRIGGER IF EXISTS "recurring_payments_clear_stale_copies" ON "recurring_payments";
DROP FUNCTION IF EXISTS "recurring_payments_clear_stale_copies"();
DROP TRIGGER IF EXISTS "recurring_occurrences_clear_stale_copies" ON "recurring_occurrences";
DROP FUNCTION IF EXISTS "recurring_occurrences_clear_stale_copies"();
DROP TRIGGER IF EXISTS "savings_funds_clear_stale_copies" ON "savings_funds";
DROP FUNCTION IF EXISTS "savings_funds_clear_stale_copies"();
DROP TRIGGER IF EXISTS "savings_movements_clear_stale_copies" ON "savings_movements";
DROP FUNCTION IF EXISTS "savings_movements_clear_stale_copies"();
DROP TRIGGER IF EXISTS "currency_exchanges_clear_stale_copies" ON "currency_exchanges";
DROP FUNCTION IF EXISTS "currency_exchanges_clear_stale_copies"();

-- Items are found and kept unique by their name index instead of their plaintext name.
DROP INDEX IF EXISTS "expense_items_user_id_normalized_name_key";

UPDATE "users" SET "balance_goal_cents" = NULL WHERE "balance_goal_cents" IS NOT NULL AND "balance_goal_enc" IS NOT NULL;
ALTER TABLE "payment_methods" ALTER COLUMN "name" DROP NOT NULL;
UPDATE "payment_methods" SET "name" = NULL WHERE "name" IS NOT NULL AND "name_enc" IS NOT NULL;
UPDATE "payment_methods" SET "cash_count_cents" = NULL WHERE "cash_count_cents" IS NOT NULL AND "cash_count_enc" IS NOT NULL;
UPDATE "categories" SET "name" = NULL WHERE "name" IS NOT NULL AND "name_enc" IS NOT NULL;
ALTER TABLE "purchases" ALTER COLUMN "amount_cents" DROP NOT NULL;
UPDATE "purchases" SET "amount_cents" = NULL WHERE "amount_cents" IS NOT NULL AND "amount_enc" IS NOT NULL;
UPDATE "purchases" SET "note" = NULL WHERE "note" IS NOT NULL AND "note_enc" IS NOT NULL;
ALTER TABLE "expense_items" ALTER COLUMN "name" DROP NOT NULL;
UPDATE "expense_items" SET "name" = NULL WHERE "name" IS NOT NULL AND "name_enc" IS NOT NULL;
ALTER TABLE "expense_items" ALTER COLUMN "normalized_name" DROP NOT NULL;
UPDATE "expense_items" SET "normalized_name" = NULL WHERE "normalized_name" IS NOT NULL AND "name_index" IS NOT NULL;
ALTER TABLE "income_sources" ALTER COLUMN "name" DROP NOT NULL;
UPDATE "income_sources" SET "name" = NULL WHERE "name" IS NOT NULL AND "name_enc" IS NOT NULL;
ALTER TABLE "income_groups" ALTER COLUMN "name" DROP NOT NULL;
UPDATE "income_groups" SET "name" = NULL WHERE "name" IS NOT NULL AND "name_enc" IS NOT NULL;
ALTER TABLE "incomes" ALTER COLUMN "amount_cents" DROP NOT NULL;
UPDATE "incomes" SET "amount_cents" = NULL WHERE "amount_cents" IS NOT NULL AND "amount_enc" IS NOT NULL;
UPDATE "incomes" SET "note" = NULL WHERE "note" IS NOT NULL AND "note_enc" IS NOT NULL;
ALTER TABLE "recurring_incomes" ALTER COLUMN "amount_cents" DROP NOT NULL;
UPDATE "recurring_incomes" SET "amount_cents" = NULL WHERE "amount_cents" IS NOT NULL AND "amount_enc" IS NOT NULL;
ALTER TABLE "recurring_payments" ALTER COLUMN "amount_cents" DROP NOT NULL;
UPDATE "recurring_payments" SET "amount_cents" = NULL WHERE "amount_cents" IS NOT NULL AND "amount_enc" IS NOT NULL;
UPDATE "recurring_occurrences" SET "amount_cents" = NULL WHERE "amount_cents" IS NOT NULL AND "amount_enc" IS NOT NULL;
UPDATE "savings_funds" SET "name" = NULL WHERE "name" IS NOT NULL AND "name_enc" IS NOT NULL;
UPDATE "savings_funds" SET "target_cents" = NULL WHERE "target_cents" IS NOT NULL AND "target_enc" IS NOT NULL;
ALTER TABLE "savings_movements" ALTER COLUMN "amount_cents" DROP NOT NULL;
UPDATE "savings_movements" SET "amount_cents" = NULL WHERE "amount_cents" IS NOT NULL AND "amount_enc" IS NOT NULL;
UPDATE "savings_movements" SET "note" = NULL WHERE "note" IS NOT NULL AND "note_enc" IS NOT NULL;
ALTER TABLE "currency_exchanges" ALTER COLUMN "from_cents" DROP NOT NULL;
UPDATE "currency_exchanges" SET "from_cents" = NULL WHERE "from_cents" IS NOT NULL AND "from_enc" IS NOT NULL;
ALTER TABLE "currency_exchanges" ALTER COLUMN "to_cents" DROP NOT NULL;
UPDATE "currency_exchanges" SET "to_cents" = NULL WHERE "to_cents" IS NOT NULL AND "to_enc" IS NOT NULL;
UPDATE "currency_exchanges" SET "note" = NULL WHERE "note" IS NOT NULL AND "note_enc" IS NOT NULL;

-- While this version builds, the previous one still writes plaintext beside each copy: clear it as it's written.
CREATE FUNCTION "users_clear_plaintext"() RETURNS trigger AS $$
BEGIN
  IF NEW."balance_goal_enc" IS NOT NULL THEN NEW."balance_goal_cents" := NULL; END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
CREATE TRIGGER "users_clear_plaintext" BEFORE INSERT OR UPDATE ON "users" FOR EACH ROW EXECUTE FUNCTION "users_clear_plaintext"();

CREATE FUNCTION "payment_methods_clear_plaintext"() RETURNS trigger AS $$
BEGIN
  IF NEW."name_enc" IS NOT NULL THEN NEW."name" := NULL; END IF;
  IF NEW."cash_count_enc" IS NOT NULL THEN NEW."cash_count_cents" := NULL; END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
CREATE TRIGGER "payment_methods_clear_plaintext" BEFORE INSERT OR UPDATE ON "payment_methods" FOR EACH ROW EXECUTE FUNCTION "payment_methods_clear_plaintext"();

CREATE FUNCTION "categories_clear_plaintext"() RETURNS trigger AS $$
BEGIN
  IF NEW."name_enc" IS NOT NULL THEN NEW."name" := NULL; END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
CREATE TRIGGER "categories_clear_plaintext" BEFORE INSERT OR UPDATE ON "categories" FOR EACH ROW EXECUTE FUNCTION "categories_clear_plaintext"();

CREATE FUNCTION "purchases_clear_plaintext"() RETURNS trigger AS $$
BEGIN
  IF NEW."amount_enc" IS NOT NULL THEN NEW."amount_cents" := NULL; END IF;
  IF NEW."note_enc" IS NOT NULL THEN NEW."note" := NULL; END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
CREATE TRIGGER "purchases_clear_plaintext" BEFORE INSERT OR UPDATE ON "purchases" FOR EACH ROW EXECUTE FUNCTION "purchases_clear_plaintext"();

CREATE FUNCTION "expense_items_clear_plaintext"() RETURNS trigger AS $$
BEGIN
  IF NEW."name_enc" IS NOT NULL THEN NEW."name" := NULL; END IF;
  IF NEW."name_index" IS NOT NULL THEN NEW."normalized_name" := NULL; END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
CREATE TRIGGER "expense_items_clear_plaintext" BEFORE INSERT OR UPDATE ON "expense_items" FOR EACH ROW EXECUTE FUNCTION "expense_items_clear_plaintext"();

CREATE FUNCTION "income_sources_clear_plaintext"() RETURNS trigger AS $$
BEGIN
  IF NEW."name_enc" IS NOT NULL THEN NEW."name" := NULL; END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
CREATE TRIGGER "income_sources_clear_plaintext" BEFORE INSERT OR UPDATE ON "income_sources" FOR EACH ROW EXECUTE FUNCTION "income_sources_clear_plaintext"();

CREATE FUNCTION "income_groups_clear_plaintext"() RETURNS trigger AS $$
BEGIN
  IF NEW."name_enc" IS NOT NULL THEN NEW."name" := NULL; END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
CREATE TRIGGER "income_groups_clear_plaintext" BEFORE INSERT OR UPDATE ON "income_groups" FOR EACH ROW EXECUTE FUNCTION "income_groups_clear_plaintext"();

CREATE FUNCTION "incomes_clear_plaintext"() RETURNS trigger AS $$
BEGIN
  IF NEW."amount_enc" IS NOT NULL THEN NEW."amount_cents" := NULL; END IF;
  IF NEW."note_enc" IS NOT NULL THEN NEW."note" := NULL; END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
CREATE TRIGGER "incomes_clear_plaintext" BEFORE INSERT OR UPDATE ON "incomes" FOR EACH ROW EXECUTE FUNCTION "incomes_clear_plaintext"();

CREATE FUNCTION "recurring_incomes_clear_plaintext"() RETURNS trigger AS $$
BEGIN
  IF NEW."amount_enc" IS NOT NULL THEN NEW."amount_cents" := NULL; END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
CREATE TRIGGER "recurring_incomes_clear_plaintext" BEFORE INSERT OR UPDATE ON "recurring_incomes" FOR EACH ROW EXECUTE FUNCTION "recurring_incomes_clear_plaintext"();

CREATE FUNCTION "recurring_payments_clear_plaintext"() RETURNS trigger AS $$
BEGIN
  IF NEW."amount_enc" IS NOT NULL THEN NEW."amount_cents" := NULL; END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
CREATE TRIGGER "recurring_payments_clear_plaintext" BEFORE INSERT OR UPDATE ON "recurring_payments" FOR EACH ROW EXECUTE FUNCTION "recurring_payments_clear_plaintext"();

CREATE FUNCTION "recurring_occurrences_clear_plaintext"() RETURNS trigger AS $$
BEGIN
  IF NEW."amount_enc" IS NOT NULL THEN NEW."amount_cents" := NULL; END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
CREATE TRIGGER "recurring_occurrences_clear_plaintext" BEFORE INSERT OR UPDATE ON "recurring_occurrences" FOR EACH ROW EXECUTE FUNCTION "recurring_occurrences_clear_plaintext"();

CREATE FUNCTION "savings_funds_clear_plaintext"() RETURNS trigger AS $$
BEGIN
  IF NEW."name_enc" IS NOT NULL THEN NEW."name" := NULL; END IF;
  IF NEW."target_enc" IS NOT NULL THEN NEW."target_cents" := NULL; END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
CREATE TRIGGER "savings_funds_clear_plaintext" BEFORE INSERT OR UPDATE ON "savings_funds" FOR EACH ROW EXECUTE FUNCTION "savings_funds_clear_plaintext"();

CREATE FUNCTION "savings_movements_clear_plaintext"() RETURNS trigger AS $$
BEGIN
  IF NEW."amount_enc" IS NOT NULL THEN NEW."amount_cents" := NULL; END IF;
  IF NEW."note_enc" IS NOT NULL THEN NEW."note" := NULL; END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
CREATE TRIGGER "savings_movements_clear_plaintext" BEFORE INSERT OR UPDATE ON "savings_movements" FOR EACH ROW EXECUTE FUNCTION "savings_movements_clear_plaintext"();

CREATE FUNCTION "currency_exchanges_clear_plaintext"() RETURNS trigger AS $$
BEGIN
  IF NEW."from_enc" IS NOT NULL THEN NEW."from_cents" := NULL; END IF;
  IF NEW."to_enc" IS NOT NULL THEN NEW."to_cents" := NULL; END IF;
  IF NEW."note_enc" IS NOT NULL THEN NEW."note" := NULL; END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
CREATE TRIGGER "currency_exchanges_clear_plaintext" BEFORE INSERT OR UPDATE ON "currency_exchanges" FOR EACH ROW EXECUTE FUNCTION "currency_exchanges_clear_plaintext"();
