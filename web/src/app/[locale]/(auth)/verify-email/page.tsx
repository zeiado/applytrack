import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AuthPage } from "@/components/auth/auth-page";
import { VerifyEmail } from "@/components/auth/verify-email";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/verify-email">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Auth.verify" });
  return { title: t("title") };
}

export default async function VerifyEmailPage({ params }: PageProps<"/[locale]/verify-email">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("Auth.verify");

  return (
    <AuthPage title={t("title")}>
      <VerifyEmail />
    </AuthPage>
  );
}
