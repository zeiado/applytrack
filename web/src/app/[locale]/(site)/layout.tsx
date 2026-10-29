import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { RoadBackdrop } from "@/components/brand/road-backdrop";
import { SiteFooterFull } from "@/components/site/site-footer-full";
import { SiteNav, SiteNavBar } from "@/components/site/site-nav";
import type { Locale } from "@/i18n/routing";

/** The public site (home, features, what's coming, about, legal): anyone can read it,
 * logged in or not. */
export default async function SiteLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  return (
    <>
      <RoadBackdrop />
      {/* It marks the current page, which is only known per request. */}
      <Suspense fallback={<SiteNavBar current={null} />}>
        <SiteNav />
      </Suspense>
      <main className="flex-1">{children}</main>
      <SiteFooterFull />
    </>
  );
}
