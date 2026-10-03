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

## Next

- Provision the database and Google OAuth client, deploy to Vercel, and exercise slice 1 on a phone.
- Slice 2: recurring payments with monthly paid/unpaid occurrences, and card statements derived from billing cycles (statement assignment, due dates, paying a statement marks its card-paid recurring occurrences as paid). This enables "total to pay" and "outstanding" in the month view.
- Slice 3: year view (last 12 months) as the home screen, and the savings screen (average monthly spending, emergency fund, MSI owed).
- Later: editing entries, managing custom categories, offline entry.
