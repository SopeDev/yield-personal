import assert from "node:assert/strict";
import { test } from "node:test";
import { decryptInt, decryptText, encryptInt, encryptText, keyCheckValue, nameIndex } from "./field-crypto";

process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64");

test("values round-trip, each encrypted differently, and never show in what's stored", () => {
  const first = encryptInt(1190000, "purchases.amount_cents");
  const second = encryptInt(1190000, "purchases.amount_cents");
  assert.notEqual(first, second);
  assert.match(first, /^v1\.[\w-]+$/);
  assert.equal(decryptInt(first, "purchases.amount_cents"), 1190000);
  assert.equal(decryptInt(encryptInt(-20000, "savings_movements.amount_cents"), "savings_movements.amount_cents"), -20000);
  const note = encryptText("Colegiatura Leo · café", "purchases.note");
  assert.ok(!note.includes("Colegiatura"));
  assert.equal(decryptText(note, "purchases.note"), "Colegiatura Leo · café");
  assert.equal(decryptText(encryptText("", "purchases.note"), "purchases.note"), "");
});

test("a value only decrypts in its own column, untouched, and with its own key", () => {
  const amount = encryptInt(44000, "purchases.amount_cents");
  assert.throws(() => decryptInt(amount, "incomes.amount_cents"));
  const tampered = amount.slice(0, -2) + (amount.endsWith("A") ? "BB" : "AA");
  assert.throws(() => decryptInt(tampered, "purchases.amount_cents"));
  assert.throws(() => decryptText("44000", "purchases.amount_cents"));
  assert.throws(() => decryptInt(encryptText("44.5", "purchases.amount_cents"), "purchases.amount_cents"));
  assert.throws(() => encryptInt(1.5, "purchases.amount_cents"));

  const check = keyCheckValue();
  process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 2).toString("base64");
  try {
    assert.throws(() => decryptInt(amount, "purchases.amount_cents"));
    assert.notEqual(keyCheckValue(), check);
  } finally {
    process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64");
  }
  assert.equal(keyCheckValue(), check);
});

test("an item's name index is the same for the same name and user only", () => {
  assert.equal(nameIndex("user-a", "renta"), nameIndex("user-a", "renta"));
  assert.notEqual(nameIndex("user-a", "renta"), nameIndex("user-b", "renta"));
  assert.notEqual(nameIndex("user-a", "renta"), nameIndex("user-a", "rentas"));
  assert.ok(!nameIndex("user-a", "renta").includes("renta"));
});

test("a missing or malformed key is refused", () => {
  const key = process.env.DATA_ENCRYPTION_KEY;
  try {
    delete process.env.DATA_ENCRYPTION_KEY;
    assert.throws(() => encryptText("x", "purchases.note"), /not configured/);
    process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(16).toString("base64");
    assert.throws(() => encryptText("x", "purchases.note"), /32 bytes/);
  } finally {
    process.env.DATA_ENCRYPTION_KEY = key;
  }
});
