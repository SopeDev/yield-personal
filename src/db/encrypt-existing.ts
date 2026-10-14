import type { PrismaClient } from "@/generated/prisma/client";
import { ENCRYPTED_FIELDS, encryptField, verifyKey } from "@/db/encryption";
import { decryptText, nameIndex } from "@/lib/field-crypto";
import { normalizeItemName } from "@/lib/items";

/**
 * Writes the encrypted copy of every value the database still holds only in plaintext (rows from before encryption,
 * or written by a deployment older than it), and every item's name index. It never changes or clears plaintext:
 * a migration clears plaintext that has its copy, and from then on a trigger clears it as each copy is written.
 * Works on the database's own columns, not the client's schema, since a deploy runs it both before and after its
 * migrations; tables or columns that don't exist (yet, or any more) are skipped. Safe to run any number of times.
 * Returns how many values it encrypted, by column.
 */
export async function encryptExisting(base: PrismaClient) {
  const columns = new Set((await base.$queryRaw<{ name: string }[]>`
    SELECT table_name || '.' || column_name AS name FROM information_schema.columns WHERE table_schema = current_schema()
  `).map((row) => row.name));
  const has = (table: string, column: string) => columns.has(`${table}.${column}`);
  // Before any migration there is nothing to encrypt, nor anywhere to record the key.
  if (!has("encryption_key_checks", "check")) return {};
  await verifyKey(base);

  const done: Record<string, number> = {};
  const count = (label: string) => (done[label] = (done[label] ?? 0) + 1);
  for (const fields of Object.values(ENCRYPTED_FIELDS)) {
    for (const spec of Object.values(fields)) {
      const [table, plain] = spec.context.split(".");
      if (!has(table, plain) || !has(table, spec.column)) continue;
      // Identifiers come from ENCRYPTED_FIELDS, never from input.
      const rows = await base.$queryRawUnsafe<{ id: string; value: unknown }[]>(
        `SELECT id::text AS id, "${plain}" AS value FROM "${table}" WHERE "${spec.column}" IS NULL AND "${plain}" IS NOT NULL`,
      );
      for (const row of rows) {
        await base.$executeRawUnsafe(`UPDATE "${table}" SET "${spec.column}" = $1 WHERE id = $2::uuid AND "${spec.column}" IS NULL`, encryptField(spec, row.value), row.id);
        count(spec.context);
      }
    }
  }

  // Every item needs its name index: from its plaintext normalized name where that's still there, else its decrypted name.
  if (has("expense_items", "name_index")) {
    const plainName = has("expense_items", "normalized_name");
    const items = await base.$queryRawUnsafe<{ id: string; userId: string; nameEnc: string | null; normalized: string | null }[]>(
      `SELECT id::text AS id, user_id::text AS "userId", name_enc AS "nameEnc", ${plainName ? "normalized_name" : "NULL"} AS normalized
       FROM expense_items WHERE name_index IS NULL`,
    );
    for (const item of items) {
      const normalized = item.normalized ?? (item.nameEnc === null ? null : normalizeItemName(decryptText(item.nameEnc, ENCRYPTED_FIELDS.ExpenseItem.name.context)));
      if (normalized === null) throw new Error(`Item ${item.id} has no name to index`);
      await base.$executeRawUnsafe("UPDATE expense_items SET name_index = $1 WHERE id = $2::uuid AND name_index IS NULL", nameIndex(item.userId, normalized), item.id);
      count("expense_items.name_index");
    }
  }
  return done;
}
