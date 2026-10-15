import "server-only";

import { db } from "@/db/client";
import { seal } from "@/db/encryption";
import { BUILT_IN_CATEGORY_KINDS, type BuiltInCategoryKey } from "@/lib/categories";
import { CASH_COLOR, DEFAULT_CASH_NAME } from "@/lib/payment-methods";

const ACCOUNT_CATEGORY_KEYS: BuiltInCategoryKey[] = ["fixed", "extras"];

/**
 * Every user starts with a Cash payment method, the categories every account needs (fixed bills and one-off extras),
 * and an emergency fund. The everyday categories come from the setup wizard, which knows what the person spends on.
 */
export async function createUserDefaults(userId: string) {
  await db.$transaction([
    db.paymentMethod.create({ data: { userId, kind: "CASH", ...seal("PaymentMethod", { name: DEFAULT_CASH_NAME }), color: CASH_COLOR } }),
    db.category.createMany({
      data: ACCOUNT_CATEGORY_KEYS.map((key, sortOrder) => ({ userId, key, sortOrder, kind: BUILT_IN_CATEGORY_KINDS[key] })),
      skipDuplicates: true,
    }),
    db.savingsFund.create({ data: { userId, kind: "EMERGENCY" } }),
  ]);
}
