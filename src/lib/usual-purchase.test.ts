import assert from "node:assert/strict";
import { test } from "node:test";
import { usualPurchases } from "./usual-purchase";

test("an item's usual purchase is its most frequent method and amount among recent purchases", () => {
  const usual = usualPurchases([
    { itemId: "cafe", paymentMethodId: "nu", amountCents: 6500 },
    { itemId: "cafe", paymentMethodId: "cash", amountCents: 5500 },
    { itemId: "gas", paymentMethodId: "klar", amountCents: 50000 },
    { itemId: "cafe", paymentMethodId: "cash", amountCents: 5500 },
  ]);
  assert.deepEqual(usual.cafe, { paymentMethodId: "cash", amountCents: 5500 });
  assert.deepEqual(usual.gas, { paymentMethodId: "klar", amountCents: 50000 });
});

test("without a repeated value, the latest purchase wins", () => {
  const usual = usualPurchases([
    { itemId: "gas", paymentMethodId: "nu", amountCents: 70000 },
    { itemId: "gas", paymentMethodId: "cash", amountCents: 60000 },
  ]);
  assert.deepEqual(usual.gas, { paymentMethodId: "nu", amountCents: 70000 });
});

test("only the latest five purchases count", () => {
  const recent = Array.from({ length: 5 }, (_, index) => ({ itemId: "cafe", paymentMethodId: "nu", amountCents: 6000 + index }));
  const older = Array.from({ length: 3 }, () => ({ itemId: "cafe", paymentMethodId: "cash", amountCents: 5000 }));
  assert.deepEqual(usualPurchases([...recent, ...older]).cafe, { paymentMethodId: "nu", amountCents: 6000 });
});
