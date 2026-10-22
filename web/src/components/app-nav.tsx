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
          ? "bg-card fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t px-3 pt-2 pb-[max(0.875rem,env(safe-area-inset-bottom))] md:hidden"
          : "hidden items-center gap-5 md:flex"
      }
    >
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = current !== null && (current === href || current.startsWith(`${href}/`));
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              tabs
                ? "flex min-h-11 flex-col items-center justify-center gap-1 text-xs"
                : "flex items-center gap-1.5 text-sm font-medium",
              active
                ? tabs
                  ? "text-primary font-semibold"
                  : "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon aria-hidden className={tabs ? "size-6" : "size-4"} strokeWidth={tabs ? 1.9 : 2} />
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
