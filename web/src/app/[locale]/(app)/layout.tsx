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

  return (
    <>
      <SiteHeader>
        <nav aria-label={t("menu")} className="hidden sm:block">
          <Link href="/applications" className="text-sm font-medium hover:underline">
            {t("applications")}
          </Link>
        </nav>
        <form action={logOut}>
          <Button type="submit" variant="ghost" size="sm">
            {t("logOut")}
          </Button>
        </form>
      </SiteHeader>
      <main className="mx-auto grid w-full max-w-7xl flex-1 content-start gap-6 px-4 py-4 sm:py-6">
        {children}
      </main>
    </>
  );
}
