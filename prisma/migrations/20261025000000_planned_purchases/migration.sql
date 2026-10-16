-- Planned purchases: logged for a later date, they stay planned until confirmed once their day comes. Purchases
-- already dated in the future become plans; everything else was spent.
ALTER TABLE "purchases" ADD COLUMN "planned" BOOLEAN NOT NULL DEFAULT false;
UPDATE "purchases" SET "planned" = true WHERE "date" > (now() AT TIME ZONE 'America/Tijuana')::date;
