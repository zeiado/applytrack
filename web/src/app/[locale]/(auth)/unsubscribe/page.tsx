import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AuthPage } from "@/components/auth/auth-page";
import { UnsubscribeForm } from "@/components/settings/unsubscribe-form";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({ params }: PageProps<"/[locale]/unsubscribe">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Unsubscribe" });
  return { title: t("title"), robots: { index: false } };
}

/** Opened from the unsubscribe link in a reminder email. No login needed. */
export default async function UnsubscribePage({ params }: PageProps<"/[locale]/unsubscribe">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("Unsubscribe");

  return (
    <AuthPage title={t("title")} description={t("description")}>
      <UnsubscribeForm />
    </AuthPage>
  );
}
