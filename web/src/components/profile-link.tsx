"use client";

import { UserRound } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** The profile, one tap away in the app header (an icon, on every screen size). */
export function ProfileLink() {
  const t = useTranslations("Nav");
  const current = usePathname() === "/profile";
  return (
    <Link
      href="/profile"
      aria-label={t("profile")}
      title={t("profile")}
      aria-current={current ? "page" : undefined}
      className={cn(
        "hover:bg-muted flex size-9 items-center justify-center rounded-lg",
        current ? "text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <UserRound aria-hidden className="size-[18px]" />
    </Link>
  );
}
