import { dateKeyOf } from "./months";

/** Money on hand as counted by hand: the amount, the moment it was set, and that moment's day ("YYYY-MM-DD") in the app's time zone. */
export type CashCount = { cents: number; setAt: Date; day: string };
/** A dated record: an income, a cash purchase, or a savings movement (positive into savings). */
export type DatedRecord = { date: Date; createdAt: Date; amountCents: number };
/** A cash bill or card statement marked paid. */
export type PaidBill = { paidAt: Date; amountCents: number };

/**
 * Whether a dated record moves money on hand: it falls after the counted day and by today, or on the counted day
 * but was entered after counting. A record entered late for an earlier day was already in the accounts when they
 * were counted, and a record dated ahead counts once its day comes.
 */
export function countsAfter(count: CashCount, record: DatedRecord, today: string) {
  const day = dateKeyOf(record.date);
  if (day > today) return false;
  return day > count.day || (day === count.day && record.createdAt > count.setAt);
}

type CashRecords = {
  count: CashCount;
  /** Today as "YYYY-MM-DD". */
  today: string;
  incomes: DatedRecord[];
  cashPurchases: DatedRecord[];
  savingsMovements: DatedRecord[];
  paidBills: PaidBill[];
  /** Money changed between currencies: positive when it arrived in this wallet, negative when it left. */
  transfers?: DatedRecord[];
};

/** How money on hand got from its count to now: what each kind of record moved since counting. */
export type CashOnHandParts = {
  countedCents: number;
  /** The counted day, "YYYY-MM-DD". */
  countedOn: string;
  incomeCents: number;
  purchasesCents: number;
  billsCents: number;
  /** Net money moved into savings (negative when more was taken out). */
  savingsCents: number;
  /** Net money changed into this wallet's currency. */
  transfersCents: number;
  cents: number;
};

/**
 * Money on hand now: the counted amount, plus income, minus cash purchases, bills and statements paid, and net
 * money moved into savings since it was counted, plus or minus money changed from or to another currency. Card purchases leave only when their statement is paid.
 */
export function cashOnHandParts({ count, today, incomes, cashPurchases, savingsMovements, paidBills, transfers = [] }: CashRecords): CashOnHandParts {
  const sumAfter = (records: DatedRecord[]) => records.filter((record) => countsAfter(count, record, today)).reduce((sum, record) => sum + record.amountCents, 0);
  const parts = {
    countedCents: count.cents,
    countedOn: count.day,
    incomeCents: sumAfter(incomes),
    purchasesCents: sumAfter(cashPurchases),
    billsCents: paidBills.filter((bill) => bill.paidAt > count.setAt).reduce((sum, bill) => sum + bill.amountCents, 0),
    savingsCents: sumAfter(savingsMovements),
    transfersCents: sumAfter(transfers),
  };
  return { ...parts, cents: parts.countedCents + parts.incomeCents - parts.purchasesCents - parts.savingsCents - parts.billsCents + parts.transfersCents };
}

export function cashOnHandCents(records: CashRecords) {
  return cashOnHandParts(records).cents;
}
