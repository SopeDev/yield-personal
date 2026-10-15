-- Latest exchange rates, to count balances in other currencies in the main one.
CREATE TABLE "exchange_rates" (
    "base" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "rate_date" DATE NOT NULL,
    "fetched_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("base","quote")
);
