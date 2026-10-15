import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { legalDocument } from "@/content/legal";
import { isLocale } from "@/i18n/config";

export async function generateMetadata({ params }: PageProps<"/[locale]/privacy">): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: `${legalDocument("privacy", locale).title} · Yield` } : {};
}

export default async function PrivacyPage({ params }: PageProps<"/[locale]/privacy">) {
  const { locale } = await params;
  if (!isLocale(locale)) return null;
  return <LegalPage kind="privacy" locale={locale} />;
}
