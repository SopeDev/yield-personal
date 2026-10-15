import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { legalDocument } from "@/content/legal";
import { isLocale } from "@/i18n/config";

export async function generateMetadata({ params }: PageProps<"/[locale]/terms">): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: `${legalDocument("terms", locale).title} · Yield` } : {};
}

export default async function TermsPage({ params }: PageProps<"/[locale]/terms">) {
  const { locale } = await params;
  if (!isLocale(locale)) return null;
  return <LegalPage kind="terms" locale={locale} />;
}
