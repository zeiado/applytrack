import { Check, ChevronRight, FileText } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { CompanyInitial } from "@/components/applications/company-initial";
import { StatusDot } from "@/components/applications/status-badge";
import { Logo } from "@/components/brand/logo";
import type en from "../../../messages/en.json";

// Static copies of real screens for the public pages, built from the same pieces and colours
// as the app. They're pictures: wrap them in an aria-hidden container next to text that says
// the same thing. The sample companies are made up.

function useDemo() {
  const t = useTranslations();
  const locale = useLocale();
  const demo = (key: keyof typeof en.Home.journey.demo) => t(`Home.journey.demo.${key}`);
  const feature = (key: keyof typeof en.Site.features.demo) => t(`Site.features.demo.${key}`);
  return { t, locale, demo, feature };
}

/** The Chrome extension's popup on a job page, after saving. */
export function SavePreview() {
  const { demo } = useDemo();
  return (
    <div className="bg-card grid gap-4 rounded-2xl border p-4">
      <Logo variant="symbol" className="h-5" />
      <div className="grid gap-0.5">
        <span className="font-semibold">{demo("role")}</span>
        <span className="text-muted-foreground text-sm">
          {demo("company")}, {demo("place")}
        </span>
      </div>
      <span className="bg-primary-container text-primary-container-foreground inline-flex w-fit items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium">
        <Check className="size-4" />
        {demo("saved")}
      </span>
    </div>
  );
}

/** One board column, as on the applications page. */
export function BoardPreview() {
  const { t, locale, demo } = useDemo();
  const cards = [
    [demo("company"), demo("role")],
    [demo("otherCompany"), demo("otherRole")],
  ] as const;
  return (
    <div className="bg-muted grid gap-2.5 rounded-2xl p-3">
      <div className="flex px-1 text-sm">
        <span className="font-semibold">{t("Status.applied")}</span>
        <span className="text-muted-foreground ms-auto">2</span>
      </div>
      {cards.map(([company, role]) => (
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
}

/** An item in the follow-ups inbox, with the "today" chip. */
export function FollowUpPreview() {
  const { t, locale, demo } = useDemo();
  return (
    <div className="bg-card flex items-center gap-3 rounded-xl border p-4">
      <CompanyInitial company={demo("otherCompany")} locale={locale} />
      <div className="grid min-w-0 flex-1">
        <span className="truncate font-semibold">{demo("otherCompany")}</span>
        <span className="text-muted-foreground truncate text-sm">{demo("otherRole")}</span>
      </div>
      <span className="bg-primary-container text-primary-container-foreground shrink-0 rounded-md px-2 py-0.5 text-xs font-medium">
        {t("Applications.card.followUpDue")}
      </span>
    </div>
  );
}

/** The offer banner from the top of the board: the one place amber shows up. */
export function OfferPreview() {
  const { t, demo } = useDemo();
  return (
    <div className="bg-yes text-yes-foreground flex items-center gap-3 rounded-2xl px-4 py-3.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/85">
        <span className="bg-yes size-3 rounded-full" />
      </span>
      <span className="grid min-w-0 flex-1 gap-px">
        <span className="truncate font-semibold">{t("Applications.offer.title", { company: demo("company") })}</span>
        <span className="truncate text-sm">{demo("role")}</span>
      </span>
      <ChevronRight className="size-5 shrink-0 rtl:-scale-x-100" />
    </div>
  );
}

/** An application's interviews, as on its page. */
export function InterviewsPreview() {
  const { t, demo, feature } = useDemo();
  const rows = [
    ["interviewing", feature("interview"), feature("interviewWhen")],
    ["screening", feature("screening"), feature("screeningWhen")],
  ] as const;
  return (
    <div className="bg-card grid gap-3 rounded-2xl border p-4">
      <div className="grid gap-0.5">
        <span className="font-semibold">{demo("company")}</span>
        <span className="text-muted-foreground text-sm">{demo("role")}</span>
      </div>
      <ul className="grid gap-2 border-t pt-3">
        {rows.map(([status, name, when]) => (
          <li key={name} className="flex items-center gap-2 text-sm">
            <StatusDot status={status} />
            <span className="font-medium">{name}</span>
            <span className="text-muted-foreground ms-auto">{when}</span>
          </li>
        ))}
      </ul>
      <span className="text-primary inline-flex items-center gap-1.5 text-sm font-medium">
        <FileText className="size-4" />
        {t("Detail.jobDescription.title")}
      </span>
    </div>
  );
}

/** The stats funnel, with sample numbers. */
export function StatsPreview() {
  const { t } = useDemo();
  const rows = [
    ["applied", 100],
    ["responded", 45],
    ["interviewed", 25],
    ["offers", 10],
  ] as const;
  return (
    <div className="bg-card grid gap-3 rounded-2xl border p-4">
      <span className="font-semibold">{t("Stats.funnel.title")}</span>
      {rows.map(([key, value]) => (
        <div key={key} className="grid gap-1.5">
          <div className="flex text-sm">
            <span>{t(`Stats.funnel.${key}`)}</span>
            <span className="text-muted-foreground ms-auto tabular-nums">{value}%</span>
          </div>
          <div className="bg-muted h-2 overflow-hidden rounded-full">
            <div className="bg-primary h-full rounded-full" style={{ width: `${value}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A CV in the list on the profile page. */
export function CvPreview() {
  const { t, feature } = useDemo();
  return (
    <div className="bg-card flex items-center gap-3 rounded-xl border p-4">
      <span className="bg-primary-container text-primary-container-foreground flex size-10 shrink-0 items-center justify-center rounded-lg">
        <FileText className="size-5" />
      </span>
      <div className="grid min-w-0 flex-1">
        <span className="truncate font-semibold" dir="ltr">
          {feature("cv")}
        </span>
        <span className="text-muted-foreground text-sm">{feature("cvWhen")}</span>
      </div>
      <span className="border-input text-primary shrink-0 rounded-full border px-3 py-1 text-sm font-medium">
        {t("Cvs.download")}
      </span>
    </div>
  );
}
