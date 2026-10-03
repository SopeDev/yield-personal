import "server-only";

import { auth } from "@/auth";
import { isLocale, type Locale, defaultLocale } from "@/i18n/config";

/** Server Actions are reachable by direct POST, so each one re-checks the session. */
export async function requireActionUserId() {
  const userId = (await auth())?.user?.id;
  if (!userId) throw new Error("Unauthorized");
  return userId;
}

export function localeFromForm(formData: FormData): Locale {
  const value = String(formData.get("locale") ?? "");
  return isLocale(value) ? value : defaultLocale;
}
