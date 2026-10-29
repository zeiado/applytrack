import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { DeletedNotice } from "@/components/deleted-notice";
import { HomeHero } from "@/components/home-hero";
import { HomeJourney } from "@/components/home-journey";
import type { Locale } from "@/i18n/routing";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  return (
    <>
      {/* Reads the URL, so it streams in; the rest of the page stays prerendered. */}
      <Suspense>
        <DeletedNotice />
      </Suspense>
      <HomeHero />
      <HomeJourney />
    </>
  );
}
