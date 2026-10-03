import { redirect } from "next/navigation";
import { getPreferredLocale } from "@/lib/preferred-locale";

/** Auth.js redirects here (including on denied sign-ins); forward to the localized page. */
export default async function SignInRedirect({ searchParams }: PageProps<"/sign-in">) {
  const { error } = await searchParams;
  const query = typeof error === "string" ? `?error=${encodeURIComponent(error)}` : "";
  redirect(`/${await getPreferredLocale()}/sign-in${query}`);
}
