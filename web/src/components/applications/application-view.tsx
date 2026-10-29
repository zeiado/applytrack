import { ExternalLink, Pencil } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { FollowUpForm, MoveForm } from "@/components/applications/detail-forms";
import { InlineField } from "@/components/applications/inline-field";
import { Interviews } from "@/components/applications/interviews";
import { StatusBadge, StatusDot } from "@/components/applications/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getApplication, getHistory, getInterviews } from "@/lib/applications/data";
import { followUpState, formatDate, todayIn } from "@/lib/applications/dates";
import { type ApplicationDetail, SOURCES, type StatusChange } from "@/lib/applications/model";
import { formatDateTime } from "@/lib/applications/zoned-time";
import { getCurrentUser } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

import { PeekTitle } from "./peek-sheet";

/**
 * Everything about one application, Notion style: the company and role as the title, a list
 * of properties you edit in place, then the next step, the follow-up, interviews, the job
 * description and the history. The same view is the side panel on the board (`panel`) and
 * the application's own page (`page`).
 */
export async function ApplicationView({ id, variant }: { id: string; variant: "page" | "panel" }) {
  const t = await getTranslations("Detail");
  const [application, history, interviews, user] = await Promise.all([
    getApplication(id),
    getHistory(id),
    getInterviews(id),
    getCurrentUser(),
  ]);
  const timeZone = user?.timezone ?? "Africa/Cairo";
  const today = todayIn(timeZone);

  return (
    <article className="grid gap-8">
      <header className="grid gap-3">
        <Title variant={variant}>
          <InlineField
            applicationId={application.id}
            field="company"
            label={t("company")}
            kind="text"
            values={{ value: application.company }}
            display={application.company}
            title
          />
        </Title>
        <div className="text-muted-foreground -mt-2 text-lg">
          <InlineField
            applicationId={application.id}
            field="role_title"
            label={t("role")}
            kind="text"
            values={{ value: application.role_title }}
            display={application.role_title}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {application.job_url && (
            <a
              href={application.job_url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className={buttonVariants({ variant: "outline", size: "sm" })}
              data-icon="inline-start"
            >
              <ExternalLink aria-hidden />
              {t("jobPost")}
            </a>
          )}
          <Link
            href={`/applications/${application.id}/edit`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
            data-icon="inline-start"
          >
            <Pencil aria-hidden />
            {t("edit")}
          </Link>
        </div>
      </header>

      <Properties application={application} today={today} />

      <div className={cn("grid gap-8", variant === "page" && "sm:grid-cols-2")}>
        <Section title={t("move.title")}>
          <MoveForm application={application} />
        </Section>
        <Section
          title={t("followUp.title")}
          badge={application.follow_up_on ? <FollowUpBadge date={application.follow_up_on} today={today} /> : null}
        >
          <FollowUpForm application={application} />
        </Section>
      </div>

      <Section title={t("interviews.title")}>
        <Interviews applicationId={application.id} interviews={interviews} timeZone={timeZone} now={new Date().toISOString()} />
      </Section>
      <Section title={t("jobDescription.title")}>
        <JobDescription application={application} />
      </Section>
      <Section title={t("history.title")}>
        <History history={history} timeZone={timeZone} surface={variant === "panel" ? "card" : "background"} />
      </Section>
    </article>
  );
}

/** The company, as the page's h1; in the side panel it also names the dialog. */
function Title({ variant, children }: { variant: "page" | "panel"; children: React.ReactNode }) {
  const className = "wrap-anywhere";
  return variant === "panel" ? <PeekTitle className={className}>{children}</PeekTitle> : <h1 className={className}>{children}</h1>;
}

/** The properties list: a label at the start, the value (click to edit) at the end. */
async function Properties({ application, today }: { application: ApplicationDetail; today: string }) {
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
          : "";
  const common = { applicationId: application.id };

  const rows: { label: string; value: React.ReactNode }[] = [
    {
      label: t("status"),
      value: (
        <span className="flex py-1">
          <StatusBadge status={application.status} />
        </span>
      ),
    },
    {
      label: t("source"),
      value: (
        <InlineField
          {...common}
          field="source"
          label={t("source")}
          kind="select"
          values={{ value: application.source }}
          display={tSource(application.source)}
          options={SOURCES.map((source) => ({ value: source, label: tSource(source) }))}
        />
      ),
    },
    {
      label: t("applied"),
      value: (
        <InlineField
          {...common}
          field="applied_on"
          label={t("applied")}
          kind="date"
          values={{ value: application.applied_on ?? "" }}
          display={application.applied_on ? formatDate(application.applied_on, locale, today) : ""}
        />
      ),
    },
    {
      label: t("jobLink"),
      value: (
        <InlineField
          {...common}
          field="job_url"
          label={t("jobLink")}
          kind="url"
          values={{ value: application.job_url ?? "" }}
          display={application.job_url ? hostOf(application.job_url) : ""}
        />
      ),
    },
    {
      label: t("salary"),
      value: (
        <InlineField
          {...common}
          field="salary"
          label={t("salary")}
          kind="salary"
          values={{ min: min === null ? "" : String(min), max: max === null ? "" : String(max) }}
          display={salary}
        />
      ),
    },
    {
      label: t("notes"),
      value: (
        <InlineField
          {...common}
          field="notes"
          label={t("notes")}
          kind="textarea"
          values={{ value: application.notes ?? "" }}
          display={application.notes ?? ""}
        />
      ),
    },
  ];

  return (
    <section aria-label={t("details")}>
      <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[9rem_minmax(0,1fr)]">
        {rows.map(({ label, value }) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground pt-1.5 sm:py-1.5">{label}</dt>
            <dd className="min-w-0 pb-2 sm:pb-0">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** "jobs.example.com" for a job link: short enough to read in the list. */
function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function Section({ title, badge, children }: { title: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="grid content-start gap-3">
      <h2 className="flex items-center gap-2 text-base font-semibold">
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
  // Calm on purpose: a late follow-up isn't an error.
  return (
    <span className="bg-primary-container text-primary-container-foreground rounded-md px-2 py-0.5 text-xs font-medium">
      {state === "overdue" ? t("overdue") : t("today")}
    </span>
  );
}

async function JobDescription({ application }: { application: ApplicationDetail }) {
  const t = await getTranslations("Detail.jobDescription");
  if (!application.job_description) {
    return (
      <div className="grid justify-items-start gap-3 rounded-xl border border-dashed p-4 text-sm">
        <p className="text-muted-foreground">{t("empty")}</p>
        <Link
          href={`/applications/${application.id}/edit`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
          data-icon="inline-start"
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
      className="bg-surface-container-low focus-visible:ring-ring max-h-96 overflow-y-auto rounded-xl p-4 text-sm leading-relaxed wrap-anywhere focus-visible:ring-2 focus-visible:outline-none"
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

async function History({
  history,
  timeZone,
  surface,
}: {
  history: StatusChange[];
  timeZone: string;
  /** What the timeline sits on, so each dot's ring covers the line behind it. */
  surface: "card" | "background";
}) {
  const t = await getTranslations("Detail.history");
  const tStatus = await getTranslations("Status");
  const locale = await getLocale();
  // Newest first: what happened last is what matters most.
  const changes = [...history].reverse();

  return (
    <ol className="border-border ms-1 grid gap-4 border-s ps-5">
      {changes.map((change, index) => (
        <li key={`${change.changed_at}-${index}`} className="relative grid gap-0.5">
          <StatusDot status={change.to_status} className={cn("absolute top-1.5 -start-[1.6rem] size-2.5 ring-4", surface === "card" ? "ring-card" : "ring-background")} />
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
