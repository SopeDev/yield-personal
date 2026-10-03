import Image from "next/image";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { isLocale } from "@/i18n/config";
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

  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm text-center">
        <Image alt={messages.appName} className="mx-auto" height={58} priority src="/brand/yield-logo.svg" width={190} />
        <h1 className="mt-10 font-display text-2xl font-semibold">{messages.auth.title}</h1>
        <p className="mt-2 text-muted-foreground">{messages.auth.description}</p>

        {error ? <p className="mt-6 rounded-xl border border-loss/40 bg-loss/10 px-4 py-3 text-sm text-loss" role="alert">{messages.auth.denied}</p> : null}

        <form action={signInWithGoogle} className="mt-8">
          <button className="flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-4 font-semibold text-primary-foreground transition hover:brightness-110" type="submit">
            {messages.auth.google}
          </button>
        </form>
      </div>
    </main>
  );
}
