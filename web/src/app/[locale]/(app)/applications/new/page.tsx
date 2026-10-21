import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ApplicationForm } from "@/components/applications/application-form";
import type { Locale } from "@/i18n/routing";
import { createApplication } from "@/lib/applications/actions";

export async function generateMetadata({ params }: PageProps<"/[locale]/applications/new">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "ApplicationForm" });
  return { title: t("newTitle") };
}

export default async function NewApplicationPage({ params }: PageProps<"/[locale]/applications/new">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("ApplicationForm");

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-6">
      <h1 className="text-2xl font-bold">{t("newTitle")}</h1>
      <ApplicationForm action={createApplication} />
    </div>
  );
}
