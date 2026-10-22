import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { RoadLine } from "@/components/brand/road";
import { FollowUpItem } from "@/components/follow-ups/follow-up-item";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getDueReminders } from "@/lib/applications/data";
import { formatDate } from "@/lib/applications/dates";
import type { DueReminder } from "@/lib/applications/model";
import { getCurrentUser } from "@/lib/auth/session";

/** How far ahead "coming up" looks. */
const AHEAD_DAYS = 7;

export async function generateMetadata({ params }: PageProps<"/[locale]/follow-ups">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: locale as Locale,
    namespace: "FollowUps",
  });
  return { title: t("title") };
}

export default async function FollowUpsPage({ params }: PageProps<"/[locale]/follow-ups">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("FollowUps");

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </div>
      {/* The session and "today" (in the user's timezone) are per request. */}
      <Suspense fallback={<div className="bg-muted h-64 animate-pulse rounded-2xl" />}>
        <Inbox />
      </Suspense>
    </div>
  );
}

async function Inbox() {
  const t = await getTranslations("FollowUps");
  const locale = await getLocale();
  const user = await getCurrentUser();
  const { items, today } = await getDueReminders(user?.timezone ?? "Africa/Cairo", AHEAD_DAYS);

  if (items.length === 0) {
    return (
      <section className="bg-card grid justify-items-center gap-3 rounded-2xl border px-6 py-12 text-center">
        <RoadLine className="mb-2 max-w-48" />
        <h2 className="text-lg font-semibold">{t("empty.title")}</h2>
        <p className="text-muted-foreground max-w-md">{t("empty.body")}</p>
        <Link
          href="/applications"
          className={buttonVariants({
            variant: "outline",
            className: "h-10 px-4",
          })}
        >
          {t("empty.action")}
        </Link>
      </section>
    );
  }

  const groups = [
    { key: "overdue", items: items.filter((r) => r.days_overdue > 0) },
    { key: "today", items: items.filter((r) => r.days_overdue === 0) },
    { key: "upcoming", items: items.filter((r) => r.days_overdue < 0) },
  ] as const;

  return (
    <>
      {groups.map(
        ({ key, items: group }) =>
          group.length > 0 && (
            <Group
              key={key}
              title={t(`groups.${key}`, {
                count: group.length,
                days: AHEAD_DAYS,
              })}
              items={group}
              today={today}
              locale={locale}
            />
          ),
      )}
    </>
  );
}

function Group({
  title,
  items,
  today,
  locale,
}: {
  title: string;
  items: DueReminder[];
  today: string;
  locale: string;
}) {
  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <ul className="grid gap-2">
        {items.map((reminder) => (
          <FollowUpItem
            key={reminder.application_id}
            reminder={reminder}
            today={today}
            date={formatDate(reminder.follow_up_on, locale, today)}
          />
        ))}
      </ul>
    </section>
  );
}
