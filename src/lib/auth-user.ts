import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { Locale } from "@/i18n/config";

export const getCurrentUserId = cache(async () => {
  const session = await auth();
  return session?.user?.id ?? null;
});

export async function requireUserId(locale: Locale) {
  const userId = await getCurrentUserId();
  if (!userId) redirect(`/${locale}/sign-in`);
  return userId;
}
