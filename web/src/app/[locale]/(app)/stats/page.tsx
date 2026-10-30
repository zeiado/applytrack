import { BarChart3, Download, Plus } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { buttonVariants } from "@/components/ui/button";
import { CountUp } from "@/components/stats/count-up";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getStats } from "@/lib/applications/data";
import type { Stats } from "@/lib/applications/model";

export async function generateMetadata({ params }: PageProps<"/[locale]/stats">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: locale as Locale,
    namespace: "Stats",
  });
  return { title: t("title") };
}

export default async function StatsPage({ params }: PageProps<"/[locale]/stats">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("Stats");

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        {/* A plain link: it's a file from a route handler, not a page. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/api/applications/export"
          className={buttonVariants({
            variant: "outline",
            className: "h-10 gap-1.5",
          })}
        >
          <Download aria-hidden />
          {t("exportCsv")}
        </a>
      </div>
      <Suspense fallback={<div className="bg-muted h-96 animate-pulse rounded-xl" />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const t = await getTranslations("Stats");
  const locale = await getLocale();
  const stats = await getStats();

  if (stats.total === 0) {
    return (
      <section className="grid justify-items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
        <BarChart3 aria-hidden className="text-primary size-10" />
        <h2 className="text-lg font-semibold">{t("empty.title")}</h2>
        <p className="text-muted-foreground max-w-md">{t("empty.body")}</p>
        <Link href="/applications/new" className={buttonVariants({ className: "h-10 gap-1.5 px-4" })}>
          <Plus aria-hidden />
          {t("empty.action")}
        </Link>
      </section>
    );
  }

  const percent = new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 0,
  });
  const number = new Intl.NumberFormat(locale);
  const rate = (value: number | null) => (value === null ? "—" : percent.format(value));
  const { funnel, rates } = stats;

  return (
    <>
      <section aria-labelledby="stats-summary" className="grid gap-3">
        <h2 id="stats-summary" className="sr-only">
          {t("summary")}
        </h2>
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile
            label={t("tiles.total")}
            value={number.format(stats.total)}
            note={t("tiles.applied", { count: funnel.applied })}
          />
          <Tile
            label={t("tiles.responseRate")}
            value={rate(rates.response_rate)}
            note={t("tiles.of", {
              count: funnel.responded,
              total: funnel.applied,
            })}
          />
          <Tile
            label={t("tiles.interviewRate")}
            value={rate(rates.interview_rate)}
            note={t("tiles.of", {
              count: funnel.interviewed,
              total: funnel.applied,
            })}
          />
          <Tile
            label={t("tiles.offerRate")}
            value={rate(rates.offer_rate)}
            note={t("tiles.of", {
              count: funnel.offers,
              total: funnel.applied,
            })}
          />
        </dl>
      </section>

      <Funnel funnel={funnel} number={number} percent={percent} />
      <BySource stats={stats} number={number} rate={rate} />
      <TimeInStage stats={stats} locale={locale} />
    </>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="bg-card grid gap-1 rounded-xl border p-4">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="text-3xl font-semibold tabular-nums">
        <CountUp value={value} />
      </dd>
      <dd className="text-muted-foreground text-xs">{note}</dd>
    </div>
  );
}

function Card({ id, title, note, children }: { id: string; title: string; note?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="bg-card grid gap-4 rounded-xl border p-4 sm:p-5">
      <div className="grid gap-1">
        <h2 id={id} className="text-lg font-semibold">
          {title}
        </h2>
        {note && <p className="text-muted-foreground text-sm">{note}</p>}
      </div>
      {children}
    </section>
  );
}

/** One labelled horizontal bar. It grows from the start edge, so it flips in Arabic. */
function Bar({ label, value, share }: { label: string; value: string; share: number }) {
  return (
    <li className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground tabular-nums">{value}</span>
      </div>
      <div className="bg-muted h-3 rounded-sm">
        <div
          className="bar-grow bg-primary h-full rounded-e-sm"
          // At least a sliver for anything above zero, so it doesn't read as none.
          style={{
            width: share > 0 ? `max(${(share * 100).toFixed(1)}%, 4px)` : 0,
          }}
        />
      </div>
    </li>
  );
}

async function Funnel({
  funnel,
  number,
  percent,
}: {
  funnel: Stats["funnel"];
  number: Intl.NumberFormat;
  percent: Intl.NumberFormat;
}) {
  const t = await getTranslations("Stats.funnel");
  const steps = (["applied", "responded", "interviewed", "offers", "accepted"] as const).map((step) => ({
    step,
    count: funnel[step],
  }));
  const base = funnel.applied;

  return (
    <Card id="stats-funnel" title={t("title")} note={t("note")}>
      {base === 0 ? (
        <p className="text-muted-foreground text-sm">{t("none")}</p>
      ) : (
        <ul className="grid gap-4">
          {steps.map(({ step, count }) => (
            <Bar
              key={step}
              label={t(step)}
              value={
                step === "applied" ? number.format(count) : `${number.format(count)} · ${percent.format(count / base)}`
              }
              share={count / base}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}

async function BySource({
  stats,
  number,
  rate,
}: {
  stats: Stats;
  number: Intl.NumberFormat;
  rate: (value: number | null) => string;
}) {
  const t = await getTranslations("Stats.bySource");
  const tSource = await getTranslations("Source");
  const rows = [...stats.by_source].sort((a, b) => b.applications - a.applications);
  const columns = ["applications", "applied", "interviewed", "offers"] as const;

  return (
    <Card id="stats-sources" title={t("title")} note={t("note")}>
      <div className="-mx-4 overflow-x-auto sm:mx-0">
        <table className="w-full text-sm">
          <thead className="text-muted-foreground">
            <tr className="border-b">
              <th scope="col" className="px-4 py-2 text-start font-medium sm:ps-0">
                {t("source")}
              </th>
              {columns.map((column) => (
                <th key={column} scope="col" className="px-3 py-2 text-end font-medium">
                  {t(column)}
                </th>
              ))}
              <th scope="col" className="px-4 py-2 text-end font-medium sm:pe-0">
                {t("offerRate")}
              </th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map((row) => (
              <tr key={row.source} className="border-b last:border-0">
                <th scope="row" className="px-4 py-2 text-start font-medium sm:ps-0">
                  {tSource(row.source)}
                </th>
                {columns.map((column) => (
                  <td key={column} className="px-3 py-2 text-end">
                    {number.format(row[column])}
                  </td>
                ))}
                <td className="px-4 py-2 text-end sm:pe-0">{rate(row.offer_rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

async function TimeInStage({ stats, locale }: { stats: Stats; locale: string }) {
  const t = await getTranslations("Stats.timeInStage");
  const tStatus = await getTranslations("Status");
  const stages = stats.days_in_stage;
  const days = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const longest = Math.max(0, ...stages.map((s) => s.average_days));

  return (
    <Card id="stats-time" title={t("title")} note={t("note")}>
      {stages.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("none")}</p>
      ) : (
        <ul className="grid gap-4">
          {stages.map((stage) => (
            <Bar
              key={stage.status}
              label={tStatus(stage.status)}
              value={t("days", {
                days: days.format(stage.average_days),
                count: stage.stays,
              })}
              share={longest > 0 ? stage.average_days / longest : 0}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}
