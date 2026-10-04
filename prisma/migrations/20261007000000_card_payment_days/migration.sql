-- Cards are due a number of days after their statement closes (for example 15 or 30) instead of on a fixed
-- day of the month. Existing due days convert to the days between closing and due date, counting a due day on
-- or before the closing day as falling in the following month (a 30-day month).
ALTER TABLE "payment_methods" ADD COLUMN "payment_days" INTEGER;

UPDATE "payment_methods"
SET "payment_days" = CASE
  WHEN "due_day" > "closing_day" THEN "due_day" - "closing_day"
  ELSE "due_day" - "closing_day" + 30
END
WHERE "kind" = 'CARD' AND "closing_day" IS NOT NULL AND "due_day" IS NOT NULL;

ALTER TABLE "payment_methods" DROP COLUMN "due_day";
