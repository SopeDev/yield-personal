import Image from "next/image";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { isLocale, LOCALE_COOKIE, locales } from "@/i18n/config";
import { cn } from "@/lib/cn";
import { getDictionary } from "@/i18n/dictionaries";
import { getCurrentUserId } from "@/lib/auth-user";

export default async function SignInPage({ params, searchParams }: PageProps<"/[locale]/sign-in">) {
  const { locale } = await params;
  if (!isLocale(locale)) return null;
  if (await getCurrentUserId()) redirect(`/${locale}/month`);

  const messages = getDictionary(locale);
  const { error } = await searchParams;

  async function signInWithGoogle() {
    "use server";
    await signIn("google", { redirectTo: `/${locale}/month` });
  }

  // The language comes first, before anything is read; it's remembered from here on.
  async function chooseLanguage(formData: FormData) {
    "use server";
    const chosen = String(formData.get("locale") ?? "");
    if (!isLocale(chosen)) return;
    (await cookies()).set(LOCALE_COOKIE, chosen, { maxAge: 60 * 60 * 24 * 365, sameSite: "lax", path: "/" });
    redirect(`/${chosen}/sign-in`);
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm text-center">
        <form action={chooseLanguage} className="mb-10 flex rounded-xl border border-border bg-background p-1" aria-label="Language / Idioma">
          {locales.map((option) => (
            <button
              aria-pressed={option === locale}
              className={cn("flex min-h-10 flex-1 items-center justify-center rounded-lg text-sm font-medium transition", option === locale ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground")}
              key={option}
              name="locale"
              type="submit"
              value={option}
            >
              {languageName(option)}
            </button>
          ))}
        </form>
        <Image alt={messages.appName} className="mx-auto" height={58} priority src="/brand/yield-logo.svg" width={190} />
        <h1 className="mt-10 font-display text-2xl font-semibold">{messages.auth.title}</h1>
        <p className="mt-2 text-muted-foreground">{messages.auth.description}</p>

        {error ? <p className="mt-6 rounded-xl border border-loss/40 bg-loss/10 px-4 py-3 text-sm text-loss" role="alert">{messages.auth.failed}</p> : null}

        <form action={signInWithGoogle} className="mt-8">
          <button className="flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-4 font-semibold text-primary-foreground transition hover:brightness-110" type="submit">
            {messages.auth.google}
          </button>
        </form>
      </div>
    </main>
  );
}

/** A language in itself, capitalized: "English", "Español". */
function languageName(locale: string) {
  const name = new Intl.DisplayNames(locale, { type: "language" }).of(locale) ?? locale;
  return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
}
