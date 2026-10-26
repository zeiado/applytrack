import { ArrowLeft, ArrowRight, ExternalLink, Pencil } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { FollowUpForm, MoveForm } from "@/components/applications/detail-forms";
import { Interviews } from "@/components/applications/interviews";
import { StatusBadge, StatusDot } from "@/components/applications/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { direction, type Locale } from "@/i18n/routing";
import { getApplication, getHistory, getInterviews } from "@/lib/applications/data";
import { followUpState, formatDate, todayIn } from "@/lib/applications/dates";
import type { Application, ApplicationDetail, StatusChange } from "@/lib/applications/model";
import { formatDateTime } from "@/lib/applications/zoned-time";
import { getCurrentUser } from "@/lib/auth/session";

type Props = PageProps<"/[locale]/applications/[id]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Applications" });
  return { title: t("title") };
}

// The application's id is only known per request, so the whole page streams in.
export default function ApplicationPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="bg-muted mx-auto h-96 w-full max-w-4xl animate-pulse rounded-xl" />}>
      <Detail params={params} />
    </Suspense>
  );
}

async function Detail({ params }: { params: Props["params"] }) {
  const { locale, id } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("Detail");
  const [application, history, interviews, user] = await Promise.all([
    getApplication(id),
    getHistory(id),
    getInterviews(id),
    getCurrentUser(),
  ]);
  const timeZone = user?.timezone ?? "Africa/Cairo";
  const today = todayIn(timeZone);
  const Back = direction(locale as Locale) === "rtl" ? ArrowRight : ArrowLeft;

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-6">
      <Link href="/applications" className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1.5 text-sm">
        <Back aria-hidden className="size-4" />
        {t("back")}
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-2xl font-bold wrap-anywhere">{application.company}</h1>
          <p className="text-muted-foreground text-lg">{application.role_title}</p>
          <StatusBadge status={application.status} />
        </div>
        <div className="flex flex-wrap gap-2">
          {application.job_url && (
            <a
              href={application.job_url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className={buttonVariants({ variant: "outline", className: "h-10 gap-1.5" })}
            >
              <ExternalLink aria-hidden />
              {t("jobPost")}
            </a>
          )}
          <Link
            href={`/applications/${application.id}/edit`}
            className={buttonVariants({ variant: "outline", className: "h-10 gap-1.5" })}
          >
            <Pencil aria-hidden />
            {t("edit")}
          </Link>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="grid content-start gap-6">
          <Section title={t("interviews.title")}>
            <Interviews
              applicationId={application.id}
              interviews={interviews}
              timeZone={timeZone}
              now={new Date().toISOString()}
            />
          </Section>
          <Section title={t("jobDescription.title")}>
            <JobDescription application={application} />
          </Section>
          <Section title={t("history.title")}>
            <History history={history} timeZone={timeZone} />
          </Section>
        </div>
        <aside className="grid content-start gap-6">
          <Section title={t("move.title")}>
            <MoveForm application={application} />
          </Section>
          <Section
            title={t("followUp.title")}
            badge={application.follow_up_on ? <FollowUpBadge date={application.follow_up_on} today={today} /> : null}
          >
            <FollowUpForm application={application} />
          </Section>
          <Section title={t("details")}>
            <Details application={application} today={today} />
          </Section>
        </aside>
      </div>
    </div>
  );
}

function Section({ title, badge, children }: { title: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        {title}
        {badge}
      </h2>
      {children}
    </section>
  );
}

async function FollowUpBadge({ date, today }: { date: string; today: string }) {
  const t = await getTranslations("Detail.followUp");
  const state = followUpState(date, today);
  if (state === "upcoming") return null;
  return (
    <span className="bg-destructive/10 text-destructive rounded-full px-2 py-0.5 text-xs font-medium">
      {state === "overdue" ? t("overdue") : t("today")}
    </span>
  );
}

async function JobDescription({ application }: { application: ApplicationDetail }) {
  const t = await getTranslations("Detail.jobDescription");
  if (!application.job_description) {
    return (
      <div className="bg-card grid justify-items-start gap-3 rounded-lg border border-dashed p-4 text-sm">
        <p className="text-muted-foreground">{t("empty")}</p>
        <Link
          href={`/applications/${application.id}/edit`}
          className={buttonVariants({ variant: "outline", className: "h-10 gap-1.5" })}
        >
          <Pencil aria-hidden />
          {t("add")}
        </Link>
      </div>
    );
  }
  return (
    // Long posts scroll inside the box; tabIndex lets keyboard users scroll it too.
    <div
      role="region"
      aria-label={t("label")}
      tabIndex={0}
      className="bg-card focus-visible:ring-ring max-h-96 overflow-y-auto rounded-lg border p-4 text-sm leading-relaxed wrap-anywhere focus-visible:ring-2 focus-visible:outline-none"
    >
      {/* Posts mix Arabic and English: each line takes the direction of its own text. */}
      {application.job_description.split("\n").map((line, index) => (
        <p key={index} dir="auto" className="min-h-[1lh] text-start">
          {line}
        </p>
      ))}
    </div>
  );
}

async function Details({ application, today }: { application: Application; today: string }) {
  const t = await getTranslations("Detail");
  const tSource = await getTranslations("Source");
  const locale = await getLocale();
  const money = new Intl.NumberFormat(locale);
  const { salary_min: min, salary_max: max } = application;
  const salary =
    min !== null && max !== null
      ? t("salaryRange", { min: money.format(min), max: money.format(max) })
      : min !== null
        ? t("salaryFrom", { min: money.format(min) })
        : max !== null
          ? t("salaryUpTo", { max: money.format(max) })
          : t("none");

  return (
    <dl className="bg-card grid gap-3 rounded-lg border p-4 text-sm">
      <Row label={t("source")} value={tSource(application.source)} />
      <Row label={t("applied")} value={application.applied_on ? formatDate(application.applied_on, locale, today) : t("none")} />
      <Row label={t("salary")} value={salary} />
      {application.notes && (
        <div className="grid gap-1">
          <dt className="text-muted-foreground">{t("notes")}</dt>
          {/* Notes may be in either language: each paragraph takes the direction of its text. */}
          <dd dir="auto" className="text-start whitespace-pre-line">
            {application.notes}
          </dd>
        </div>
      )}
    </dl>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-end">{value}</dd>
    </div>
  );
}

async function History({ history, timeZone }: { history: StatusChange[]; timeZone: string }) {
  const t = await getTranslations("Detail.history");
  const tStatus = await getTranslations("Status");
  const locale = await getLocale();
  // Newest first: what happened last is what matters most.
  const changes = [...history].reverse();

  return (
    <ol className="border-border ms-1 grid gap-4 border-s ps-5">
      {changes.map((change, index) => (
        <li key={`${change.changed_at}-${index}`} className="relative grid gap-0.5">
          <StatusDot status={change.to_status} className="ring-background absolute top-1.5 -start-[1.6rem] size-2.5 ring-4" />
          <p className="font-medium">
            {change.from_status
              ? t("moved", { from: tStatus(change.from_status), to: tStatus(change.to_status) })
              : t("created", { status: tStatus(change.to_status) })}
          </p>
          <time dateTime={change.changed_at} className="text-muted-foreground text-xs">
            {formatDateTime(change.changed_at, locale, timeZone)}
          </time>
          {change.note && (
            <p dir="auto" className="text-start text-sm whitespace-pre-line">
              {change.note}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
