import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { DeletedNotice } from "@/components/deleted-notice";
import { HomeHero } from "@/components/home-hero";
import { HomeJourney } from "@/components/home-journey";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("Home");

  return (
    <>
      <SiteHeader>
        <Link href="/login" className="text-sm font-medium hover:underline">
          {t("logIn")}
        </Link>
      </SiteHeader>
      <main className="flex-1">
        {/* Reads the URL, so it streams in; the rest of the page stays prerendered. */}
        <Suspense>
          <DeletedNotice />
        </Suspense>
        <HomeHero />
        <HomeJourney />
      </main>
      <SiteFooter />
    </>
  );
}
