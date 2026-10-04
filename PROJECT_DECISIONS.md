# Project Decisions

Last updated: 2026-10-03

## Product scope

- Yield Personal is a personal finance app replacing the user's "MFP" (Mis Finanzas Personales) Google Sheet, delivered as a mobile-first installable PWA deployed to Vercel.
- It is part of the Yield umbrella brand alongside Yield Café. The products share branding but are separate codebases; do not introduce shared packages or a monorepo until there is concrete shared code.
- The goal is to improve on the spreadsheet with daily-finance-app functionality, not to copy it. The spreadsheet's mental model (consumption vs. cash out, card bills, emergency fund) is preserved; its manual mechanics (cell colors, `=410+410+410` sums, per-month income tabs) are replaced by individual records.
- Single user, used on both phone and PC. Most entries are recorded on the phone at the moment of purchase, so quick entry on a small screen is the primary design target. Data lives in a server database behind authentication so it is shared across devices and survives device loss.

## Domain model

- **Payment method**: Cash, or a credit card with name, color, statement closing day, and payment due day.
- **Category**: Fixed, Food (Despensa / Comida / Café), Car, and Extras to start; categories are user-editable.
- **Purchase**: amount, date, category, description, and payment method. A card purchase may be split into interest-free monthly installments (MSI).
- **Installment plan**: created from a card purchase split into installments; each installment is assigned to the correct card statement automatically.
- **Recurring payment**: name, amount, category, day of month, and default payment method. It produces one occurrence per month that is tracked as paid or unpaid.
- **Card statement**: derived from the card's billing cycle. It contains every charge and installment falling in that cycle, has a due date, and is marked paid or unpaid.
- **Income**: date, source, and amount, recorded daily. Sources are user-defined; Uber, Didi, and any other driving app belong to a **Rideshare** source group.
- **Savings fund**: the emergency fund, with a target and contributions.

## Financial rules

- A purchase counts toward spending (consumption) in the month it was made, at its full amount; an installment purchase counts toward consumption as its monthly installments.
- Cash outflow ("total to pay") for a month is cash purchases, recurring payments paid in cash, and card statements due that month. Card-paid purchases are never counted both as spending and inside a card payment in the same total.
- A card charge belongs to the statement whose cycle contains its date (for example, with a closing day of 25, a purchase on Oct 28 falls on the November statement).
- A recurring payment assigned to a card is considered paid when the statement containing it is paid; it is never marked paid twice.
- "Por pagar" (outstanding) is the set of unpaid recurring occurrences, unpaid cash items, and unpaid card statements for the month.
- A statement's payment is due in the month it closes when the due day comes after the closing day; when the due day is the same as or before the closing day, it is due the following month (a card closing and due on the 15th is due on the 15th of the next month). Closing and due days past a month's end fall on its last day.
- A charge belongs to the statement closing on or after its date; each installment of a card purchase lands on the next consecutive statement.
- Recurring payments generate one occurrence per month between their start and end months. Occurrence rows are stored only when a month differs from the default (a changed amount, or a cash payment marked paid); a card-paid occurrence is paid when its statement is paid.
- Stopping a recurring payment keeps it through the current month only if that month was already paid or changed; a payment that never applied to a past month is deleted instead.
- Statements are derived, never stored; only "statement paid" is persisted per card and closing month. Archived cards keep showing while they have unpaid statements.
- Month balance follows the spreadsheet: income − total to pay.
- Net rideshare income = rideshare-group income − all Car category spending for the same month. Income is entered gross.
- Average monthly spending covers the last 12 months including the current one: for each category marked "include in average", the mean over the months in which it had spending, summed. Extras are excluded by default; custom categories choose when created.
- Savings are their own records (deposits and withdrawals into a savings fund), not purchases. Money moved into savings counts in the month's total to pay but never as spending.
- Every user has one emergency fund whose target is `coverMonths` (default 3) × average monthly spending, plus installments still owed on unpaid statements. Pending = target − fund balance. Additional goal funds have a fixed target.

## Screens

- **Year view (home)**: categories as rows, the last 12 months ending with the current month as columns, with subtotals, consumption, total to pay, outstanding, income, and balance. Tapping a cell opens that month's records for that category.
- **Quick add**: always-available entry for an expense or income. Expense flow: amount → category → payment method → date (defaults to today) → installments when paid by card.
- **Month view**: all records for the month, recurring payments with paid/unpaid state, and card statements due.
- **Cards**: current statement, next due date, and upcoming installments per card.
- **Income**: daily log with monthly totals per source and net rideshare income.
- **Savings**: average monthly spending, emergency fund target, MSI owed, current fund, and pending amount.

## Brand

- Use the existing Yield brand (palette, Syne/Inter/DM Mono, Y-in-cup mark) documented in `BRAND.md`. Yield Personal is distinguished by a Yield Green Y; Yield Café uses Espresso Amber.
- The interface is dark-only, following the brand palette.

## Stack

- Next.js 16 App Router, TypeScript, Tailwind CSS v4, matching the astrocoach project conventions in `AGENTS.md`. The older yield-cafe conventions (JavaScript, SCSS, no Tailwind) do not apply.
- Postgres through Prisma 7 (`@prisma/adapter-pg`, client generated to `src/generated/prisma`), and Auth.js v5 with Google sign-in and database sessions, as in astrocoach.
- Sign-in is restricted to the emails in `ALLOWED_EMAILS`; every Server Action re-checks the session and scopes reads and writes to the signed-in user.
- Environment variables are read where they are used, so the build never needs credentials. Missing `ALLOWED_EMAILS` refuses every sign-in rather than allowing anyone.
- Vercel deployments run `prisma migrate deploy` before `next build` (see `vercel.json`), so schema migrations ship with the code that needs them.
- A new user receives a Cash payment method and the built-in categories on first sign-in.

## Data conventions

- Money is stored as integer centavos in Mexican pesos and displayed as `$1,230.00` in both languages, always in DM Mono with tabular figures.
- Purchase and income dates are calendar dates (`@db.Date`) with no time of day. "Today" is decided in `APP_TIME_ZONE` (default `America/Tijuana`).
- Built-in categories are identified by a stable `key` (`fixed`, `food`, `car`, `extras`) and labelled through translations; custom categories store a `name`.
- Installment amounts split evenly, with leftover centavos assigned to the earliest installments. Purchases support 1–48 installments, and more than one only when paid by card.
- Cards, income sources, categories, and goal funds are archived rather than deleted so past records keep them. New entries require active ones; edits may keep archived ones already in use.
- A custom category name takes precedence over the translated built-in label.
- Editing a recurring payment applies from the current month: if it already ran in earlier months, the old version ends last month and a new version starts this month, carrying over this month's and later per-month changes.
- Editing a card's billing cycle applies to all of its statements, past ones included.
- New purchases, incomes, and savings movements may carry a client-generated UUID; repeating a create with the same id does nothing, so retried submissions (such as a future offline queue) never duplicate entries.
- All month figures come from one range loader plus pure summaries (`loadLedgerRange` + `summarizeMonth`), shared by the month, year, income, cards, and savings screens.
- Cash is shown in Yield Green, keeping the spreadsheet's convention. Card colors come from a fixed palette that excludes green and red so they never read as a status.

## Language

- English is the default; Spanish is fully supported. Routes are prefixed with the locale (`/en/...`, `/es/...`), and the choice is remembered in the `yield-locale` cookie. All interface text lives in `src/i18n/messages/{en,es}.json`.
