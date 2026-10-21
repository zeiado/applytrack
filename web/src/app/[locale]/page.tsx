import { setRequestLocale } from "next-intl/server";

import { HomeHero } from "@/components/home-hero";
import { SiteHeader } from "@/components/site-header";
import type { Locale } from "@/i18n/routing";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <HomeHero />
      </main>
    </>
  );
}
