-- Expense items: reusable concepts ("Gasolina", "Renta") that purchases and recurring payments belong to.
-- Existing purchase descriptions and recurring payment names become items, matched by normalized name
-- (trimmed, single-spaced, lowercase — the same rule as `normalizeItemName` in src/lib/items.ts).

-- CreateTable
CREATE TABLE "expense_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "archived_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "expense_items_category_id_idx" ON "expense_items"("category_id");
CREATE UNIQUE INDEX "expense_items_user_id_normalized_name_key" ON "expense_items"("user_id", "normalized_name");

-- Backfill items from purchases. When the same name was used in several categories, the most recent purchase's
-- category wins; the item keeps the spelling used most often (most recent on ties).
INSERT INTO "expense_items" ("user_id", "category_id", "name", "normalized_name")
SELECT latest."user_id", latest."category_id", spelling."name", latest."normalized_name"
FROM (
  SELECT DISTINCT ON ("user_id", "normalized_name") "user_id", "category_id", "normalized_name"
  FROM (SELECT *, lower(regexp_replace(trim("description"), '\s+', ' ', 'g')) AS "normalized_name" FROM "purchases") AS p
  ORDER BY "user_id", "normalized_name", "date" DESC, "created_at" DESC
) AS latest
JOIN (
  SELECT DISTINCT ON ("user_id", "normalized_name") "user_id", "normalized_name", "name"
  FROM (
    SELECT "user_id",
           regexp_replace(trim("description"), '\s+', ' ', 'g') AS "name",
           lower(regexp_replace(trim("description"), '\s+', ' ', 'g')) AS "normalized_name",
           count(*) AS "uses",
           max("date") AS "last_used"
    FROM "purchases"
    GROUP BY 1, 2, 3
  ) AS counted
  ORDER BY "user_id", "normalized_name", "uses" DESC, "last_used" DESC
) AS spelling ON spelling."user_id" = latest."user_id" AND spelling."normalized_name" = latest."normalized_name";

-- Backfill items from recurring payments that don't match an existing item.
INSERT INTO "expense_items" ("user_id", "category_id", "name", "normalized_name")
SELECT DISTINCT ON ("user_id", lower(regexp_replace(trim("name"), '\s+', ' ', 'g')))
  "user_id",
  "category_id",
  regexp_replace(trim("name"), '\s+', ' ', 'g'),
  lower(regexp_replace(trim("name"), '\s+', ' ', 'g'))
FROM "recurring_payments"
ORDER BY "user_id", lower(regexp_replace(trim("name"), '\s+', ' ', 'g')), "created_at" DESC
ON CONFLICT ("user_id", "normalized_name") DO NOTHING;

-- Link purchases to their items, then retire the old columns.
ALTER TABLE "purchases" ADD COLUMN "item_id" UUID, ADD COLUMN "note" TEXT;
UPDATE "purchases" AS p SET "item_id" = i."id"
FROM "expense_items" AS i
WHERE i."user_id" = p."user_id" AND i."normalized_name" = lower(regexp_replace(trim(p."description"), '\s+', ' ', 'g'));
ALTER TABLE "purchases" ALTER COLUMN "item_id" SET NOT NULL;
ALTER TABLE "purchases" DROP CONSTRAINT "purchases_category_id_fkey";
ALTER TABLE "purchases" DROP COLUMN "category_id", DROP COLUMN "description";

-- Link recurring payments to their items, then retire the old columns.
ALTER TABLE "recurring_payments" ADD COLUMN "item_id" UUID;
UPDATE "recurring_payments" AS r SET "item_id" = i."id"
FROM "expense_items" AS i
WHERE i."user_id" = r."user_id" AND i."normalized_name" = lower(regexp_replace(trim(r."name"), '\s+', ' ', 'g'));
ALTER TABLE "recurring_payments" ALTER COLUMN "item_id" SET NOT NULL;
ALTER TABLE "recurring_payments" DROP CONSTRAINT "recurring_payments_category_id_fkey";
ALTER TABLE "recurring_payments" DROP COLUMN "category_id", DROP COLUMN "name";

-- CreateIndex
CREATE INDEX "purchases_item_id_idx" ON "purchases"("item_id");
CREATE INDEX "recurring_payments_item_id_idx" ON "recurring_payments"("item_id");

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "expense_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "expense_items" ADD CONSTRAINT "expense_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "expense_items" ADD CONSTRAINT "expense_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recurring_payments" ADD CONSTRAINT "recurring_payments_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "expense_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
