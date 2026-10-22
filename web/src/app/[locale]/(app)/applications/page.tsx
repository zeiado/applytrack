import { ChevronRight, KanbanSquare, List as ListIcon, Plus } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { Board } from "@/components/applications/board";
import { RoadLine } from "@/components/brand/road";
import { ListView } from "@/components/applications/list-view";
import { VerifyBanner } from "@/components/auth/verify-banner";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { allApplications, listApplications } from "@/lib/applications/data";
import { todayIn } from "@/lib/applications/dates";
import { type Application, STATUSES } from "@/lib/applications/model";
import { parseListQuery } from "@/lib/applications/query";
import { getCurrentUser } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/[locale]/applications">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Applications" });
  return { title: t("title") };
}

export default async function ApplicationsPage({ params, searchParams }: PageProps<"/[locale]/applications">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("Applications");

  return (
    <>
      <div className="flex items-center gap-2.5">
        <h1 className="flex-1 text-2xl font-semibold">{t("title")}</h1>
        {/* A square icon button on phones, with its words from `sm` up. */}
        <Link
          href="/applications/new"
          aria-label={t("add")}
          className={buttonVariants({ className: "size-11 gap-1.5 rounded-xl p-0 sm:h-10 sm:w-auto sm:px-4" })}
        >
          <Plus aria-hidden className="size-5 sm:size-4" />
          <span className="sr-only sm:not-sr-only">{t("add")}</span>
        </Link>
      </div>
      {/* The session and the URL are only known per request: everything below streams in. */}
      <Suspense fallback={<Loading />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Content({ searchParams }: { searchParams: PageProps<"/[locale]/applications">["searchParams"] }) {
  const params = await searchParams;
  const view = params.view === "list" ? "list" : "board";
  const user = await getCurrentUser();
  const today = todayIn(user?.timezone ?? "Africa/Cairo");

  return (
    <>
      {user && !user.email_verified && <VerifyBanner email={user.email} />}
      <ViewTabs view={view} />
      {view === "list" ? <List params={params} today={today} /> : <BoardView today={today} />}
    </>
  );
}

async function BoardView({ today }: { today: string }) {
  const t = await getTranslations("Applications");
  const { items, truncated } = await allApplications();
  if (items.length === 0) return <Empty />;
  return (
    <>
      <OfferBanner applications={items} />
      <StageChips applications={items} />
      {truncated && <p className="text-muted-foreground text-sm">{t("truncated")}</p>}
      <Board applications={items} today={today} />
    </>
  );
}

/** Good news first: the newest application with an offer, linking to its page. */
async function OfferBanner({ applications }: { applications: Application[] }) {
  const offer = applications
    .filter((app) => app.status === "offer")
    .reduce<Application | null>((newest, app) => (!newest || app.updated_at > newest.updated_at ? app : newest), null);
  if (!offer) return null;
  const t = await getTranslations("Applications.offer");
  return (
    <Link
      href={`/applications/${offer.id}`}
      className="bg-yes text-yes-foreground flex items-center gap-3 rounded-2xl px-4 py-3.5 hover:brightness-[1.03]"
    >
      <span aria-hidden className="flex size-9 shrink-0 bg-white/85 items-center justify-center rounded-full">
        <span className="bg-yes size-3 rounded-full" />
      </span>
      <span className="grid min-w-0 flex-1 gap-px">
        <span className="truncate font-semibold">{t("title", { company: offer.company })}</span>
        <span className="truncate text-sm">{offer.role_title}</span>
      </span>
      <ChevronRight aria-hidden className="size-5 shrink-0 rtl:-scale-x-100" />
    </Link>
  );
}

/** Phones show one column at a time: these jump to a stage's column (no JS needed). */
async function StageChips({ applications }: { applications: Application[] }) {
  const t = await getTranslations();
  return (
    <nav aria-label={t("Applications.columns")} className="-mx-4 overflow-x-auto px-4 md:hidden">
      <ul className="flex w-max gap-2">
        {STATUSES.map((status) => (
          <li key={status}>
            <a
              href={`#column-${status}`}
              className="bg-card hover:bg-accent inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm whitespace-nowrap"
            >
              {t(`Status.${status}`)}
              <span className="text-muted-foreground tabular-nums">
                {applications.filter((app) => app.status === status).length}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

async function List({ params, today }: { params: Record<string, string | string[] | undefined>; today: string }) {
  const query = parseListQuery(params);
  const page = await listApplications(query);
  return <ListView query={query} page={page} today={today} />;
}

async function ViewTabs({ view }: { view: "board" | "list" }) {
  const t = await getTranslations("Applications");
  const tab = (active: boolean) =>
    cn(
      "inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium",
      active ? "bg-background shadow-xs" : "text-muted-foreground hover:text-foreground",
    );
  return (
    <nav aria-label={t("views")} className="bg-muted inline-flex w-fit gap-1 rounded-lg p-1">
      <Link href="/applications" className={tab(view === "board")} aria-current={view === "board" ? "page" : undefined}>
        <KanbanSquare aria-hidden className="size-4" />
        {t("board")}
      </Link>
      <Link
        href="/applications?view=list"
        className={tab(view === "list")}
        aria-current={view === "list" ? "page" : undefined}
      >
        <ListIcon aria-hidden className="size-4" />
        {t("list")}
      </Link>
    </nav>
  );
}

async function Empty() {
  const t = await getTranslations("Applications");
  return (
    <section className="bg-card grid justify-items-center gap-3 rounded-2xl border px-6 py-12 text-center">
      <RoadLine className="mb-2 max-w-48" />
      <h2 className="text-lg font-semibold">{t("empty.title")}</h2>
      <p className="text-muted-foreground max-w-md">{t("empty.body")}</p>
      <Link href="/applications/new" className={buttonVariants({ className: "h-10 gap-1.5 px-4" })}>
        <Plus aria-hidden />
        {t("add")}
      </Link>
    </section>
  );
}

function Loading() {
  return (
    <div className="flex gap-3 overflow-hidden" aria-busy>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="bg-muted h-64 w-[300px] shrink-0 animate-pulse rounded-2xl" />
      ))}
    </div>
  );
}
