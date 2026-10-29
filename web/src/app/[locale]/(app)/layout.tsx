import { LogOut } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { AppNav, AppNavLinks } from "@/components/app-nav";
import { FeedbackLink } from "@/components/feedback-link";
import { ProfileLink } from "@/components/profile-link";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { ToastProvider } from "@/components/ui/toast";
import type { Locale } from "@/i18n/routing";
import { logOut } from "@/lib/auth/actions";

/** Pages for logged-in users. The proxy sends visitors without a session to log in. */
export default async function AppLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("Nav");

  return (
    <ToastProvider>
      <SiteHeader>
        <Suspense fallback={<AppNavLinks kind="header" current={null} />}>
          <AppNav kind="header" />
        </Suspense>
        {/* It marks itself when it's the current page, which is only known per request. */}
        <Suspense>
          <ProfileLink />
        </Suspense>
        <FeedbackLink />
        <form action={logOut}>
          <Button type="submit" variant="ghost" size="sm" className="gap-1.5">
            <LogOut aria-hidden className="size-4 md:hidden rtl:-scale-x-100" />
            <span className="sr-only md:not-sr-only">{t("logOut")}</span>
          </Button>
        </form>
      </SiteHeader>
      <main className="mx-auto grid w-full max-w-7xl flex-1 content-start gap-6 px-4 pt-4 pb-44 sm:pt-6 md:pb-6">
        {children}
      </main>
      {/* Phones: the sections as a tab bar at the bottom, in reach of a thumb. */}
      <Suspense fallback={<AppNavLinks kind="tabs" current={null} />}>
        <AppNav kind="tabs" />
      </Suspense>
    </ToastProvider>
  );
}
