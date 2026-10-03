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

## Next

- Exercise slice 2 on a phone with real cards and recurring payments.
- Slice 3: year view (last 12 months) as the home screen, and the savings screen (average monthly spending, emergency fund, installments owed).
- Later: editing entries and recurring payments, managing custom categories, offline entry.
