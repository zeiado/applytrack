import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import { LegalPage } from "@/components/legal/legal-page";
import { terms } from "@/content/legal/terms";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({ params }: PageProps<"/[locale]/terms">): Promise<Metadata> {
  const { locale } = await params;
  const doc = terms[locale as Locale];
  return { title: doc.title, description: doc.description };
}

export default async function TermsPage({ params }: PageProps<"/[locale]/terms">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <LegalPage doc={terms[locale as Locale]} updated={terms.updated} locale={locale as Locale} />;
}
