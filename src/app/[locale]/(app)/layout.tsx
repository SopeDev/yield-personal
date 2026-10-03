import { AppShell } from "@/components/app-shell";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireUserId } from "@/lib/auth-user";

export default async function AppLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) return null;
  await requireUserId(locale);

  return <AppShell labels={getDictionary(locale).nav} locale={locale}>{children}</AppShell>;
}
