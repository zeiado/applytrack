import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import { LegalPage } from "@/components/legal/legal-page";
import { privacy } from "@/content/legal/privacy";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({ params }: PageProps<"/[locale]/privacy">): Promise<Metadata> {
  const { locale } = await params;
  const doc = privacy[locale as Locale];
  return { title: doc.title, description: doc.description };
}

export default async function PrivacyPage({ params }: PageProps<"/[locale]/privacy">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <LegalPage doc={privacy[locale as Locale]} updated={privacy.updated} locale={locale as Locale} />;
}
