import "server-only";

import { getAppTimeZone } from "@/lib/env";
import type { MonthKey } from "@/lib/months";

/** Today's calendar date in the app's time zone, as "YYYY-MM-DD". */
export function todayKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: getAppTimeZone() }).format(new Date());
}

/** The month a moment falls in, in the app's time zone. */
export function monthKeyInAppZone(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: getAppTimeZone() }).format(date).slice(0, 7) as MonthKey;
}

export function currentMonthKey() {
  return todayKey().slice(0, 7) as MonthKey;
}
