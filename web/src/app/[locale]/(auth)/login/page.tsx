import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AuthPage } from "@/components/auth/auth-page";
import { LoginForm } from "@/components/auth/login-form";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({ params }: PageProps<"/[locale]/login">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Auth.login" });
  return { title: t("title") };
}

export default async function LoginPage({ params }: PageProps<"/[locale]/login">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("Auth.login");

  return (
    <AuthPage title={t("title")} description={t("description")}>
      <LoginForm />
    </AuthPage>
  );
}
