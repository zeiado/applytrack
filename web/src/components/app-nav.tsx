"use client";

import { BarChart3, BellRing, KanbanSquare, Settings } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/applications", label: "applications", icon: KanbanSquare },
  { href: "/follow-ups", label: "followUps", icon: BellRing },
  { href: "/stats", label: "stats", icon: BarChart3 },
  { href: "/settings", label: "settings", icon: Settings },
] as const;

type Kind = "header" | "tabs";

/** The app's four sections: words in the header from `md` up, a tab bar fixed to the
 * bottom on phones. `current` is the active path, or null while it isn't known yet. */
export function AppNavLinks({ kind, current }: { kind: Kind; current: string | null }) {
  const t = useTranslations("Nav");
  const tabs = kind === "tabs";
  return (
    <nav
      aria-label={t("menu")}
      className={
        tabs
          ? // Material 3 navigation bar: the active icon sits on a pill.
            "bg-surface-container fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 px-2 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] md:hidden"
          : "hidden items-center gap-1 md:flex"
      }
    >
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = current !== null && (current === href || current.startsWith(`${href}/`));
        return tabs ? (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex min-h-14 flex-col items-center gap-1 text-xs font-medium outline-none",
              active ? "text-foreground font-semibold" : "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "state-layer relative flex h-8 w-16 items-center justify-center rounded-full transition-colors group-focus-visible:outline-2 group-focus-visible:outline-ring",
                active && "bg-secondary text-secondary-foreground",
              )}
            >
              <Icon aria-hidden className="size-6" strokeWidth={active ? 2.2 : 1.9} />
            </span>
            {t(label)}
          </Link>
        ) : (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "state-layer relative flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring",
              active ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon aria-hidden className="size-4" />
            {t(label)}
          </Link>
        );
      })}
    </nav>
  );
}

/** The links with the current page marked. Reads the path, so render it inside <Suspense>. */
export function AppNav({ kind }: { kind: Kind }) {
  return <AppNavLinks kind={kind} current={usePathname()} />;
}
