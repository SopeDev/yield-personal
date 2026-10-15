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

- Performance: a loading screen for every signed-in screen, so navigation switches instantly and dynamic routes can be partly prefetched. Audit found the database co-located with the functions (both Washington, D.C. / us-east-1); then JWT sessions, a 4-connection pool cap, the Savings page's queries running together, and `/` redirected in the routing layer. Then the ledger loader stopped reading old single-payment purchases (about 14 months instead of 60 for the month view), verified against five years of seeded data on an embedded Postgres with every screen's figures unchanged; a separate Income loader was dropped because the stat library's cards need the full month figures.

- Customization step 2: a stat library (`src/lib/stats.ts`) holding every summary figure with its label, calculation, tone, and note; the month and income summary cards are rebuilt on it as layouts of stat references, unchanged on screen.

- Cash on hand ("Disponible"): set and recount in Settings, which shows the current figure and how far the last count was off; tracked from income, cash purchases, paid bills and statements, and savings since counting. Registered as the `cashOnHand` stat (`monthStatContext` takes it from `loadCashOnHand`); not on the default cards, but any card can add it through Customize. Migration adds `cash_on_hand_cents` and `cash_on_hand_set_at` to users.

- Customization step 3: customizable summary cards. A "Customize" link under the month and income cards opens an editor (headline, add / move / remove stats, reset) with a live preview; layouts are saved per user, and money on hand loads only for a card that shows it. Income rhythm in Settings (daily, weekly, every 2 weeks, or days of the month) adds needed per payday and income per payday, which replace the daily pair on the default month card when income isn't daily. Migration adds `income_rhythm`, `income_rhythm_anchor`, `income_pay_days`, and `summary_cards` to users, verified on an embedded Postgres.

- Main currency setting (MXN, USD, CAD, EUR) replacing the hard-coded pesos; amounts are relabeled, not converted. Migration adds `currency` to users. Money on hand now loads alongside the month's figures (its count comes with the settings), instead of after them.

- Multi-currency: payment methods (one cash wallet per currency, cards), income, and savings funds have a currency; currency exchanges are a new entry (an Exchange tab on Add once there are wallets in two currencies). Currencies are never converted: headline figures are the main currency's, with other currencies noted beside them and every list amount in its own currency (distinct symbols like US$). Cash on hand is per wallet. Migration backfills existing records with the main currency and moves the counted cash to the Cash wallet, verified on an embedded Postgres; every figure on peso-only seeded data is unchanged, and a mixed peso/dollar scenario checked out by hand.

- New income sources from quick add (and the income edit form): a "+ New source" chip names one in place, with an optional group; an existing name (even archived) is reused instead of duplicated, and a first income no longer requires a trip to Settings.

- Days off left: a stat (offered in Customize with a daily income rhythm) for how many days can be taken off this month at the current pace and still reach the balance goal, with breaking even noted below. Gas and other deducted work costs count only on days worked; living costs count every day. The pace of work pools the same history as typical daily spending (from "Count history from", up to 3 full months back), so it doesn't restart each month; the month view now loads recent incomes for it. Stats can now show a number of days as well as amounts. Checked against October's real figures (3 days off for the goal, 6 to break even).

- Fix: saving a new amount in a form that keeps its default (balance goal, savings goal target, recurring and occurrence amounts) no longer shows the previous amount until a refresh. React resets the form in the same update that brings the saved amount back, before the input's reset listener knew it; resetting now goes back to whatever the latest default is.

- Customization step 4: recurring income and a projected month-end balance.
  - Recurring income (source, amount, currency, weekly / every 2 weeks / days of the month, defaulting to the income rhythm's schedule), managed on its own page. Migration creates `recurring_incomes` and links incomes to the payday they were received for, verified on an embedded Postgres (receiving a payday twice records it once; stopping keeps received income).
  - Month view: an Expected income section listing the month's paydays, received or expected; tapping an expected one marks it received with the amount that arrived, which records the income.
  - Stats: projected balance (balance + expected recurring income + the recent pace of other income − typical daily spending for the days left, with the goal compared below) and expected income, both added to the default month card. Expected recurring income also lowers needed per day and days off left.

- Client caching of visited tabs: screens are reused for 3 minutes, so switching back to a tab is instant; any change clears them.

- Settings split into a menu with a page for each part, so each loads only its own data: General, Money, and Planning, then Categories, Items, and Recurring payments under Spending, and Sources and groups and Recurring income under Income. Recurring payments and recurring income are separate pages under Settings (the month view's "Manage" links lead to each). Every row says what its page holds, every subpage has the same back-link header, and the header's Settings icon stays marked on subpages.

- Savings: the average spending breakdown by category moved off the page into a dialog opened from the "Average monthly spending" line of the emergency fund goal (a bottom sheet on phones, centered on larger screens).

- Explained stats: tapping any stat on the month or income card (ⓘ beside its label) opens a sheet with what it is and its live working from this month's figures (e.g. Income − To pay = Balance; what's still to cover ÷ days left + everyday spending per day = Needed per day), with notes on what goes in and why a stat shows "–". Every stat has a description, shown in the Customize editor too, whose "Add a stat" dropdown became a list with descriptions. Cash flow now returns its parts, days off its work days needed, and money on hand how it moved since its count. A test runs every stat's working and checks it comes to the value shown.

- Year view: calendar years (January through December, navigated by year) with a year card (balance and goal months, income, to pay, spending, saved, average and best month, each with its working) and a balance-by-month chart with the goal line, both counting the months that started from "Count history from" on. Upcoming months in the grid show what's already scheduled, muted, outside the "To date" total. The summary card's look is now a shared `StatsCard`, and stat workings can count months.

- Due payment reminders: Web Push notifications each morning for unpaid cash bills and card statements due in the next 3 days (overdue included), turned on per device in Settings > General with a test notification. Service worker, `push_subscriptions` migration (verified on an embedded Postgres), daily Vercel Cron route signed with `CRON_SECRET`. Needs VAPID keys and `CRON_SECRET` set in Vercel.

- Month view search: a search box above the entries (items, sources, categories, payment methods, notes; case and accents ignored) and tappable By category rows filter the month's entries on the device, with the number of matches and what they add up to (spent and received). Filtering focuses the view on the results (the rest of the month steps aside and category chips replace By category), and a month opened from a year view cell shows only that item, with its month total in the banner.

- Days off left shows tenths of a day ("1.9 days", rounded down), so it drifts smoothly instead of jumping a whole day at the boundary; the explanation's working uses the same tenths. Every average from past days (typical daily spending, living cost, income pace, net per day worked) now counts finished days only, through yesterday, so a day under way (gas in the morning, income at night) no longer skews them. Today counts as what's been recorded plus the rest of an average day (never twice), and a day with income is a day worked rather than a possible day off, so an average day reads the same at night, once logged, as the next morning.

- Daily income (and the net under it) counts finished days only, through yesterday, so it no longer dips every morning and compares fairly with needed per day and the projection. The app reloads its figures when it comes back to the foreground after a minute away or on a new day, so a screen left open overnight never shows yesterday's numbers as today's.

- Savings no longer count against the balance: moving money into savings (or out) changes only cash on hand, so the balance, to pay, needed per day, days off, the projection, and the year's figures read the same before and after a transfer, and the goal compares with the balance directly. A Savings stat (add it in Customize) shows what's in savings now, with the savings goal and what's left to save below, and its working fund by fund.

- Sign-in is open to any Google account (the `ALLOWED_EMAILS` allowlist is gone); each account's data stays its own.

- Encryption at rest, step 1: amounts, names and notes get encrypted copies beside the plaintext (migration `20261019000000_encrypted_fields`, purely additive), written on every save and read in place of the plaintext; each deploy encrypts what's still in plaintext before building, and refuses to go live without the key or with another key. Verified on a local Postgres with two seeded users: every month, year, savings, cash and stat figure, explanation and list is byte-identical to the previous code before encryption, after it, and with every plaintext value overwritten with garbage; 36 server actions keep every encrypted copy matching its value (378 checked); an older deployment's edit mid-deploy, another key, and no key all behave safely.

- Encryption at rest, step 2: amounts, names and notes are now stored only encrypted. The client reads the encrypted columns as the plain fields and writes through `seal`; items are found and kept unique by `name_index`; recurring history is selected by its encrypted amount. Migration `20261020000000_plaintext_cleared` empties every plaintext value that has its copy (dropping the step-1 triggers first) and adds a trigger that keeps plaintext out while the previous deployment still serves; each deploy encrypts before and after migrating. Rehearsed on a production-shaped database (step-1 data plus rows left without copies): every figure, explanation and list identical to step 1's, no plaintext left, the step-1 code still reading and writing safely mid-deploy, 36 server actions keeping every copy valid (369 copies, 22 item indexes), and another key or no key refused. The rehearsal caught a script that cleared plaintext while the step-1 trigger was active (which erased the copy too); the script now never touches plaintext.

- Forecast screen: cash on hand for the next 90 days as a line to drag across (each day's cash and what comes or goes), its low point, cash at each month's end, and what's coming up with the cash left after each day; card spending leaves cash when its statement is due. Checked against seeded data by hand (a card statement: charges on it plus typical card spending for its open days, to the cent).

- Forecast: the low point gave way to the cash in 30 days, since with income ahead of spending the lowest day is nearly always today.

- Navigation regrouped around the Month view, where nearly all time is spent: the bottom bar is Overview (Month and Year behind a toggle), Forecast, Add, Income, and Savings, with only Settings in the header; Cards are reached from the month's statements and from Settings.

- Forecast: a red "if you stopped working" line (no income, same spending and bills) with the day cash would run out, amounts down the left at round steps with faint gridlines, and a legend.
- Forecast: the "if you stopped working" line and runway gave way to red daily spending bars on the same scale (everyday spending, with bills and statements standing tall on their dates); income days keep their green mark under the chart.
- Month view: card-paid recurring bills no longer read Unpaid until their statement is paid. They show Paid once charged, Scheduled before, and To confirm while estimated.
- Custom stats: an "Average spending" stat added from the card editor with its settings (everyday spending, a category, or an item; per day, week, or month), showing the usual amount and the current period so far, with its working.
- Stats revamp: Spending, Income, and Average income join Average spending as stats built from settings (what they're about, gross or net, and over what time), with "Change settings" in place. Total income, Net, groups' gross and net, and the daily averages were folded into them, saved cards migrating to the same figures; the income card's daily averages now look back over the history window. Checked against seeded data: saving, changing settings in place, and old cards reading the same.
- Overview: the Month / Year switch moved into the title between the period arrows, as a small menu, freeing the row it took above them.
- Onboarding, part A: a setup wizard new accounts open on (income for salaries, varying income or both; money on hand; cards; fixed bills), saved all at once; an owner-only preview that saves nothing; and a setup checklist on the month view. Checked against seeded data: a new account's full save, bad answers saving nothing, a repeated save creating nothing more, and existing accounts marked as set up.
- Onboarding, part B: starting estimates (everyday spending per category, varying income) from the wizard, blended into typical spending and the income pace while there's under a month of records and fading out; shown as such in explanations; "you estimated X, on pace for Y" for a new account's first weeks; editable in Planning. New accounts count history from their setup day. Checked against seeded data: a new account's blended figures and forecast, an estimate on a non-everyday category refused, and editing estimates.
- Onboarding: categories are picked in the wizard (suggestions or their own, each with its optional estimate) instead of every account getting Food and Car; accounts start with only Fixed and Extras. Checked against seeded data: picked categories in order with their estimates, and Food when skipped.
- Language before sign-in: a language switch on the sign-in screen and the phone's language as the default; the wizard's first screen is only the main currency (pesos for Spanish, dollars for English).
- Privacy notice and terms of use (plain-language, bilingual, linked from sign-in and Settings) and self-serve account deletion. Checked against seeded data: deleting a full account leaves no record in any table, and a wrong confirmation word deletes nothing.

## Next

- Forecast: planned one-off expenses (like tires) shown on the line before they're spent.
- Custom stats, next: a limit on an average stat ("$180 of $300 this week", the limit stored encrypted), and possibly how many times something was bought.
- Encryption at rest, step 3 (tidy-up, after step 2 is live): drop the emptied plaintext columns and the `*_clear_plaintext` triggers, and make the required copies NOT NULL.

- Rename the stat labels new users find ambiguous (Spending / To pay / Outstanding, Daily income vs. Daily avg. gross), keeping the explanations in step.
- Flag figures based on too little history (typical daily spending and the income pace on a new account), in the stat's note or its explanation.
