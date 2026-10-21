import { KanbanSquare, List as ListIcon, Plus } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { Board } from "@/components/applications/board";
import { ListView } from "@/components/applications/list-view";
import { VerifyBanner } from "@/components/auth/verify-banner";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { allApplications, listApplications } from "@/lib/applications/data";
import { todayIn } from "@/lib/applications/dates";
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <Link href="/applications/new" className={buttonVariants({ className: "h-10 gap-1.5 px-4" })}>
          <Plus aria-hidden />
          {t("add")}
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
      {truncated && <p className="text-muted-foreground text-sm">{t("truncated")}</p>}
      <Board applications={items} today={today} />
    </>
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
    <section className="grid justify-items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
      <KanbanSquare aria-hidden className="text-primary size-10" />
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
        <div key={i} className="bg-muted h-64 w-72 shrink-0 animate-pulse rounded-xl" />
      ))}
    </div>
  );
}
