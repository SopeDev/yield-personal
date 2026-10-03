/** A calendar month as "YYYY-MM". Dates are calendar dates ("YYYY-MM-DD") with no time zone. */
export type MonthKey = `${number}-${number}`;

const MONTH_KEY_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DATE_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function isMonthKey(value: string): value is MonthKey {
  return MONTH_KEY_PATTERN.test(value);
}

export function isDateKey(value: string) {
  if (!DATE_KEY_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return date.toISOString().slice(0, 10) === value;
}

export function monthKeyOf(date: Date): MonthKey {
  return date.toISOString().slice(0, 7) as MonthKey;
}

export function dateKeyOf(date: Date) {
  return date.toISOString().slice(0, 10);
}

/** Converts a calendar date key to the UTC midnight Date that Prisma stores in a `@db.Date` column. */
export function dateFromKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00Z`);
}

export function addMonths(month: MonthKey, count: number): MonthKey {
  const [year, monthNumber] = month.split("-").map(Number);
  const index = year * 12 + (monthNumber - 1) + count;
  const nextYear = Math.floor(index / 12);
  const nextMonth = (index % 12) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}` as MonthKey;
}

export function monthDifference(from: MonthKey, to: MonthKey) {
  const [fromYear, fromMonth] = from.split("-").map(Number);
  const [toYear, toMonth] = to.split("-").map(Number);
  return (toYear - fromYear) * 12 + (toMonth - fromMonth);
}

/** First day of the month and first day of the following month, as `@db.Date` values. */
export function monthRange(month: MonthKey) {
  return { start: dateFromKey(`${month}-01`), end: dateFromKey(`${addMonths(month, 1)}-01`) };
}

export function daysInMonth(month: MonthKey) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

/** The given day of a month, clamped to the month's last day (day 31 in February is Feb 28/29). */
export function dateInMonth(month: MonthKey, day: number) {
  return dateFromKey(`${month}-${String(Math.min(day, daysInMonth(month))).padStart(2, "0")}`);
}
