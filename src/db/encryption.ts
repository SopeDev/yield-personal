import type { PrismaClient } from "@/generated/prisma/client";
import { decryptInt, decryptText, encryptInt, encryptText, keyCheckValue, nameIndex } from "@/lib/field-crypto";

/**
 * Which fields are encrypted at rest, each with the column holding its encrypted copy. Writes fill the copy
 * alongside the plaintext; reads return the decrypted copy in the field's place, or the plaintext for a row not
 * encrypted yet. Once every row has its copy, the plaintext columns are dropped and only the copies remain.
 *
 * The context binds each value to its column (`table.column`, the plaintext column's name), so it never changes.
 */
export const ENCRYPTED_FIELDS = {
  User: { balanceGoalCents: { copy: "balanceGoalEnc", kind: "int", context: "users.balance_goal_cents" } },
  PaymentMethod: {
    name: { copy: "nameEnc", kind: "text", context: "payment_methods.name" },
    cashCountCents: { copy: "cashCountEnc", kind: "int", context: "payment_methods.cash_count_cents" },
  },
  Category: { name: { copy: "nameEnc", kind: "text", context: "categories.name" } },
  Purchase: {
    amountCents: { copy: "amountEnc", kind: "int", context: "purchases.amount_cents" },
    note: { copy: "noteEnc", kind: "text", context: "purchases.note" },
  },
  ExpenseItem: { name: { copy: "nameEnc", kind: "text", context: "expense_items.name" } },
  IncomeSource: { name: { copy: "nameEnc", kind: "text", context: "income_sources.name" } },
  IncomeGroup: { name: { copy: "nameEnc", kind: "text", context: "income_groups.name" } },
  Income: {
    amountCents: { copy: "amountEnc", kind: "int", context: "incomes.amount_cents" },
    note: { copy: "noteEnc", kind: "text", context: "incomes.note" },
  },
  RecurringIncome: { amountCents: { copy: "amountEnc", kind: "int", context: "recurring_incomes.amount_cents" } },
  RecurringPayment: { amountCents: { copy: "amountEnc", kind: "int", context: "recurring_payments.amount_cents" } },
  RecurringOccurrence: { amountCents: { copy: "amountEnc", kind: "int", context: "recurring_occurrences.amount_cents" } },
  SavingsFund: {
    name: { copy: "nameEnc", kind: "text", context: "savings_funds.name" },
    targetCents: { copy: "targetEnc", kind: "int", context: "savings_funds.target_cents" },
  },
  SavingsMovement: {
    amountCents: { copy: "amountEnc", kind: "int", context: "savings_movements.amount_cents" },
    note: { copy: "noteEnc", kind: "text", context: "savings_movements.note" },
  },
  CurrencyExchange: {
    fromCents: { copy: "fromEnc", kind: "int", context: "currency_exchanges.from_cents" },
    toCents: { copy: "toEnc", kind: "int", context: "currency_exchanges.to_cents" },
    note: { copy: "noteEnc", kind: "text", context: "currency_exchanges.note" },
  },
} as const satisfies Record<string, Record<string, { copy: string; kind: "int" | "text"; context: string }>>;

type EncryptedModel = keyof typeof ENCRYPTED_FIELDS;
type FieldSpec = { copy: string; kind: "int" | "text"; context: string };

/** The id of the key check row: one key per database. */
export const KEY_CHECK_ID = "data";

/** The encrypted copy of a plain value, or null for null. */
export function encryptField(spec: FieldSpec, value: unknown) {
  if (value === null) return null;
  if (spec.kind === "int" && typeof value === "number") return encryptInt(value, spec.context);
  if (spec.kind === "text" && typeof value === "string") return encryptText(value, spec.context);
  // Only plain values are written to these fields; an operation like { increment } can't be mirrored encrypted.
  throw new Error(`Unsupported write to encrypted field ${spec.context}`);
}

/**
 * Makes sure the configured key is the one this database's data is encrypted with, recording it on first use.
 * Checked once per server before the first write it encrypts; an environment with another key refuses to write.
 */
export async function verifyKey(base: PrismaClient) {
  const check = keyCheckValue();
  const stored = await base.encryptionKeyCheck.findUnique({ where: { id: KEY_CHECK_ID } })
    ?? await base.encryptionKeyCheck.create({ data: { id: KEY_CHECK_ID, check } }).catch(() => base.encryptionKeyCheck.findUnique({ where: { id: KEY_CHECK_ID } }));
  if (stored?.check !== check) {
    throw new Error("DATA_ENCRYPTION_KEY is not the key this database's data is encrypted with; refusing to write with it.");
  }
}

/** Plain value for a field: its decrypted copy when there is one, else the plaintext of a row not encrypted yet. */
function readInt<T extends number | null>(copy: string | null, plain: T, context: string): T {
  return (copy === null ? plain : decryptInt(copy, context)) as T;
}
function readText<T extends string | null>(copy: string | null, plain: T, context: string): T {
  return (copy === null ? plain : decryptText(copy, context)) as T;
}

const WRITE_OPERATIONS = new Set(["create", "createMany", "createManyAndReturn", "update", "updateMany", "updateManyAndReturn", "upsert"]);

type Data = Record<string, unknown>;

/**
 * The encrypting client: reads return plain values in the encrypted fields' place, and writes add the encrypted
 * copy of every encrypted field they set (and an item's name index, which needs its user).
 */
export function withEncryption(base: PrismaClient) {
  let keyVerified: Promise<void> | null = null;
  const ensureKey = () => {
    keyVerified ??= verifyKey(base).catch((error) => {
      keyVerified = null;
      throw error;
    });
    return keyVerified;
  };

  async function encryptData(model: EncryptedModel, data: Data, userIdFor: () => Promise<string>) {
    const fields: Record<string, FieldSpec> = ENCRYPTED_FIELDS[model];
    const written = Object.keys(fields).filter((field) => data[field] !== undefined);
    const indexes = model === "ExpenseItem" && data.normalizedName !== undefined;
    if (written.length === 0 && !indexes) return data;
    await ensureKey();
    const copies: Data = {};
    for (const field of written) copies[fields[field].copy] = encryptField(fields[field], data[field]);
    if (indexes) {
      if (typeof data.normalizedName !== "string") throw new Error("Unsupported write to expense_items.normalized_name");
      copies.nameIndex = nameIndex(await userIdFor(), data.normalizedName);
    }
    return { ...data, ...copies };
  }

  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!(model in ENCRYPTED_FIELDS) || !WRITE_OPERATIONS.has(operation)) return query(args);
          const encrypted = model as EncryptedModel;
          const write = args as { data?: Data | Data[]; create?: Data; update?: Data; where?: Data };
          // An item's name index needs its user: given when creating, looked up when renaming one.
          const userIdOf = (data: Data | undefined) => async () => {
            if (typeof data?.userId === "string") return data.userId;
            if (typeof write.where?.userId === "string") return write.where.userId;
            if (operation !== "update") throw new Error("An item's name can only change one item at a time");
            const item = await base.expenseItem.findUnique({ where: write.where as { id: string }, select: { userId: true } });
            if (!item) throw new Error("Item not found");
            return item.userId;
          };
          if (Array.isArray(write.data)) {
            write.data = await Promise.all(write.data.map((data) => encryptData(encrypted, data, userIdOf(data))));
          } else if (write.data) {
            write.data = await encryptData(encrypted, write.data, userIdOf(write.data));
          }
          if (write.create) write.create = await encryptData(encrypted, write.create, userIdOf(write.create));
          if (write.update) write.update = await encryptData(encrypted, write.update, userIdOf(write.update));
          return query(args);
        },
      },
    },
    result: {
      user: {
        balanceGoalCents: { needs: { balanceGoalCents: true, balanceGoalEnc: true }, compute: (row) => readInt(row.balanceGoalEnc, row.balanceGoalCents, ENCRYPTED_FIELDS.User.balanceGoalCents.context) },
      },
      paymentMethod: {
        name: { needs: { name: true, nameEnc: true }, compute: (row) => readText(row.nameEnc, row.name, ENCRYPTED_FIELDS.PaymentMethod.name.context) },
        cashCountCents: { needs: { cashCountCents: true, cashCountEnc: true }, compute: (row) => readInt(row.cashCountEnc, row.cashCountCents, ENCRYPTED_FIELDS.PaymentMethod.cashCountCents.context) },
      },
      category: {
        name: { needs: { name: true, nameEnc: true }, compute: (row) => readText(row.nameEnc, row.name, ENCRYPTED_FIELDS.Category.name.context) },
      },
      purchase: {
        amountCents: { needs: { amountCents: true, amountEnc: true }, compute: (row) => readInt(row.amountEnc, row.amountCents, ENCRYPTED_FIELDS.Purchase.amountCents.context) },
        note: { needs: { note: true, noteEnc: true }, compute: (row) => readText(row.noteEnc, row.note, ENCRYPTED_FIELDS.Purchase.note.context) },
      },
      expenseItem: {
        name: { needs: { name: true, nameEnc: true }, compute: (row) => readText(row.nameEnc, row.name, ENCRYPTED_FIELDS.ExpenseItem.name.context) },
      },
      incomeSource: {
        name: { needs: { name: true, nameEnc: true }, compute: (row) => readText(row.nameEnc, row.name, ENCRYPTED_FIELDS.IncomeSource.name.context) },
      },
      incomeGroup: {
        name: { needs: { name: true, nameEnc: true }, compute: (row) => readText(row.nameEnc, row.name, ENCRYPTED_FIELDS.IncomeGroup.name.context) },
      },
      income: {
        amountCents: { needs: { amountCents: true, amountEnc: true }, compute: (row) => readInt(row.amountEnc, row.amountCents, ENCRYPTED_FIELDS.Income.amountCents.context) },
        note: { needs: { note: true, noteEnc: true }, compute: (row) => readText(row.noteEnc, row.note, ENCRYPTED_FIELDS.Income.note.context) },
      },
      recurringIncome: {
        amountCents: { needs: { amountCents: true, amountEnc: true }, compute: (row) => readInt(row.amountEnc, row.amountCents, ENCRYPTED_FIELDS.RecurringIncome.amountCents.context) },
      },
      recurringPayment: {
        amountCents: { needs: { amountCents: true, amountEnc: true }, compute: (row) => readInt(row.amountEnc, row.amountCents, ENCRYPTED_FIELDS.RecurringPayment.amountCents.context) },
      },
      recurringOccurrence: {
        amountCents: { needs: { amountCents: true, amountEnc: true }, compute: (row) => readInt(row.amountEnc, row.amountCents, ENCRYPTED_FIELDS.RecurringOccurrence.amountCents.context) },
      },
      savingsFund: {
        name: { needs: { name: true, nameEnc: true }, compute: (row) => readText(row.nameEnc, row.name, ENCRYPTED_FIELDS.SavingsFund.name.context) },
        targetCents: { needs: { targetCents: true, targetEnc: true }, compute: (row) => readInt(row.targetEnc, row.targetCents, ENCRYPTED_FIELDS.SavingsFund.targetCents.context) },
      },
      savingsMovement: {
        amountCents: { needs: { amountCents: true, amountEnc: true }, compute: (row) => readInt(row.amountEnc, row.amountCents, ENCRYPTED_FIELDS.SavingsMovement.amountCents.context) },
        note: { needs: { note: true, noteEnc: true }, compute: (row) => readText(row.noteEnc, row.note, ENCRYPTED_FIELDS.SavingsMovement.note.context) },
      },
      currencyExchange: {
        fromCents: { needs: { fromCents: true, fromEnc: true }, compute: (row) => readInt(row.fromEnc, row.fromCents, ENCRYPTED_FIELDS.CurrencyExchange.fromCents.context) },
        toCents: { needs: { toCents: true, toEnc: true }, compute: (row) => readInt(row.toEnc, row.toCents, ENCRYPTED_FIELDS.CurrencyExchange.toCents.context) },
        note: { needs: { note: true, noteEnc: true }, compute: (row) => readText(row.noteEnc, row.note, ENCRYPTED_FIELDS.CurrencyExchange.note.context) },
      },
    },
  });
}

export type EncryptedClient = ReturnType<typeof withEncryption>;
/** The client inside an interactive transaction, which encrypts and decrypts the same way. */
export type EncryptedTransaction = Parameters<Parameters<EncryptedClient["$transaction"]>[0]>[0];
