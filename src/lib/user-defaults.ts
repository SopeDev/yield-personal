import "server-only";

import { db } from "@/db/client";
import { BUILT_IN_CATEGORY_KEYS, EXCLUDED_FROM_AVERAGE_KEYS } from "@/lib/categories";
import { CASH_COLOR } from "@/lib/payment-methods";

/** Every user starts with a Cash payment method, the built-in categories, and an emergency fund. */
export async function createUserDefaults(userId: string) {
  await db.$transaction([
    db.paymentMethod.create({ data: { userId, kind: "CASH", name: "Cash", color: CASH_COLOR } }),
    db.category.createMany({
      data: BUILT_IN_CATEGORY_KEYS.map((key, sortOrder) => ({ userId, key, sortOrder, includeInAverage: !EXCLUDED_FROM_AVERAGE_KEYS.includes(key) })),
      skipDuplicates: true,
    }),
    db.savingsFund.create({ data: { userId, kind: "EMERGENCY" } }),
  ]);
}
