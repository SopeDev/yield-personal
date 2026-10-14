import type { PrismaClient } from "@/generated/prisma/client";
import { ENCRYPTED_FIELDS, encryptField, verifyKey } from "@/db/encryption";
import { nameIndex } from "@/lib/field-crypto";

const BATCH = 500;

type Row = Record<string, unknown> & { id: string };
type Delegate = {
  findMany(args: object): Promise<Row[]>;
  update(args: object): Promise<unknown>;
};

/**
 * Writes the encrypted copy of every encrypted field that doesn't have one yet (rows from before encryption, or
 * written by an older deployment), and every item's name index. Safe to run any number of times: rows already
 * encrypted are left alone. Returns how many copies it wrote, by table.
 */
export async function encryptExisting(base: PrismaClient) {
  await verifyKey(base);
  const written: Record<string, number> = {};
  for (const [model, fields] of Object.entries(ENCRYPTED_FIELDS)) {
    const delegate = (base as unknown as Record<string, Delegate>)[model[0].toLowerCase() + model.slice(1)];
    for (const [field, spec] of Object.entries(fields)) {
      let count = 0;
      let cursor: string | undefined;
      for (;;) {
        const rows = await delegate.findMany({
          where: { [spec.copy]: null },
          select: { id: true, [field]: true },
          orderBy: { id: "asc" },
          take: BATCH,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });
        for (const row of rows) {
          // A null stays null: its copy is null too.
          if (row[field] === null) continue;
          await delegate.update({ where: { id: row.id }, data: { [spec.copy]: encryptField(spec, row[field]) } });
          count += 1;
        }
        if (rows.length < BATCH) break;
        cursor = rows[rows.length - 1].id;
      }
      if (count > 0) written[spec.context] = count;
    }
  }

  const items = await base.expenseItem.findMany({ where: { nameIndex: null }, select: { id: true, userId: true, normalizedName: true } });
  for (const item of items) {
    await base.expenseItem.update({ where: { id: item.id }, data: { nameIndex: nameIndex(item.userId, item.normalizedName) } });
  }
  if (items.length > 0) written["expense_items.name_index"] = items.length;
  return written;
}
