import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { DeletedNotice } from "@/components/deleted-notice";
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
        {/* Reads the URL, so it streams in; the rest of the page stays prerendered. */}
        <Suspense>
          <DeletedNotice />
        </Suspense>
        <HomeHero />
      </main>
    </>
  );
}
