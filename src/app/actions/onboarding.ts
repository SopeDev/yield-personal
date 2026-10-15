"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { seal, sealItemName } from "@/db/encryption";
import { isLocale, LOCALE_COOKIE, type Locale } from "@/i18n/config";
import { dateFromKey } from "@/lib/months";
import { planOnboarding, type OnboardingAnswers, type OnboardingPlan } from "@/lib/onboarding";
import { recurringIncomeStart } from "@/lib/recurring-income";
import { currentMonthKey, todayKey } from "@/lib/today";
import { localeFromForm, requireActionUserId } from "./action-user";

const LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/**
 * Saves the setup wizard's answers all at once (or nothing, when one doesn't check out), marks the account as set up,
 * and opens the month. History counts from this month, so the empty months before the account don't pull averages
 * down. Only an account not yet set up can be: a second submission changes nothing.
 */
export async function completeOnboarding(answers: OnboardingAnswers, locale: Locale): Promise<{ error: string } | undefined> {
  const userId = await requireActionUserId();
  if (!isLocale(locale)) return { error: "generic" };
  const result = planOnboarding(answers);
  if ("error" in result) return { error: result.error };
  const { plan } = result;
  const today = todayKey();

  const saved = await save(userId, plan, today);

  if (saved) (await cookies()).set(LOCALE_COOKIE, locale, { maxAge: LOCALE_COOKIE_MAX_AGE_SECONDS, sameSite: "lax", path: "/" });
  revalidatePath(`/${locale}`, "layout");
  redirect(`/${locale}/month`);
}

/** Everything the plan sets up, in one transaction; false when the account was already set up. */
function save(userId: string, plan: OnboardingPlan, today: string) {
  return db.$transaction(async (tx) => {
    const { count } = await tx.user.updateMany({
      where: { id: userId, onboardedAt: null },
      data: {
        onboardedAt: new Date(),
        currency: plan.currency,
        historyStartMonth: dateFromKey(`${currentMonthKey()}-01`),
        // Figures from past records count from today, not the empty days before it this month.
        trackingFrom: dateFromKey(today),
        ...seal("User", { incomeEstimateCents: plan.incomeEstimateCents }),
        incomeRhythm: plan.rhythm.kind,
        incomeRhythmAnchor: plan.rhythm.kind === "WEEKLY" || plan.rhythm.kind === "BIWEEKLY" ? dateFromKey(plan.rhythm.anchor) : null,
        incomePayDays: plan.rhythm.kind === "MONTH_DAYS" ? plan.rhythm.days : [],
      },
    });
    if (count === 0) return false;

    // The account's first wallet holds money in the main currency; nothing is recorded in it yet.
    const wallet = await tx.paymentMethod.findFirst({ where: { userId, kind: "CASH" }, orderBy: { createdAt: "asc" }, select: { id: true } });
    if (!wallet) throw new Error("No cash wallet");
    await tx.paymentMethod.update({
      where: { id: wallet.id },
      data: { currency: plan.currency, ...(plan.cashCents === null ? {} : { ...seal("PaymentMethod", { cashCountCents: plan.cashCents }), cashCountedAt: new Date() }) },
    });

    const cardIds: string[] = [];
    for (const card of plan.cards) {
      const created = await tx.paymentMethod.create({
        data: { userId, kind: "CARD", currency: plan.currency, ...seal("PaymentMethod", { name: card.name }), color: card.color, closingDay: card.closingDay, paymentDays: card.paymentDays },
        select: { id: true },
      });
      cardIds.push(created.id);
    }

    if (plan.bills.length > 0) {
      const fixed = await tx.category.findFirst({ where: { userId, key: "fixed" }, select: { id: true } })
        ?? await tx.category.findFirst({ where: { userId, kind: "BILLS", archivedAt: null }, orderBy: { sortOrder: "asc" }, select: { id: true } });
      if (!fixed) throw new Error("No bills category");
      for (const bill of plan.bills) {
        const stored = sealItemName(userId, bill.name);
        const item = await tx.expenseItem.upsert({
          where: { userId_nameIndex: { userId, nameIndex: stored.nameIndex } },
          create: { userId, categoryId: fixed.id, ...stored },
          update: {},
          select: { id: true },
        });
        await tx.recurringPayment.create({
          data: {
            userId,
            itemId: item.id,
            ...seal("RecurringPayment", { amountCents: bill.amountCents }),
            paymentMethodId: bill.card === null ? wallet.id : cardIds[bill.card],
            dayOfMonth: bill.dayOfMonth,
            intervalMonths: 1,
            isVariable: bill.isVariable,
            startMonth: dateFromKey(`${currentMonthKey()}-01`),
          },
        });
      }
    }

    // The everyday categories picked come first, each with its estimate, then the account's bills and extras.
    const existing = await tx.category.findMany({ where: { userId }, select: { id: true, key: true, kind: true } });
    for (const [sortOrder, category] of plan.categories.entries()) {
      const data = { sortOrder, archivedAt: null, ...seal("Category", { monthlyEstimateCents: category.monthlyEstimateCents }) };
      const builtIn = category.key && existing.find((other) => other.key === category.key);
      if (builtIn) await tx.category.update({ where: { id: builtIn.id }, data });
      else if (category.key) await tx.category.create({ data: { userId, key: category.key, kind: "EVERYDAY", ...data } });
      else await tx.category.create({ data: { userId, kind: "EVERYDAY", ...seal("Category", { name: category.name! }), ...data } });
    }
    const picked = new Set<string>(plan.categories.flatMap((category) => (category.key ? [category.key] : [])));
    for (const category of existing) {
      if (category.key === "fixed") await tx.category.update({ where: { id: category.id }, data: { sortOrder: plan.categories.length } });
      else if (category.key === "extras") await tx.category.update({ where: { id: category.id }, data: { sortOrder: plan.categories.length + 1 } });
      // An everyday category made before the wizard but not picked (from older defaults) is put away.
      else if (category.kind === "EVERYDAY" && !(category.key && picked.has(category.key))) await tx.category.update({ where: { id: category.id }, data: { archivedAt: new Date() } });
    }

    if (plan.salary) {
      const { rhythm } = plan.salary;
      const source = await tx.incomeSource.create({ data: { userId, ...seal("IncomeSource", { name: plan.salary.name }) }, select: { id: true } });
      await tx.recurringIncome.create({
        data: {
          userId,
          sourceId: source.id,
          ...seal("RecurringIncome", { amountCents: plan.salary.amountCents }),
          currency: plan.currency,
          rhythm: rhythm.kind,
          anchor: rhythm.kind === "MONTH_DAYS" ? null : dateFromKey(rhythm.anchor),
          payDays: rhythm.kind === "MONTH_DAYS" ? rhythm.days : [],
          startsOn: dateFromKey(recurringIncomeStart(rhythm, today)),
        },
      });
    }
    return true;
  });
}

/** Hides the setup checklist on the month view for good. */
export async function dismissSetup(formData: FormData) {
  const userId = await requireActionUserId();
  await db.user.update({ where: { id: userId }, data: { setupDismissedAt: new Date() } });
  revalidatePath(`/${localeFromForm(formData)}`, "layout");
}
