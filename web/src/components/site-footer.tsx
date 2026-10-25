import { useTranslations } from "next-intl";

import { APP_NAME } from "@/config/brand";
import { Link } from "@/i18n/navigation";

/** The bottom of public pages: the privacy policy and the terms. */
export function SiteFooter() {
  const t = useTranslations("Legal");

  return (
    <footer className="text-muted-foreground mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 border-t px-4 py-6 text-sm">
      <span>© {APP_NAME}</span>
      <nav aria-label={t("nav")} className="flex gap-5">
        <Link href="/privacy" className="hover:text-foreground hover:underline">
          {t("privacy")}
        </Link>
        <Link href="/terms" className="hover:text-foreground hover:underline">
          {t("terms")}
        </Link>
      </nav>
    </footer>
  );
}
