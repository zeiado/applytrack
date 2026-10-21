import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AuthPage } from "@/components/auth/auth-page";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/reset-password">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Auth.reset" });
  return { title: t("title") };
}

export default async function ResetPasswordPage({
  params,
}: PageProps<"/[locale]/reset-password">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("Auth.reset");

  return (
    <AuthPage title={t("title")} description={t("description")}>
      <ResetPasswordForm />
    </AuthPage>
  );
}
