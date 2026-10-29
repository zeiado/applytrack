import { Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { CompanyInitial } from "@/components/applications/company-initial";
import { Logo } from "@/components/brand/logo";
import { RoadLine } from "@/components/brand/road";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** A home page section: a heading and short text, with its demo beside it from `lg` up.
 * `flip` puts the demo first on wide screens, so the sections zigzag down the page. */
export function HomeSection({
  id,
  title,
  body,
  flip = false,
  children,
}: {
  id: string;
  title: string;
  body: string;
  flip?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-20 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-20"
    >
      <div className={cn("grid content-start gap-4", flip && "lg:order-2")}>
        <h2 id={`${id}-title`} className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl rtl:font-bold">
          {title}
        </h2>
        <p className="text-muted-foreground text-lg text-pretty">{body}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

/** The follow-up reminder email, as it lands in the morning. */
export function MorningEmail() {
  const t = useTranslations("Home.email");
  const demo = useTranslations("Home.journey.demo");
  const locale = useLocale();
  const items = [
    [demo("otherCompany"), demo("otherRole"), t("dueToday")],
    [demo("company"), demo("role"), t("overdue")],
  ] as const;
  return (
    <div aria-hidden className="mx-auto grid w-full max-w-lg gap-3">
      {/* The inbox line it arrives as. */}
      <div className="bg-card flex items-center gap-3 rounded-xl border px-4 py-3">
        <Logo variant="symbol" className="h-6" />
        <span className="grid min-w-0 flex-1">
          <span className="font-semibold">{t("from")}</span>
          <span className="text-muted-foreground truncate text-sm">{t("subject")}</span>
        </span>
        <span className="text-muted-foreground text-xs">{t("time")}</span>
      </div>
      {/* The email itself, in the same colours as the real one. */}
      <div className="bg-card overflow-hidden rounded-2xl border shadow-sm">
        <div className="bg-primary text-primary-foreground px-6 py-5 text-lg font-semibold">{t("subject")}</div>
        <ul className="grid px-6 py-2">
          {items.map(([company, role, when]) => (
            <li key={company} className="flex items-center gap-3 border-b py-3 last:border-0">
              <CompanyInitial company={company} locale={locale} />
              <span className="grid min-w-0 flex-1">
                <span className="truncate font-medium">{company}</span>
                <span className="text-muted-foreground truncate text-sm">{role}</span>
              </span>
              <span className="text-primary text-sm font-medium">{when}</span>
            </li>
          ))}
        </ul>
        <div className="px-6 pb-6">
          <span className="bg-primary text-primary-foreground inline-flex rounded-xl px-5 py-2.5 text-sm font-medium">
            {t("open")}
          </span>
        </div>
      </div>
    </div>
  );
}

/** The questions people ask, as an accordion that works without JavaScript. */
export function HomeFaq() {
  const t = useTranslations("Home.faq");
  const keys = ["free", "arabic", "private", "extension", "phone", "data"] as const;
  return (
    <section aria-labelledby="faq-title" className="mx-auto grid w-full max-w-3xl gap-8 px-4 py-20">
      <h2 id="faq-title" className="text-3xl font-semibold tracking-tight sm:text-4xl rtl:font-bold">
        {t("title")}
      </h2>
      <div className="grid">
        {keys.map((key) => (
          <details key={key} className="faq group border-b">
            <summary className="state-layer relative flex cursor-pointer list-none items-center gap-4 rounded-md px-2 py-5 text-lg font-medium focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
              <span className="flex-1">{t(`items.${key}.q`)}</span>
              <Plus aria-hidden className="text-primary size-5 shrink-0 transition-transform group-open:rotate-45" />
            </summary>
            <p className="text-muted-foreground px-2 pb-6 text-pretty">{t(`items.${key}.a`)}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

/** Sekka AI, coming soon: one quiet tonal block linking to the roadmap. */
export function HomeAiTeaser() {
  const t = useTranslations("Site.aiTeaser");
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-12">
      <section
        aria-labelledby="ai-teaser-title"
        className="bg-surface-container-high grid justify-items-start gap-3 rounded-2xl p-6 sm:p-10"
      >
        <span className="bg-primary-container text-primary-container-foreground rounded-sm px-2.5 py-1 text-xs font-medium">
          {t("soon")}
        </span>
        <h2 id="ai-teaser-title" className="text-2xl font-semibold tracking-tight sm:text-3xl rtl:font-bold">
          {t("title")}
        </h2>
        <p className="text-muted-foreground max-w-2xl text-pretty">{t("body")}</p>
        <Link href="/roadmap" className={buttonVariants({ variant: "secondary", className: "mt-2" })}>
          {t("action")}
        </Link>
      </section>
    </div>
  );
}

/** The end of the page: the road's last stretch to the amber yes, and Start free. */
export function HomeFinale() {
  const t = useTranslations("Home");
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pt-8 pb-24">
      <section
        aria-labelledby="finale-title"
        className="bg-primary text-primary-foreground grid justify-items-start gap-5 overflow-hidden rounded-[2rem] px-6 py-12 sm:px-12 sm:py-16"
      >
        <RoadLine className="[&_path:first-child]:stroke-primary-foreground/30 max-w-72" />
        <h2
          id="finale-title"
          className="max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-5xl rtl:font-bold"
        >
          {t("finale.title")}
        </h2>
        <p className="text-primary-foreground/85 max-w-xl text-lg text-pretty">{t("finale.body")}</p>
        <Link
          href="/register"
          className={buttonVariants({ variant: "secondary", size: "xl", className: "mt-2 hover:shadow-md" })}
          data-icon="inline-start"
        >
          <Plus aria-hidden />
          {t("getStarted")}
        </Link>
      </section>
    </div>
  );
}
