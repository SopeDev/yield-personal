# Project Decisions

Last updated: 2026-10-04

## Product scope

- Yield Personal is a personal finance app replacing the user's "MFP" (Mis Finanzas Personales) Google Sheet, delivered as a mobile-first installable PWA deployed to Vercel.
- It is part of the Yield umbrella brand alongside Yield Café. The products share branding but are separate codebases; do not introduce shared packages or a monorepo until there is concrete shared code.
- The goal is to improve on the spreadsheet with daily-finance-app functionality, not to copy it. The spreadsheet's mental model (consumption vs. cash out, card bills, emergency fund) is preserved; its manual mechanics (cell colors, `=410+410+410` sums, per-month income tabs) are replaced by individual records.
- Single user, used on both phone and PC. Most entries are recorded on the phone at the moment of purchase, so quick entry on a small screen is the primary design target. Data lives in a server database behind authentication so it is shared across devices and survives device loss.

## Domain model

- **Payment method**: Cash, or a credit card with name, color, statement closing day, and days to pay after closing (for example 15 or 30).
- **Category**: Fixed, Food (Despensa / Comida / Café), Car, and Extras to start; categories are user-editable.
- **Expense item**: a reusable expense concept such as "Gasolina" or "Renta" (the spreadsheet's rows), belonging to one category. Spending is tracked per item across time. Item names are unique per user ignoring case and repeated spaces; typing an existing name reuses the item, and a new name creates one in the chosen category.
- **Purchase**: amount, date, expense item (which sets the category), optional note, and payment method. A card purchase may be split into interest-free monthly installments (MSI).
- **Installment plan**: created from a card purchase split into installments; each installment is assigned to the correct card statement automatically.
- **Recurring payment**: expense item (its name and category), amount, day of month, and usual payment method. It produces one occurrence per month that is tracked as paid or unpaid. A month's payment method can be changed from the month view; the change also becomes the usual method for later months, while earlier months keep theirs.
- **Card statement**: derived from the card's billing cycle. It contains every charge and installment falling in that cycle, has a due date, and is marked paid or unpaid.
- **Income**: date, source, and amount, recorded daily. Sources are user-defined; Uber, Didi, and any other driving app belong to a **Rideshare** source group.
- **Savings fund**: the emergency fund, with a target and contributions.

## Financial rules

- A purchase counts toward spending (consumption) in the month it was made, at its full amount; an installment purchase counts toward consumption as its monthly installments.
- Cash outflow ("total to pay") for a month is cash purchases, recurring payments paid in cash, money moved into savings, and card statements that close that month. Statements belong to their closing month (not their due month) to encourage paying them as soon as they are issued; each shows its due date and days remaining.
- Unpaid card statements and unpaid cash recurring bills from up to 12 earlier months are carried into the current month's view as a reminder (overdue ones in red), and can be paid or confirmed from there. Months before a recurring payment was added to the app are never carried, since they were paid before it was tracked. They count only in their own month's totals; the current month's outstanding shows them as an addition, and other months and the year view show only their own items. Card-paid purchases are never counted both as spending and inside a card payment in the same total.
- A card charge belongs to the statement whose cycle contains its date (for example, with a closing day of 25, a purchase on Oct 28 falls on the November statement).
- A recurring payment assigned to a card is considered paid when the statement containing it is paid; it is never marked paid twice.
- "Por pagar" (outstanding) is the set of unpaid cash recurring occurrences and unpaid card statements belonging to the month.
- A statement is due a fixed number of days after it closes (`paymentDays`, 1–60, typed per card), so the due date follows real month lengths. A closing day past a month's end falls on its last day. Fixed due days were migrated to days after closing, counting a due day on or before the closing day as 30 days later.
- A charge belongs to the statement closing on or after its date; each installment of a card purchase lands on the next consecutive statement.
- Changing a month's recurring payment method splits the payment like an edit, at that month: the old version ends the month before and a new version (keeping the original's added date) continues with the new method. A bill switched to a card after its due date is charged on the day it was switched (`chargedOn` on the occurrence), so it lands on the statement open that day and never on one that already closed or was paid. Switching to a card clears a cash "paid" mark; switching to cash starts unpaid.
- Recurring payments repeat every `intervalMonths` months (1–12) counted from their start month, between their start and end months; bimonthly bills like CFE use 2.
- A recurring payment can be variable. Each month starts as an estimate (the average of the item's last 3 confirmed amounts, else the usual amount) shown with "≈" and counted in totals; confirming the real amount (and payment method) replaces it and pays it in the same step: a cash bill is marked paid, a card bill is paid with its statement. In the month view an estimated bill stays collapsed until tapped.
- Recurring payments generate one occurrence per billing month. Occurrence rows are stored only when a month differs from the default (a changed amount, or a cash payment marked paid); a card-paid occurrence is paid when its statement is paid.
- Stopping a recurring payment keeps it through the current month only if that month was already paid or changed; a payment that never applied to a past month is deleted instead.
- Statements are derived, never stored; only "statement paid" is persisted per card and closing month. Archived cards keep showing while they have unpaid statements.
- Month balance follows the spreadsheet: income − total to pay.
- Daily net (month view) = (income − everyday spending on days passed, today included) ÷ days passed; everyday spending is purchases made that month in categories included in the average, leaving out recurring bills, installments of earlier purchases, and extras, so big monthly payments don't swamp the typical day. A past month uses all its days; a future month shows none.
- Needed per day (month view) = (total to pay − income) ÷ days left in the month including today, plus typical daily spending (what an ordinary day costs, since those days are still to come); rounded up to the centavo and never below zero. A future month uses all its days, an ended month shows none.
- Typical daily spending = everyday purchases (as in daily net: categories counted in the average, no recurring bills or installments of earlier purchases) from the last 3 full months through today, divided by those days; it starts as the current month's pace and steadies as history builds.
- "Count history from" (Settings, `users.history_start_month`) is the first month used by calculations from past spending (typical daily spending and average monthly spending), for when early months hold only partial records; empty counts every month. The month summary shows Balance as its headline, then a two-column grid: income and outstanding, spending and to pay, needed per day (gross) and daily income (gross average per day passed, green when at or above the target, with daily net below). Needed per day and daily income are both gross so they compare directly.
- Monthly balance goal: one optional amount in Settings (`users.balance_goal_cents`) that applies to every month. Progress = month balance + net money moved into savings that month, so saving never counts against the goal. With a goal, the month view shows it under Balance (amount to go, reached, or missed for an ended month), and Needed per day leads with what's needed per remaining day to reach the goal, noting the break-even figure below.
- Net rideshare income = rideshare-group income − all Car category spending for the same month. Income is entered gross.
- Average monthly spending covers the last 12 months including the current one: for each category marked "include in average", the mean over the months in which it had spending, summed. Extras are excluded by default; custom categories choose when created.
- Savings are their own records (deposits and withdrawals into a savings fund), not purchases. Money moved into savings counts in the month's total to pay but never as spending.
- Every user has one emergency fund whose target is `coverMonths` (default 3) × average monthly spending, plus installments still owed on unpaid statements. Pending = target − fund balance. Additional goal funds have a fixed target.

## Screens

- **Year view**: categories with their items as rows, the last 12 months ending with the current month as columns (navigable by 12 months), a yearly total column, then spending, total to pay, outstanding, income, and balance. Amounts are whole pesos to fit; on phones the item column stays pinned and the grid opens scrolled to the current month. Tapping an item's cell opens that month filtered to the item. Amounts that include an unconfirmed variable bill are marked with "≈" (item, category, and spending rows).
- The app opens on the Month view; the Year view is a tab. Navigation: Month, Year, Add, Income, Cards, with Settings in the header.
- **Quick add**: always-available entry for an expense or income. Expense flow: amount → category → payment method → date (defaults to today) → installments when paid by card. Choosing an existing item fills in its usual payment method and amount (the most frequent among its last 5 purchases, else the latest), without overriding a method already picked or an amount already typed; derived from purchases, not stored.
- **Month view**: all records for the month, recurring payments with paid/unpaid state, and card statements due. An unpaid cash recurring payment's day shows yellow when it's 1–2 days away and red on its day or after; card-paid ones follow their statement's due date instead.
- **Cards**: current statement, next due date, and upcoming installments per card.
- **Income**: one summary card with total income (and days with income), car spending and net (all income minus the month's Car spending), and the daily averages over days with income recorded (gross and net). Rideshare gross and net appear only when the month also has non-rideshare income, since otherwise they repeat the totals. Below: totals per source and the daily log.
- **Savings** (header icon): emergency fund balance and progress toward its goal (average monthly spending × months to cover + installments owed), average spending by category, deposits and withdrawals, other goals with targets, and recent movements.
- **Editing**: purchases and income open in the same form used to add them (tap an entry); cards, income sources, categories, and recurring payments open in place in their lists. Items are managed on their own page from Settings (rename, change category, merge, archive, restore).
- New purchases, incomes, and savings movements send a client-generated id, so a double tap or retry never records an entry twice; forms that stay on the page get a fresh id after each save.

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
- Every money input (expenses, income, recurring amounts, per-month amounts, savings movements and goals) accepts digits only and fills from the right like a cash register, starting at 0.00 (typing 1, 2, 3 shows 0.01, 0.12, 1.23), with the caret kept at the end; backspace removes the last digit. Quick add's Expense and Income tabs switch in place and share the typed amount.
- Purchase and income dates are calendar dates (`@db.Date`) with no time of day. "Today" is decided in `APP_TIME_ZONE` (default `America/Tijuana`).
- Built-in categories are identified by a stable `key` (`fixed`, `food`, `car`, `extras`) and labelled through translations; custom categories store a `name`.
- Installment amounts split evenly, with leftover centavos assigned to the earliest installments. Purchases support 1–48 installments, and more than one only when paid by card.
- Cards, income sources, categories, and goal funds are archived rather than deleted so past records keep them. New entries require active ones; edits may keep archived ones already in use.
- Moving an item to another category moves its whole history. Two items are combined only by an explicit merge, which moves every purchase and recurring payment to the remaining item. Archived items leave suggestions but keep their history; typing an archived item's name restores it.
- Existing purchase descriptions and recurring payment names were migrated into items by normalized name: the most recent purchase's category and the most-used spelling win.
- A custom category name takes precedence over the translated built-in label.
- Editing a recurring payment (amount, day, payment method, item, variable flag, interval) applies from the current month; a bill every few months that keeps its interval continues on its cycle: if it already ran in earlier months, the old version ends last month and a new version starts this month, carrying over this month's and later per-month changes.
- Editing a card's billing cycle applies to all of its statements, past ones included.
- New purchases, incomes, and savings movements may carry a client-generated UUID; repeating a create with the same id does nothing, so retried submissions (such as a future offline queue) never duplicate entries.
- All month figures come from one range loader plus pure summaries (`loadLedgerRange` + `summarizeMonth`), shared by the month, year, income, cards, and savings screens.
- Cash is shown in Yield Green, keeping the spreadsheet's convention. Card colors come from a fixed palette that excludes green and red so they never read as a status.

## Language

- English is the default; Spanish is fully supported. Routes are prefixed with the locale (`/en/...`, `/es/...`), and the choice is remembered in the `yield-locale` cookie. All interface text lives in `src/i18n/messages/{en,es}.json`.
