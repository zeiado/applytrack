import { setRequestLocale } from "next-intl/server";

import { HomeHero } from "@/components/home-hero";
import { LanguageSwitcher } from "@/components/language-switcher";
import { APP_NAME } from "@/config/brand";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale as "ar" | "en");

  return (
    <>
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
        <span className="text-lg font-bold">{APP_NAME}</span>
        <LanguageSwitcher />
      </header>
      <main className="flex-1">
        <HomeHero />
      </main>
    </>
  );
}
