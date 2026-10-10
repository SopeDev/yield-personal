import { archiveCard, archiveCashWallet } from "@/app/actions/settings";
import { CardForm } from "@/components/card-form";
import { CashOnHandForm } from "@/components/cash-on-hand-form";
import { CashWalletForm } from "@/components/cash-wallet-form";
import { Card, Section } from "@/components/section";
import { RemoveRow, SubpageHeader } from "@/components/settings-layout";
import { isLocale } from "@/i18n/config";
import { format, getDictionary } from "@/i18n/dictionaries";
import { requireUserId } from "@/lib/auth-user";
import { loadCashOnHand } from "@/lib/ledger-data";
import { CURRENCIES } from "@/lib/money";
import { getActivePaymentMethods, getMainCurrency } from "@/lib/queries";

/** Cash on hand in each wallet (counted and recounted here), and credit cards. */
export default async function MoneySettingsPage({ params }: PageProps<"/[locale]/settings/money">) {
  const { locale } = await params;
  if (!isLocale(locale)) return null;
  const userId = await requireUserId(locale);
  const messages = getDictionary(locale);

  const [methods, currency, wallets] = await Promise.all([getActivePaymentMethods(userId), getMainCurrency(userId), loadCashOnHand(userId)]);
  const cards = methods.filter((method) => method.kind === "CARD");
  const currencyNames = new Intl.DisplayNames(locale, { type: "currency" });
  const cardCurrencies = [currency, ...CURRENCIES.filter((code) => code !== currency)].map((code) => ({ code, name: currencyNames.of(code) ?? code }));
  // Currencies that can still get a cash wallet.
  const walletCurrencies = CURRENCIES.filter((code) => !wallets.some(({ wallet }) => wallet.currency === code)).map((code) => ({ code, name: currencyNames.of(code) ?? code }));

  return (
    <div className="space-y-8">
      <SubpageHeader backHref={`/${locale}/settings`} backLabel={messages.settings.title} title={messages.settings.groupMoney} />

      <Section title={messages.month.cashOnHand}>
        <Card>
          {/* One cash wallet per currency; each is counted and tracked on its own, never converted. */}
          <ul className="divide-y divide-border">
            {wallets.map(({ wallet, cents }, index) => (
              <li key={wallet.id}>
                {wallets.length > 1 ? (
                  <p className="px-4 pt-4 text-sm font-medium">{wallet.name} · {wallet.currency}</p>
                ) : null}
                <CashOnHandForm cents={cents} currency={wallet.currency} locale={locale} messages={messages} walletId={wallet.id} />
                {index > 0 ? (
                  <RemoveRow action={archiveCashWallet} confirmMessage={messages.settings.confirmArchiveWallet} id={wallet.id} label={messages.settings.archiveWallet} locale={locale} />
                ) : null}
              </li>
            ))}
          </ul>
          {walletCurrencies.length > 0 ? (
            <details className="border-t border-border">
              <summary className="flex min-h-12 cursor-pointer items-center px-4 font-medium text-primary">{messages.settings.addWallet}</summary>
              <CashWalletForm currencies={walletCurrencies} locale={locale} messages={messages} />
            </details>
          ) : null}
        </Card>
      </Section>

      <Section title={messages.settings.cards}>
        <Card>
          {cards.length === 0 ? (
            <p className="px-4 py-4 text-muted-foreground">{messages.settings.cardsEmpty}</p>
          ) : (
            <ul className="divide-y divide-border">
              {cards.map((card) => (
                <li key={card.id}>
                  <details>
                    <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
                      <span aria-hidden="true" className="size-3 shrink-0 rounded-full" style={{ backgroundColor: card.color }} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{card.name}{card.currency !== currency ? ` · ${card.currency}` : null}</p>
                        <p className="text-sm text-muted-foreground">{format(messages.settings.cardDays, { closing: card.closingDay ?? "–", days: card.paymentDays ?? "–" })}</p>
                      </div>
                      <span className="text-sm text-primary">{messages.common.edit}</span>
                    </summary>
                    <div className="border-t border-border bg-background/40">
                      <CardForm
                        initial={{ id: card.id, name: card.name, color: card.color, closingDay: card.closingDay ?? 1, paymentDays: card.paymentDays ?? 15 }}
                        locale={locale}
                        messages={messages}
                        usedColors={cards.map((other) => other.color)}
                      />
                      <RemoveRow action={archiveCard} confirmMessage={messages.settings.confirmRemove} id={card.id} label={messages.settings.remove} locale={locale} />
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
          <details className="border-t border-border">
            <summary className="flex min-h-12 cursor-pointer items-center px-4 font-medium text-primary">{messages.settings.addCard}</summary>
            <CardForm currencies={cardCurrencies} locale={locale} messages={messages} usedColors={cards.map((card) => card.color)} />
          </details>
        </Card>
      </Section>
    </div>
  );
}
