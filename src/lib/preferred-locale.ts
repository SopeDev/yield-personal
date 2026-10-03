import "server-only";

import { cookies } from "next/headers";
import { defaultLocale, isLocale, LOCALE_COOKIE } from "@/i18n/config";

export async function getPreferredLocale() {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return value && isLocale(value) ? value : defaultLocale;
}
