"use client";

import { BarChart3, BellRing, KanbanSquare, LogOut, MessageSquare, PanelLeftClose, PanelLeftOpen, Plus, Settings, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { Suspense } from "react";

import { Logo } from "@/components/brand/logo";
import { SearchButton } from "@/components/command-palette";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { FEEDBACK_URL } from "@/config/brand";
import { Link, usePathname } from "@/i18n/navigation";
import { logOut } from "@/lib/auth/actions";
import { toggleSidebar } from "@/lib/sidebar";
import { cn } from "@/lib/utils";

const MAIN = [
  { href: "/applications", label: "applications", icon: KanbanSquare },
  { href: "/follow-ups", label: "followUps", icon: BellRing },
  { href: "/stats", label: "stats", icon: BarChart3 },
] as const;

const YOU = [
  { href: "/profile", label: "profile", icon: UserRound },
  { href: "/settings", label: "settings", icon: Settings },
] as const;

const item =
  "state-layer relative flex h-10 items-center gap-3 rounded-full px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring collapsed:justify-center collapsed:px-0";
const label = "truncate collapsed:sr-only";

/**
 * The signed-in app's sidebar on computers (md and up), Notion style: Add application, the
 * three sections, then your profile, settings, theme, language and Log out at the bottom.
 * It collapses to icons; the choice is kept in this browser and applied before the page
 * paints (lib/sidebar.ts), so nothing jumps. `current` is the path, or null while unknown.
 * `followUpBadge` shows how many follow-ups are due (rendered on the server).
 */
export function AppSidebarView({ current, followUpBadge }: { current: string | null; followUpBadge?: React.ReactNode }) {
  const t = useTranslations("Nav");
  const tApps = useTranslations("Applications");

  const link = ({ href, label: key, icon: Icon }: { href: string; label: string; icon: typeof KanbanSquare }) => {
    const active = current !== null && (current === href || current.startsWith(`${href}/`));
    return (
      <Link
        key={href}
        href={href}
        title={t(key as "applications")}
        aria-current={active ? "page" : undefined}
        className={cn(item, active ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground")}
      >
        <Icon aria-hidden className="size-[1.125rem] shrink-0" />
        <span className={label}>{t(key as "applications")}</span>
        {href === "/follow-ups" && followUpBadge}
      </Link>
    );
  };

  return (
    <aside className="app-sidebar bg-surface-container-low sticky top-0 hidden h-svh w-64 shrink-0 flex-col gap-5 px-3 py-4 md:flex motion-safe:transition-[width] motion-safe:duration-200 collapsed:w-[4.5rem]">
      <div className="flex h-10 items-center gap-2 ps-2 collapsed:justify-center collapsed:ps-0">
        <Link href="/applications" className="me-auto collapsed:hidden">
          <Logo />
        </Link>
        <button
          type="button"
          onClick={toggleSidebar}
          className="state-layer text-muted-foreground relative flex size-9 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-ring"
        >
          <PanelLeftClose aria-hidden className="size-[1.125rem] collapsed:hidden rtl:-scale-x-100" />
          <PanelLeftOpen aria-hidden className="hidden size-[1.125rem] collapsed:block rtl:-scale-x-100" />
          <span className="sr-only collapsed:hidden">{t("collapse")}</span>
          <span className="sr-only hidden collapsed:inline">{t("expand")}</span>
        </button>
      </div>

      <SearchButton variant="sidebar" />

      <Link
        href="/applications/new"
        title={tApps("add")}
        className="state-layer bg-primary-container text-primary-container-foreground relative flex h-12 items-center gap-3 rounded-xl px-4 font-medium shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring collapsed:justify-center collapsed:px-0"
      >
        <Plus aria-hidden className="size-5 shrink-0" />
        <span className={label}>{tApps("add")}</span>
      </Link>

      <nav aria-label={t("menu")} className="flex min-h-0 flex-1 flex-col gap-1">
        {MAIN.map(link)}
        <div className="mt-auto grid gap-1 border-t pt-3">
          {YOU.map(link)}
          {FEEDBACK_URL && (
            <a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer" title={t("feedback")} className={cn(item, "text-muted-foreground hover:text-foreground")}>
              <MessageSquare aria-hidden className="size-[1.125rem] shrink-0" />
              <span className={label}>{t("feedback")}</span>
            </a>
          )}
        </div>
      </nav>

      <div className="flex items-center gap-1 collapsed:flex-col">
        <ThemeToggle />
        <div className="px-2 text-sm collapsed:hidden">
          {/* It links to the current page, whose path may only be known per request. */}
          <Suspense>
            <LanguageSwitcher />
          </Suspense>
        </div>
        <form action={logOut} className="ms-auto collapsed:ms-0">
          <button
            type="submit"
            title={t("logOut")}
            className="state-layer text-muted-foreground hover:text-foreground relative flex h-9 items-center gap-2 rounded-full px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring collapsed:px-2.5"
          >
            <LogOut aria-hidden className="size-4 rtl:-scale-x-100" />
            <span className={label}>{t("logOut")}</span>
          </button>
        </form>
      </div>
    </aside>
  );
}

/** The sidebar with the current page marked. Reads the path, so render it inside <Suspense>. */
export function AppSidebar({ followUpBadge }: { followUpBadge?: React.ReactNode }) {
  return <AppSidebarView current={usePathname()} followUpBadge={followUpBadge} />;
}
