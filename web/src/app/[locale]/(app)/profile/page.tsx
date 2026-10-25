import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { ProfileForm } from "@/components/profile/profile-form";
import type { Locale } from "@/i18n/routing";
import { getProfile } from "@/lib/profile/data";

export async function generateMetadata({ params }: PageProps<"/[locale]/profile">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Profile" });
  return { title: t("title") };
}

export default async function ProfilePage({ params }: PageProps<"/[locale]/profile">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("Profile");

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-6">
      <header className="grid gap-2">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </header>
      {/* The profile is per request: the form streams in. */}
      <Suspense fallback={<div className="bg-muted h-[32rem] animate-pulse rounded-xl" />}>
        <Form />
      </Suspense>
    </div>
  );
}

async function Form() {
  return <ProfileForm profile={await getProfile()} />;
}
