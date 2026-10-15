"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import type { Prisma } from "@/generated/prisma/client";
import { buildStatRef, isStatRef, isSummaryCardId, MAX_GRID_STATS, parseSummaryCards, type StatBuilder, type SummaryCardId, type SummaryCards } from "@/lib/stats";
import { localeFromForm, requireActionUserId } from "./action-user";

async function updateCards(userId: string, change: (cards: SummaryCards) => void) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { summaryCards: true } });
  const cards = parseSummaryCards(user?.summaryCards);
  change(cards);
  await db.user.update({ where: { id: userId }, data: { summaryCards: cards as Prisma.InputJsonValue } });
}

function readCard(formData: FormData): SummaryCardId | null {
  const card = String(formData.get("card") ?? "");
  return isSummaryCardId(card) ? card : null;
}

/**
 * Saves a card's whole layout: its headline and its grid stats in order (`stat`, repeated), plus `add` appended to
 * the end. A configurable stat comes as its settings (`builder` and its fields): it's appended, or with `replace`
 * takes that stat's place. The editor posts the layout each button leads to, so moving and removing need no other
 * action.
 */
export async function saveSummaryCard(formData: FormData) {
  const userId = await requireActionUserId();
  const card = readCard(formData);
  const headline = String(formData.get("headline") ?? "");
  const field = (name: string) => (formData.get(name) === null ? undefined : String(formData.get(name)));
  const built = formData.get("builder") === null ? null : buildStatRef({
    builder: field("builder") as StatBuilder, scope: field("scope"), period: field("period"), source: field("source"), basis: field("basis"), frame: field("frame"), per: field("per"),
  });
  if (formData.get("builder") !== null && !built) return;
  const replaced = field("replace");
  const stats = formData.getAll("stat").map(String);
  const added = field("add");
  const grid = built && replaced && stats.includes(replaced) ? stats.map((ref) => (ref === replaced ? built : ref))
    : [...stats, ...(built ? [built] : added ? [added] : [])];
  if (!card || !isStatRef(headline) || grid.length > MAX_GRID_STATS || !grid.every(isStatRef)) return;
  // A stat appears once per card.
  const unique = [...new Set(grid)].filter(isStatRef);

  await updateCards(userId, (cards) => {
    cards[card] = { headline, grid: unique };
  });
  revalidatePath(`/${localeFromForm(formData)}`, "layout");
}

/** Returns a card to its default layout. */
export async function resetSummaryCard(formData: FormData) {
  const userId = await requireActionUserId();
  const card = readCard(formData);
  if (!card) return;
  await updateCards(userId, (cards) => {
    delete cards[card];
  });
  revalidatePath(`/${localeFromForm(formData)}`, "layout");
}
