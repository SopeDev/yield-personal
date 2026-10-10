import { setCurrency, setLocale } from "@/app/actions/settings";
import { Section } from "@/components/section";
import { SubpageHeader } from "@/components/settings-layout";
import { isLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireUserId } from "@/lib/auth-user";
import { cn } from "@/lib/cn";
import { CURRENCIES } from "@/lib/money";
import { getMainCurrency } from "@/lib/queries";

/** Each language in its own name. */
const LANGUAGE_NAMES = { en: "English", es: "Español" } as const;

/** Language and main currency. */
export default async function GeneralSettingsPage({ params }: PageProps<"/[locale]/settings/general">) {
  const { locale } = await params;
  if (!isLocale(locale)) return null;
  const userId = await requireUserId(locale);
  const messages = getDictionary(locale);
  const currency = await getMainCurrency(userId);
  const currencyNames = new Intl.DisplayNames(locale, { type: "currency" });

  return (
    <div className="space-y-8">
      <SubpageHeader backHref={`/${locale}/settings`} backLabel={messages.settings.title} title={messages.settings.groupGeneral} />

      <Section title={messages.settings.language}>
        <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-surface p-1">
          {locales.map((option) => (
            <form action={setLocale} key={option}>
              <input name="locale" type="hidden" value={option} />
              <button
                aria-pressed={option === locale}
                className={cn("flex min-h-10 w-full items-center justify-center rounded-lg text-sm font-semibold transition", option === locale ? "bg-background text-foreground" : "text-muted-foreground")}
                type="submit"
              >
                {LANGUAGE_NAMES[option]}
              </button>
            </form>
          ))}
        </div>
      </Section>

      <Section title={messages.settings.currency}>
        <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-surface p-1">
          {CURRENCIES.map((option) => (
            <form action={setCurrency} key={option}>
              <input name="locale" type="hidden" value={locale} />
              <input name="currency" type="hidden" value={option} />
              <button
                aria-pressed={option === currency}
                className={cn("flex min-h-10 w-full flex-col items-center justify-center rounded-lg px-2 py-1 text-sm font-semibold transition", option === currency ? "bg-background text-foreground" : "text-muted-foreground")}
                type="submit"
              >
                {option}
                <span className="text-xs font-normal text-muted-foreground">{currencyNames.of(option)}</span>
              </button>
            </form>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">{messages.settings.currencyHint}</p>
      </Section>
    </div>
  );
}
