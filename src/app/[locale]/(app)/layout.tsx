import { AppShell } from "@/components/app-shell";
import { CurrencyProvider } from "@/components/currency";
import { RefreshOnReturn } from "@/components/refresh-on-return";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireUserId } from "@/lib/auth-user";
import { getMainCurrency } from "@/lib/queries";

export default async function AppLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) return null;
  const currency = await getMainCurrency(await requireUserId(locale));

  return (
    <CurrencyProvider currency={currency}>
      <RefreshOnReturn />
      <AppShell labels={getDictionary(locale).nav} locale={locale}>{children}</AppShell>
    </CurrencyProvider>
  );
}
