import { setRequestLocale } from "next-intl/server";

import { SiteHeader } from "@/components/site-header";
import type { Locale } from "@/i18n/routing";

export default async function AuthLayout({ children, params }: LayoutProps<"/[locale]">) {
  // Every layout and page that renders translated content sets the language itself;
  // otherwise next-intl reads it from the request and the page can't be prerendered.
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 items-start justify-center px-4 pt-6 pb-16 sm:pt-12">
        {children}
      </main>
    </>
  );
}
