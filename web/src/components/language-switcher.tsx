"use client";

import { useLocale, useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export function LanguageSwitcher() {
  const t = useTranslations("LanguageSwitcher");
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <nav aria-label={t("label")} className="flex gap-3 text-sm">
      {routing.locales
        .filter((other) => other !== locale)
        .map((other) => (
          <Link
            key={other}
            href={pathname}
            locale={other}
            lang={other}
            className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
          >
            {t(other)}
          </Link>
        ))}
    </nav>
  );
}
