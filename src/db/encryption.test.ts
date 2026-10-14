import assert from "node:assert/strict";
import { test } from "node:test";
import { decryptInt, decryptText, nameIndex } from "@/lib/field-crypto";
import { seal, sealItemName } from "./encryption";

process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString("base64");

test("seal writes each plain value to its encrypted column, keeping null and leaving out what isn't set", () => {
  const sealed = seal("Purchase", { amountCents: 44000, note: null });
  assert.deepEqual(Object.keys(sealed).sort(), ["amountEnc", "noteEnc"]);
  assert.equal(decryptInt(sealed.amountEnc, "purchases.amount_cents"), 44000);
  assert.equal(sealed.noteEnc, null);
  assert.deepEqual(Object.keys(seal("SavingsFund", { name: "Viaje", targetCents: undefined })), ["nameEnc"]);
  assert.equal(decryptText(seal("CurrencyExchange", { note: "aeropuerto" }).noteEnc, "currency_exchanges.note"), "aeropuerto");
  // A field that isn't encrypted, or a value of the wrong kind, is refused rather than stored.
  assert.throws(() => seal("Purchase", { installmentCount: 3 } as never));
  assert.throws(() => seal("Purchase", { amountCents: "44000" } as never));
});

test("an item's name is stored encrypted, with the index that finds it by its normalized name", () => {
  const stored = sealItemName("user-a", "  Gasolina  Premium ");
  assert.equal(decryptText(stored.nameEnc, "expense_items.name"), "  Gasolina  Premium ");
  assert.equal(stored.nameIndex, nameIndex("user-a", "gasolina premium"));
  assert.equal(sealItemName("user-a", "gasolina premium").nameIndex, stored.nameIndex);
  assert.notEqual(sealItemName("user-b", "gasolina premium").nameIndex, stored.nameIndex);
});
