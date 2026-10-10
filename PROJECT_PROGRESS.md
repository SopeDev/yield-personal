# Project Progress

Last updated: 2026-10-10

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

- Editing: purchases and income (edit pages from their rows), cards and income sources (in Settings); double-submit protection on new entries.
- Savings screen: emergency fund goal breakdown and progress, average spending by category, deposits/withdrawals, goals, and movement history.
- Settings: categories (rename, include in average, reorder, archive/restore, add) and an Items page (rename, recategorize, merge, archive/restore).

- Faster quick add: choosing an item fills in its usual payment method and amount from its recent purchases.
- Unpaid cash recurring bills from earlier months carry into the current month (with paid toggles and confirm forms); the Year view marks estimated amounts with "≈".
- Card days to pay is a plain number input (no presets); expense and income amounts fill from the right, digits only, starting at 0.00.
- Income page: daily average gross and net (after car spending) over the days with income.
- Month view: average daily balance (income − spending over the days passed).
- Recurring payments: change a month's payment method from the month view (applies to later months too; earlier months keep theirs); a late switch to a card is charged on the switch day. Migration adds `charged_on` to recurring occurrences.
- Income page summary consolidated into one card like the month balance: total income, rideshare gross / car spending / net / days with income, and the daily average (net, with gross in the hint).
- All money inputs use the add page's digits-only, fill-from-the-right entry; quick add keeps the amount when switching between Expense and Income.
- Month summary: always two columns (income/spending, to pay/outstanding, avg. daily balance/needed per day), adding income needed per remaining day to cover the month.
- Month summary reordered (income/to pay, spending/outstanding, needed per day/daily net); the average daily balance became daily net, which leaves out recurring bills, earlier installments, and extras.
- Monthly balance goal: set in Settings; savings count toward it; the month view shows progress under Balance and the goal's daily target in Needed per day (break-even noted below). Migration adds `balance_goal_cents` to users.
- Estimated variable bills stay collapsed in the month view until tapped; confirming the amount and method also marks a cash bill paid.
- Needed per day now includes typical daily spending (everyday purchases pooled over up to 3 full months plus this month); a "Count history from" setting excludes partial early months from it and from average monthly spending. Migration adds `history_start_month` to users.
- Month summary compares gross with gross: daily income (with daily net below) beside needed per day.

- Customization step 1: category types (everyday / bills / occasional) replace "include in average", and income groups (sources plus the categories their net deducts) replace the rideshare flag and the built-in Car deduction. Migration backfills both (Fixed → bills, Extras → occasional; rideshare sources → a "Rideshare" group deducting Car), verified on an embedded Postgres.

- Performance: a loading screen for every signed-in screen, so navigation switches instantly and dynamic routes can be partly prefetched. Audit found the database co-located with the functions (both Washington, D.C. / us-east-1); then JWT sessions, a 4-connection pool cap, the Savings page's queries running together, and `/` redirected in the routing layer. Then the ledger loader stopped reading old single-payment purchases (about 14 months instead of 60 for the month view), verified against five years of seeded data on an embedded Postgres with every screen's figures unchanged; a separate Income loader was dropped because the stat library's cards need the full month figures. Remaining: client caching of visited tabs, and checking for sequential nested queries.

- Customization step 2: a stat library (`src/lib/stats.ts`) holding every summary figure with its label, calculation, tone, and note; the month and income summary cards are rebuilt on it as layouts of stat references, unchanged on screen.

- Cash on hand ("Disponible"): set and recount in Settings, which shows the current figure and how far the last count was off; tracked from income, cash purchases, paid bills and statements, and savings since counting. Registered as the `cashOnHand` stat (`monthStatContext` takes it from `loadCashOnHand`); not on the default cards, but any card can add it through Customize. Migration adds `cash_on_hand_cents` and `cash_on_hand_set_at` to users.

- Customization step 3: customizable summary cards. A "Customize" link under the month and income cards opens an editor (headline, add / move / remove stats, reset) with a live preview; layouts are saved per user, and money on hand loads only for a card that shows it. Income rhythm in Settings (daily, weekly, every 2 weeks, or days of the month) adds needed per payday and income per payday, which replace the daily pair on the default month card when income isn't daily. Migration adds `income_rhythm`, `income_rhythm_anchor`, `income_pay_days`, and `summary_cards` to users, verified on an embedded Postgres.

- Main currency setting (MXN, USD, CAD, EUR) replacing the hard-coded pesos; amounts are relabeled, not converted. Migration adds `currency` to users. Money on hand now loads alongside the month's figures (its count comes with the settings), instead of after them.

- Multi-currency: payment methods (one cash wallet per currency, cards), income, and savings funds have a currency; currency exchanges are a new entry (an Exchange tab on Add once there are wallets in two currencies). Currencies are never converted: headline figures are the main currency's, with other currencies noted beside them and every list amount in its own currency (distinct symbols like US$). Cash on hand is per wallet. Migration backfills existing records with the main currency and moves the counted cash to the Cash wallet, verified on an embedded Postgres; every figure on peso-only seeded data is unchanged, and a mixed peso/dollar scenario checked out by hand.

- New income sources from quick add (and the income edit form): a "+ New source" chip names one in place, with an optional group; an existing name (even archived) is reused instead of duplicated, and a first income no longer requires a trip to Settings.

- Days off left: a stat (offered in Customize with a daily income rhythm) for how many days can be taken off this month at the current pace and still reach the balance goal, with breaking even noted below. Gas and other deducted work costs count only on days worked; living costs count every day. The pace of work pools the same history as typical daily spending (from "Count history from", up to 3 full months back), so it doesn't restart each month; the month view now loads recent incomes for it. Stats can now show a number of days as well as amounts. Checked against October's real figures (3 days off for the goal, 6 to break even).

- Fix: saving a new amount in a form that keeps its default (balance goal, savings goal target, recurring and occurrence amounts) no longer shows the previous amount until a refresh. React resets the form in the same update that brings the saved amount back, before the input's reset listener knew it; resetting now goes back to whatever the latest default is.

## Next

- Customization step 4: recurring income with a projected month-end balance (the income rhythm's paydays are a natural base for expected income).
- Then: category budgets, and quick wins (start screen, last-used category, calendar-year option).
