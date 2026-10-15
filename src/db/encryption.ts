import type { PrismaClient } from "@/generated/prisma/client";
import { decryptInt, decryptText, encryptInt, encryptText, keyCheckValue, nameIndex } from "@/lib/field-crypto";
import { normalizeItemName } from "@/lib/items";

/**
 * Which fields are encrypted at rest. Each plain field (what the app reads and writes, like `amountCents`) is stored
 * only encrypted, in its copy column (`amountEnc`); `column` is the copy's column and `context` (`table.column`, the
 * name of the plaintext column it replaced) binds each value to it, so it never changes. `optional` fields may be null.
 */
export const ENCRYPTED_FIELDS = {
  User: {
    balanceGoalCents: { copy: "balanceGoalEnc", column: "balance_goal_enc", kind: "int", optional: true, context: "users.balance_goal_cents" },
    incomeEstimateCents: { copy: "incomeEstimateEnc", column: "income_estimate_enc", kind: "int", optional: true, context: "users.income_estimate_cents" },
  },
  PaymentMethod: {
    name: { copy: "nameEnc", column: "name_enc", kind: "text", optional: false, context: "payment_methods.name" },
    cashCountCents: { copy: "cashCountEnc", column: "cash_count_enc", kind: "int", optional: true, context: "payment_methods.cash_count_cents" },
  },
  Category: {
    name: { copy: "nameEnc", column: "name_enc", kind: "text", optional: true, context: "categories.name" },
    monthlyEstimateCents: { copy: "monthlyEstimateEnc", column: "monthly_estimate_enc", kind: "int", optional: true, context: "categories.monthly_estimate_cents" },
  },
  Purchase: {
    amountCents: { copy: "amountEnc", column: "amount_enc", kind: "int", optional: false, context: "purchases.amount_cents" },
    note: { copy: "noteEnc", column: "note_enc", kind: "text", optional: true, context: "purchases.note" },
  },
  ExpenseItem: { name: { copy: "nameEnc", column: "name_enc", kind: "text", optional: false, context: "expense_items.name" } },
  IncomeSource: { name: { copy: "nameEnc", column: "name_enc", kind: "text", optional: false, context: "income_sources.name" } },
  IncomeGroup: { name: { copy: "nameEnc", column: "name_enc", kind: "text", optional: false, context: "income_groups.name" } },
  Income: {
    amountCents: { copy: "amountEnc", column: "amount_enc", kind: "int", optional: false, context: "incomes.amount_cents" },
    note: { copy: "noteEnc", column: "note_enc", kind: "text", optional: true, context: "incomes.note" },
  },
  RecurringIncome: { amountCents: { copy: "amountEnc", column: "amount_enc", kind: "int", optional: false, context: "recurring_incomes.amount_cents" } },
  RecurringPayment: { amountCents: { copy: "amountEnc", column: "amount_enc", kind: "int", optional: false, context: "recurring_payments.amount_cents" } },
  RecurringOccurrence: { amountCents: { copy: "amountEnc", column: "amount_enc", kind: "int", optional: true, context: "recurring_occurrences.amount_cents" } },
  SavingsFund: {
    name: { copy: "nameEnc", column: "name_enc", kind: "text", optional: true, context: "savings_funds.name" },
    targetCents: { copy: "targetEnc", column: "target_enc", kind: "int", optional: true, context: "savings_funds.target_cents" },
    depositCents: { copy: "depositEnc", column: "deposit_enc", kind: "int", optional: true, context: "savings_funds.deposit_cents" },
  },
  SavingsMovement: {
    amountCents: { copy: "amountEnc", column: "amount_enc", kind: "int", optional: false, context: "savings_movements.amount_cents" },
    note: { copy: "noteEnc", column: "note_enc", kind: "text", optional: true, context: "savings_movements.note" },
  },
  CurrencyExchange: {
    fromCents: { copy: "fromEnc", column: "from_enc", kind: "int", optional: false, context: "currency_exchanges.from_cents" },
    toCents: { copy: "toEnc", column: "to_enc", kind: "int", optional: false, context: "currency_exchanges.to_cents" },
    note: { copy: "noteEnc", column: "note_enc", kind: "text", optional: true, context: "currency_exchanges.note" },
  },
} as const satisfies Record<string, Record<string, FieldSpec>>;

type FieldSpec = { copy: string; column: string; kind: "int" | "text"; optional: boolean; context: string };
type Fields = typeof ENCRYPTED_FIELDS;
export type EncryptedModel = keyof Fields;

/** The id of the key check row: one key per database. */
export const KEY_CHECK_ID = "data";

/** The encrypted copy of a plain value, or null for null. */
export function encryptField(spec: Pick<FieldSpec, "kind" | "context">, value: unknown) {
  if (value === null) return null;
  if (spec.kind === "int" && typeof value === "number") return encryptInt(value, spec.context);
  if (spec.kind === "text" && typeof value === "string") return encryptText(value, spec.context);
  throw new Error(`Unsupported value for encrypted field ${spec.context}`);
}

type PlainValue<S> = S extends { kind: "int" } ? number : string;
type PlainInput<M extends EncryptedModel> = { [F in keyof Fields[M]]?: PlainValue<Fields[M][F]> | null };
type Sealed<M extends EncryptedModel, V> = {
  [F in keyof V & keyof Fields[M] as Fields[M][F] extends { copy: infer C extends string } ? C : never]:
    V[F] extends null ? null : null extends V[F] ? string | null : undefined extends V[F] ? string | undefined : string;
};

/**
 * The columns to write for plain values of a model's encrypted fields: `seal("Purchase", { amountCents, note })`
 * gives `{ amountEnc, noteEnc }`. A field left out (or undefined) is left as it is; null stays null.
 */
export function seal<M extends EncryptedModel, V extends PlainInput<M>>(model: M, values: V): Sealed<M, V> {
  const fields: Record<string, FieldSpec> = ENCRYPTED_FIELDS[model];
  const sealed: Record<string, string | null> = {};
  for (const [field, value] of Object.entries(values)) {
    if (value === undefined) continue;
    const spec = fields[field];
    if (!spec) throw new Error(`${model}.${field} is not an encrypted field`);
    sealed[spec.copy] = encryptField(spec, value);
  }
  return sealed as Sealed<M, V>;
}

/** An item's name as stored: encrypted, with the index that finds it by name. */
export function sealItemName(userId: string, name: string) {
  return { ...seal("ExpenseItem", { name }), nameIndex: nameIndex(userId, normalizeItemName(name)) };
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

/** A required field's plain value; a missing copy is an error, never a silent zero or blank. */
function requiredInt(copy: string | null, context: string) {
  if (copy === null) throw new Error(`Missing encrypted value in ${context}`);
  return decryptInt(copy, context);
}
function requiredText(copy: string | null, context: string) {
  if (copy === null) throw new Error(`Missing encrypted value in ${context}`);
  return decryptText(copy, context);
}
const optionalInt = (copy: string | null, context: string) => (copy === null ? null : decryptInt(copy, context));
const optionalText = (copy: string | null, context: string) => (copy === null ? null : decryptText(copy, context));

const WRITE_OPERATIONS = new Set(["create", "createMany", "createManyAndReturn", "update", "updateMany", "updateManyAndReturn", "upsert"]);
const COPY_COLUMNS: Record<string, string[]> = Object.fromEntries(
  Object.entries(ENCRYPTED_FIELDS).map(([model, fields]) => [model, Object.values(fields).map((spec: FieldSpec) => spec.copy)]),
);

/**
 * The encrypting client: reads return each encrypted field's plain value under its plain name (`amountCents` from
 * `amountEnc`), and a write that stores encrypted values (from `seal`) first checks the key is this database's.
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
  const writesCopies = (model: string, data: unknown) => [data].flat().some((row) =>
    typeof row === "object" && row !== null && COPY_COLUMNS[model].some((copy) => typeof (row as Record<string, unknown>)[copy] === "string"));

  const F = ENCRYPTED_FIELDS;
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (model in COPY_COLUMNS && WRITE_OPERATIONS.has(operation)) {
            const write = args as { data?: unknown; create?: unknown; update?: unknown };
            if (writesCopies(model, write.data) || writesCopies(model, write.create) || writesCopies(model, write.update)) await ensureKey();
          }
          return query(args);
        },
      },
    },
    result: {
      user: {
        balanceGoalCents: { needs: { balanceGoalEnc: true }, compute: (row) => optionalInt(row.balanceGoalEnc, F.User.balanceGoalCents.context) },
        incomeEstimateCents: { needs: { incomeEstimateEnc: true }, compute: (row) => optionalInt(row.incomeEstimateEnc, F.User.incomeEstimateCents.context) },
      },
      paymentMethod: {
        name: { needs: { nameEnc: true }, compute: (row) => requiredText(row.nameEnc, F.PaymentMethod.name.context) },
        cashCountCents: { needs: { cashCountEnc: true }, compute: (row) => optionalInt(row.cashCountEnc, F.PaymentMethod.cashCountCents.context) },
      },
      category: {
        name: { needs: { nameEnc: true }, compute: (row) => optionalText(row.nameEnc, F.Category.name.context) },
        monthlyEstimateCents: { needs: { monthlyEstimateEnc: true }, compute: (row) => optionalInt(row.monthlyEstimateEnc, F.Category.monthlyEstimateCents.context) },
      },
      purchase: {
        amountCents: { needs: { amountEnc: true }, compute: (row) => requiredInt(row.amountEnc, F.Purchase.amountCents.context) },
        note: { needs: { noteEnc: true }, compute: (row) => optionalText(row.noteEnc, F.Purchase.note.context) },
      },
      expenseItem: {
        name: { needs: { nameEnc: true }, compute: (row) => requiredText(row.nameEnc, F.ExpenseItem.name.context) },
      },
      incomeSource: {
        name: { needs: { nameEnc: true }, compute: (row) => requiredText(row.nameEnc, F.IncomeSource.name.context) },
      },
      incomeGroup: {
        name: { needs: { nameEnc: true }, compute: (row) => requiredText(row.nameEnc, F.IncomeGroup.name.context) },
      },
      income: {
        amountCents: { needs: { amountEnc: true }, compute: (row) => requiredInt(row.amountEnc, F.Income.amountCents.context) },
        note: { needs: { noteEnc: true }, compute: (row) => optionalText(row.noteEnc, F.Income.note.context) },
      },
      recurringIncome: {
        amountCents: { needs: { amountEnc: true }, compute: (row) => requiredInt(row.amountEnc, F.RecurringIncome.amountCents.context) },
      },
      recurringPayment: {
        amountCents: { needs: { amountEnc: true }, compute: (row) => requiredInt(row.amountEnc, F.RecurringPayment.amountCents.context) },
      },
      recurringOccurrence: {
        amountCents: { needs: { amountEnc: true }, compute: (row) => optionalInt(row.amountEnc, F.RecurringOccurrence.amountCents.context) },
      },
      savingsFund: {
        name: { needs: { nameEnc: true }, compute: (row) => optionalText(row.nameEnc, F.SavingsFund.name.context) },
        targetCents: { needs: { targetEnc: true }, compute: (row) => optionalInt(row.targetEnc, F.SavingsFund.targetCents.context) },
        depositCents: { needs: { depositEnc: true }, compute: (row) => optionalInt(row.depositEnc, F.SavingsFund.depositCents.context) },
      },
      savingsMovement: {
        amountCents: { needs: { amountEnc: true }, compute: (row) => requiredInt(row.amountEnc, F.SavingsMovement.amountCents.context) },
        note: { needs: { noteEnc: true }, compute: (row) => optionalText(row.noteEnc, F.SavingsMovement.note.context) },
      },
      currencyExchange: {
        fromCents: { needs: { fromEnc: true }, compute: (row) => requiredInt(row.fromEnc, F.CurrencyExchange.fromCents.context) },
        toCents: { needs: { toEnc: true }, compute: (row) => requiredInt(row.toEnc, F.CurrencyExchange.toCents.context) },
        note: { needs: { noteEnc: true }, compute: (row) => optionalText(row.noteEnc, F.CurrencyExchange.note.context) },
      },
    },
  });
}

export type EncryptedClient = ReturnType<typeof withEncryption>;
/** The client inside an interactive transaction, which encrypts and decrypts the same way. */
export type EncryptedTransaction = Parameters<Parameters<EncryptedClient["$transaction"]>[0]>[0];
