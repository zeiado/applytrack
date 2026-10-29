import { LogOut } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { AppNav, AppNavLinks } from "@/components/app-nav";
import { AppSidebar, AppSidebarView } from "@/components/app-sidebar";
import { CommandPalette, SearchButton } from "@/components/command-palette";
import { Logo } from "@/components/brand/logo";
import { FeedbackLink } from "@/components/feedback-link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ProfileLink } from "@/components/profile-link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { ToastProvider } from "@/components/ui/toast";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getDueReminders } from "@/lib/applications/data";
import { logOut } from "@/lib/auth/actions";
import { getCurrentUser } from "@/lib/auth/session";

/** Pages for logged-in users. The proxy sends visitors without a session to log in.
 * Computers get the sidebar; phones a slim top bar, the tab bar at the bottom and the
 * floating Add button. */
export default async function AppLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("Nav");
  const badge = (
    <Suspense>
      <DueBadge />
    </Suspense>
  );

  return (
    <ToastProvider>
      <CommandPalette>
        <div className="flex-1 md:flex">
          {/* It marks the current page, which is only known per request. */}
          <Suspense fallback={<AppSidebarView current={null} />}>
            <AppSidebar followUpBadge={badge} />
          </Suspense>
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex items-center gap-1 px-4 py-3 md:hidden">
              <Link href="/applications" className="me-auto">
                <Logo />
              </Link>
              <SearchButton variant="icon" />
              <ThemeToggle />
              <Suspense>
                <LanguageSwitcher />
              </Suspense>
              <FeedbackLink />
              <Suspense>
                <ProfileLink />
              </Suspense>
              <form action={logOut}>
                <Button type="submit" variant="ghost" size="icon" aria-label={t("logOut")}>
                  <LogOut aria-hidden className="rtl:-scale-x-100" />
                </Button>
              </form>
            </header>
            <main className="mx-auto grid w-full max-w-6xl flex-1 content-start gap-6 px-4 pt-2 pb-44 sm:px-6 md:px-10 md:pt-10 md:pb-12">
              {children}
            </main>
          </div>
        </div>
        {/* Phones: the sections as a tab bar at the bottom, in reach of a thumb. */}
        <Suspense fallback={<AppNavLinks kind="tabs" current={null} />}>
          <AppNav kind="tabs" />
        </Suspense>
      </CommandPalette>
    </ToastProvider>
  );
}

/** How many follow-ups are due today or late, next to "Follow-ups" in the sidebar. */
async function DueBadge() {
  const t = await getTranslations("Nav");
  const user = await getCurrentUser();
  const { items } = await getDueReminders(user?.timezone ?? "Africa/Cairo", 0);
  if (items.length === 0) return null;
  return (
    <span
      aria-label={t("due", { count: items.length })}
      className="bg-primary text-primary-foreground ms-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums collapsed:absolute collapsed:end-0.5 collapsed:top-0 collapsed:ms-0"
    >
      {items.length}
    </span>
  );
}
