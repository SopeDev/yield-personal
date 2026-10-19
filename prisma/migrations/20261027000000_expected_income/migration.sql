-- Expected income: logged for a later date, it's expected until confirmed once its day comes. Income already dated
-- in the future becomes expected; everything else was received.
ALTER TABLE "incomes" ADD COLUMN "expected" BOOLEAN NOT NULL DEFAULT false;
UPDATE "incomes" SET "expected" = true WHERE "date" > (now() AT TIME ZONE 'America/Tijuana')::date;
