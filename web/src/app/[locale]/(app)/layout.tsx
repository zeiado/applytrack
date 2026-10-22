import { BarChart3, BellRing, KanbanSquare, LogOut, Settings } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { logOut } from "@/lib/auth/actions";

/** Pages for logged-in users. The proxy sends visitors without a session to log in. */
export default async function AppLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("Nav");
  const item = "text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm font-medium";

  return (
    <>
      <SiteHeader>
        <nav aria-label={t("menu")} className="flex items-center gap-3 md:gap-4">
          {/* Icons only on narrow screens (with the label for screen readers), words on wider ones. */}
          <Link href="/applications" className={item}>
            <KanbanSquare aria-hidden className="size-4" />
            <span className="sr-only md:not-sr-only">{t("applications")}</span>
          </Link>
          <Link href="/follow-ups" className={item}>
            <BellRing aria-hidden className="size-4" />
            <span className="sr-only md:not-sr-only">{t("followUps")}</span>
          </Link>
          <Link href="/stats" className={item}>
            <BarChart3 aria-hidden className="size-4" />
            <span className="sr-only md:not-sr-only">{t("stats")}</span>
          </Link>
          <Link href="/settings" className={item}>
            <Settings aria-hidden className="size-4" />
            <span className="sr-only md:not-sr-only">{t("settings")}</span>
          </Link>
        </nav>
        <form action={logOut}>
          <Button type="submit" variant="ghost" size="sm" className="gap-1.5">
            <LogOut aria-hidden className="size-4 md:hidden rtl:-scale-x-100" />
            <span className="sr-only md:not-sr-only">{t("logOut")}</span>
          </Button>
        </form>
      </SiteHeader>
      <main className="mx-auto grid w-full max-w-7xl flex-1 content-start gap-6 px-4 py-4 sm:py-6">
        {children}
      </main>
    </>
  );
}
