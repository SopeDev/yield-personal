import { isMonthKey, type MonthKey } from "./months";

export function monthFromSearchParam(value: string | string[] | undefined, fallback: MonthKey): MonthKey {
  return typeof value === "string" && isMonthKey(value) ? value : fallback;
}
