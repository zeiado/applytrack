import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ServiceWorker } from "@/components/pwa/service-worker";
import { ThemeSync } from "@/components/theme-sync";
import { DirectionProvider } from "@/components/ui/direction";
import { APP_NAME } from "@/config/brand";
import { direction, routing } from "@/i18n/routing";
import { THEME_SCRIPT } from "@/lib/theme/theme";

import "../globals.css";

// Covers Arabic and Latin, so both languages share one typeface.
const fontSans = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// The browser bar and the installed app's title bar take the brand teal.
export const viewport: Viewport = {
  themeColor: "#00695a",
};

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return {
    title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
    description: t("description"),
    // iPhone and iPad: "Add to Home Screen" opens it full screen, under this name.
    appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default" },
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const dir = direction(locale);

  return (
    // The theme script changes <html>'s class and style before React loads.
    <html lang={locale} dir={dir} className={`${fontSans.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <DirectionProvider direction={dir}>
          <NextIntlClientProvider>
            <ThemeSync />
            {children}
          </NextIntlClientProvider>
        <ServiceWorker />
        </DirectionProvider>
      </body>
    </html>
  );
}
