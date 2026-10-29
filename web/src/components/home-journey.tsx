import { Check, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { CompanyInitial } from "@/components/applications/company-initial";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type en from "../../messages/en.json";

const STEPS = ["save", "track", "followUp", "yes"] as const;
type Step = (typeof STEPS)[number];

/** Below the hero: the road keeps going down the page, one stop per step of a job search,
 * each next to a small, static copy of the screen it happens on. It ends at the amber "yes". */
export function HomeJourney() {
  const t = useTranslations("Home.journey");
  const tHome = useTranslations("Home");

  return (
    <section aria-labelledby="journey-title" className="mx-auto w-full max-w-7xl px-4 pb-24">
      <h2
        id="journey-title"
        className="mb-12 max-w-xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl rtl:font-bold"
      >
        {t("title")}
      </h2>
      <ol>
        {STEPS.map((step, index) => {
          const last = index === STEPS.length - 1;
          return (
            <li
              key={step}
              className="relative grid gap-5 ps-14 pb-16 last:pb-0 md:grid-cols-[minmax(0,26rem)_minmax(0,34rem)] md:gap-16 lg:gap-24"
            >
              {/* The road: a thick teal track with a dashed centre line, as in the hero. It runs
                  into the next stop, so the steps read as one road. */}
              {!last && (
                <span aria-hidden className="bg-primary absolute start-[13px] top-3 -bottom-3 w-3 rounded-full">
                  <span className="absolute inset-y-2 inset-x-0 mx-auto w-0.5 bg-[repeating-linear-gradient(to_bottom,var(--background)_0_6px,transparent_6px_12px)]" />
                </span>
              )}
              <span
                aria-hidden
                className={cn(
                  "absolute top-1 z-10 rounded-full",
                  last ? "bg-yes start-[3px] size-8" : "border-primary bg-background start-[5px] size-7 border-[6px]",
                )}
              />
              <div className="grid content-start gap-2 pt-1">
                <h3 className="text-xl font-semibold">{t(`steps.${step}.title`)}</h3>
                <p className="text-muted-foreground max-w-md text-pretty">{t(`steps.${step}.body`)}</p>
              </div>
              {/* A picture of the screen, so hidden from screen readers: the text says it all. */}
              <div aria-hidden className="max-w-md select-none md:max-w-none">
                <Preview step={step} />
              </div>
            </li>
          );
        })}
      </ol>
      <div className="mt-20 grid justify-items-start gap-6 border-t pt-12">
        <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl rtl:font-bold">{t("cta")}</h2>
        <Link href="/register" className={cn(buttonVariants(), "h-14 rounded-2xl px-7 text-lg")}>
          {tHome("getStarted")}
        </Link>
      </div>
    </section>
  );
}

/** Static copies of real screens, built from the same pieces and colours as the app. */
function Preview({ step }: { step: Step }) {
  const t = useTranslations();
  const locale = useLocale();
  const demo = (key: keyof typeof en.Home.journey.demo) => t(`Home.journey.demo.${key}`);

  switch (step) {
    case "save":
      // The Chrome extension's popup on a job page.
      return (
        <div className="bg-card grid gap-4 rounded-2xl border p-4">
          <Logo variant="symbol" className="h-5" />
          <div className="grid gap-0.5">
            <span className="font-semibold">{demo("role")}</span>
            <span className="text-muted-foreground text-sm">
              {demo("company")}, {demo("place")}
            </span>
          </div>
          <span className="bg-primary/10 text-primary inline-flex w-fit items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium">
            <Check className="size-4" />
            {demo("saved")}
          </span>
        </div>
      );
    case "track":
      // One board column, as on the applications page.
      return (
        <div className="bg-muted grid gap-2.5 rounded-2xl p-3">
          <div className="flex px-1 text-sm">
            <span className="font-semibold">{t("Status.applied")}</span>
            <span className="text-muted-foreground ms-auto">2</span>
          </div>
          {(
            [
              [demo("company"), demo("role")],
              [demo("otherCompany"), demo("otherRole")],
            ] as const
          ).map(([company, role]) => (
            <div key={company} className="bg-card grid gap-2 rounded-xl border p-3.5">
              <div className="flex items-center gap-2.5">
                <CompanyInitial company={company} locale={locale} />
                <div className="grid min-w-0">
                  <span className="truncate font-semibold">{company}</span>
                  <span className="text-muted-foreground truncate text-[0.8125rem]">{role}</span>
                </div>
              </div>
              <span className="text-muted-foreground text-xs">{demo("applied")}</span>
            </div>
          ))}
        </div>
      );
    case "followUp":
      // An item in the follow-ups inbox, with the calm teal "today" chip.
      return (
        <div className="bg-card flex items-center gap-3 rounded-xl border p-4">
          <CompanyInitial company={demo("otherCompany")} locale={locale} />
          <div className="grid min-w-0 flex-1">
            <span className="truncate font-semibold">{demo("otherCompany")}</span>
            <span className="text-muted-foreground truncate text-sm">{demo("otherRole")}</span>
          </div>
          <span className="bg-primary/10 text-primary shrink-0 rounded-md px-2 py-0.5 text-xs font-medium">
            {t("Applications.card.followUpDue")}
          </span>
        </div>
      );
    case "yes":
      // The offer banner from the top of the board: the one place amber shows up.
      return (
        <div className="bg-yes text-yes-foreground flex items-center gap-3 rounded-2xl px-4 py-3.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/85">
            <span className="bg-yes size-3 rounded-full" />
          </span>
          <span className="grid min-w-0 flex-1 gap-px">
            <span className="truncate font-semibold">
              {t("Applications.offer.title", { company: demo("company") })}
            </span>
            <span className="truncate text-sm">{demo("role")}</span>
          </span>
          <ChevronRight className="size-5 shrink-0 rtl:-scale-x-100" />
        </div>
      );
  }
}
