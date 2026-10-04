# Project Progress

Last updated: 2026-10-03

## Completed

- Scaffolded Next.js 16.3.4 app (TypeScript, Tailwind v4, ESLint, `src/` layout).
- Added `AGENTS.md` from astrocoach.
- Applied Yield brand: palette tokens, fonts, logo, favicon, PWA manifest, and app icons.
- Defined the product spec (domain model, financial rules, screens) in `PROJECT_DECISIONS.md` from the MFP spreadsheet review.
- Slice 1, daily logging:
  - Prisma schema and initial migration (users, auth, payment methods, categories, purchases, income sources, incomes).
  - Google sign-in restricted to allow-listed emails; default Cash method and categories created on first sign-in.
  - English and Spanish interface with locale-prefixed routes.
  - Quick add for expenses (amount, description, category, payment method, date, card installments) and income (amount, source, date, note).
  - Month view: spending, income, and balance; totals by category; entries grouped by day; installments carried from earlier months; delete.
  - Income view: monthly total, totals by source, and gross/car spending/net rideshare income; daily log with delete.
  - Settings: language, credit cards (color, closing day, due day), income sources (with rideshare flag), and sign out.
  - Tests for amount parsing, month arithmetic, installment splitting, and month summaries.

- Slice 2, recurring payments and card statements:
  - Schema and migration for recurring payments, per-month occurrence overrides, and statement payments.
  - Recurring payments page: add (amount, day, category, payment method, start month) and stop.
  - Month view: balance (income − total to pay), spending, income, total to pay, and outstanding; card statements due with paid toggles; recurring payments with per-month amount changes and paid toggles (cash) or statement status (card).
  - Cards page: statements per card from three months back through future installments, with closing and due dates, status (open, upcoming, due, overdue, paid), charges, paid toggle, and installments owed.
  - Recurring car costs now count toward net rideshare income.
  - Tests for billing cycles (including closing and due on the same day), recurring occurrences, and month cash flow.

- Structure for the remaining screens (no new screens yet):
  - Migration: savings funds and movements, category `includeInAverage` and `archivedAt`; backfills Extras as excluded from the average and an emergency fund per existing user.
  - Pure logic with tests: average monthly spending, savings balances and emergency fund goal (reproducing the spreadsheet's 15,235 and 48,893), installments owed, and a shared month summary including savings in total to pay.
  - One range loader (`loadLedgerRange`) with view loaders for month, year (12 months plus averages), and savings.
  - Server actions: edit purchases, incomes, recurring payments (preserving past months), cards, and income sources; create, rename, reorder, and archive categories; savings deposits, withdrawals, goals, and emergency fund months; idempotent creates via client ids.

- Expense items (reusable concepts like "Gasolina"):
  - Migration creating items from existing purchase descriptions and recurring payment names, linking every purchase and recurring payment, then dropping the old columns; verified by running all migrations against an embedded Postgres (PGlite) with seeded data.
  - Spending is summarized per item as well as per category.
  - Expense and recurring forms: an item field suggesting existing items; a new name asks for its category. Purchases gained an optional note.
  - Actions to rename or recategorize, archive, and merge items.

- Year view: spreadsheet-style 12-month grid (categories, item rows, yearly totals, spending/to pay/outstanding/income/balance), month view filtering by item, Year tab in navigation with Settings moved to the header.
- Prisma migrations always use the direct (non-pooled) connection, after a pooled session kept the migration lock and blocked deploys.

- Card statements now belong to the month they close, with due date and days remaining; unpaid statements carry into the current month until paid.

- Cards are due a number of days after closing (15 / 20 / 30 presets or any 1–60) instead of a fixed due day; migration converts existing cards (Nu, Klar, DiDi → 15 days; Plata → 30), verified on an embedded Postgres.

- Recurring payments: variable amounts (estimated from recent confirmed amounts, confirm or confirm-and-pay in the month view), repeat every N months, and editing on the recurring payments page.

## Next

- Editing entries, cards, and income sources.
- Savings screen.
- Item and category management in Settings (rename, recategorize, merge, archive, reorder).
- Faster quick add (remember each item's usual payment method and amount).
- Offline entry: service worker plus a local queue that replays creates with their client ids.
