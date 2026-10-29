import { useTranslations } from "next-intl";
import { Suspense } from "react";

import { Logo } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { SITE_LINKS } from "@/components/site/links";
import { APP_NAME, CONTACT_EMAIL } from "@/config/brand";
import { Link } from "@/i18n/navigation";

/** The public site's footer: the pages in three groups, then the language. */
export function SiteFooterFull() {
  const t = useTranslations("Site");
  const tLegal = useTranslations("Legal");
  const tHome = useTranslations("Home");

  const link = "text-muted-foreground hover:text-foreground underline-offset-4 hover:underline";
  const groups = [
    {
      title: t("footer.product"),
      items: [
        ...SITE_LINKS.filter(({ key }) => key !== "about").map(({ href, key }) => ({ href, label: t(`nav.${key}`) })),
        { href: "/features#extension", label: t("footer.extension") },
      ],
    },
    {
      title: t("footer.company"),
      items: [
        { href: "/about", label: t("nav.about") },
        { href: CONTACT_EMAIL ? `mailto:${CONTACT_EMAIL}` : "/about#contact", label: t("footer.contact") },
      ],
    },
    {
      title: tLegal("nav"),
      items: [
        { href: "/privacy", label: tLegal("privacy") },
        { href: "/terms", label: tLegal("terms") },
      ],
    },
  ];

  return (
    <footer className="bg-surface-container mt-auto">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 pt-14 pb-8">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
          <div className="grid content-start justify-items-start gap-3">
            <Logo />
            <p className="text-muted-foreground max-w-xs">{tHome("tagline")}</p>
          </div>
          {groups.map((group) => (
            <nav key={group.title} aria-label={group.title} className="grid content-start gap-3 text-sm">
              <h2 className="font-semibold">{group.title}</h2>
              <ul className="grid gap-2.5">
                {group.items.map((item) => (
                  <li key={item.href}>
                    {item.href.startsWith("mailto:") ? (
                      <a href={item.href} className={link}>
                        {item.label}
                      </a>
                    ) : (
                      <Link href={item.href} className={link}>
                        {item.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-4 border-t pt-6 text-sm">
          <span>© {APP_NAME}</span>
          <Suspense>
            <LanguageSwitcher />
          </Suspense>
        </div>
      </div>
    </footer>
  );
}
