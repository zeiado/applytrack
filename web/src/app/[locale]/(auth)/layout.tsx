import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { Logo } from "@/components/brand/logo";
import { RoadBackdrop } from "@/components/brand/road-backdrop";
import { LanguageSwitcher } from "@/components/language-switcher";
import { SiteHeader } from "@/components/site-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

export default async function AuthLayout({ children, params }: LayoutProps<"/[locale]">) {
  // Every layout and page that renders translated content sets the language itself;
  // otherwise next-intl reads it from the request and the page can't be prerendered.
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  return (
    <>
      <RoadBackdrop />
      {/* Phones: just the logo, centred, with the theme and language switches in the corners. */}
      <div className="relative flex justify-center px-4 pt-12 pb-2 sm:hidden">
        <Link href="/">
          <Logo className="h-9" />
        </Link>
        <div className="absolute start-2 top-2.5">
          <ThemeToggle />
        </div>
        <div className="absolute end-4 top-4 text-sm">
          <Suspense>
            <LanguageSwitcher />
          </Suspense>
        </div>
      </div>
      <div className="hidden sm:block">
        <SiteHeader />
      </div>
      <main className="flex flex-1 items-start justify-center px-6 pt-6 pb-16 sm:px-4 sm:pt-12">{children}</main>
    </>
  );
}
