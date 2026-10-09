import "server-only";

import { db } from "@/db/client";
import { BUILT_IN_CATEGORY_KEYS, BUILT_IN_CATEGORY_KINDS } from "@/lib/categories";
import { CASH_COLOR, DEFAULT_CASH_NAME } from "@/lib/payment-methods";

/** Every user starts with a Cash payment method, the built-in categories, and an emergency fund. */
export async function createUserDefaults(userId: string) {
  await db.$transaction([
    db.paymentMethod.create({ data: { userId, kind: "CASH", name: DEFAULT_CASH_NAME, color: CASH_COLOR } }),
    db.category.createMany({
      data: BUILT_IN_CATEGORY_KEYS.map((key, sortOrder) => ({ userId, key, sortOrder, kind: BUILT_IN_CATEGORY_KINDS[key] })),
      skipDuplicates: true,
    }),
    db.savingsFund.create({ data: { userId, kind: "EMERGENCY" } }),
  ]);
}
