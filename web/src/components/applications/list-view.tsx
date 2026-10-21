import Form from "next/form";
import { getLocale, getTranslations } from "next-intl/server";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { followUpState, formatDate } from "@/lib/applications/dates";
import { type Application, SORTS, SOURCES, STATUSES } from "@/lib/applications/model";
import { hasFilters, type ListQuery, PAGE_SIZE, toSearch } from "@/lib/applications/query";
import { cn } from "@/lib/utils";

import { NativeSelect } from "./native-select";
import { StatusBadge, StatusDot } from "./status-badge";

type Page = { items: Application[]; total: number };

/** The list: filters (a plain GET form, so a filtered list is a URL), then the
 * results as a table on wide screens and as cards on phones, then page links. */
export async function ListView({ query, page, today }: { query: ListQuery; page: Page; today: string }) {
  const t = await getTranslations("Applications");
  const locale = await getLocale();
  const pages = Math.max(1, Math.ceil(page.total / PAGE_SIZE));

  return (
    <div className="grid gap-4">
      <Filters query={query} />
      <p className="text-muted-foreground text-sm" role="status">
        {t("count", { count: page.total })}
      </p>
      {page.items.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border border-dashed p-8 text-center">{t("noMatches")}</p>
      ) : (
        <>
          <Table items={page.items} today={today} locale={locale} />
          <ul className="grid gap-2 md:hidden">
            {page.items.map((app) => (
              <li key={app.id}>
                <Link
                  href={`/applications/${app.id}/edit`}
                  className="bg-card hover:bg-muted/50 grid gap-1 rounded-lg border p-3"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold">{app.company}</span>
                    <StatusBadge status={app.status} />
                  </span>
                  <span className="text-muted-foreground truncate text-sm">{app.role_title}</span>
                  {app.applied_on && (
                    <span className="text-muted-foreground text-xs">
                      {t("card.applied", { date: formatDate(app.applied_on, locale, today) })}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      {pages > 1 && (
        <nav aria-label={t("pagination")} className="flex items-center justify-between gap-2">
          <PageLink query={query} page={query.page - 1} disabled={query.page <= 1}>
            {t("previous")}
          </PageLink>
          <span className="text-muted-foreground text-sm">{t("page", { page: query.page, pages })}</span>
          <PageLink query={query} page={query.page + 1} disabled={query.page >= pages}>
            {t("next")}
          </PageLink>
        </nav>
      )}
    </div>
  );
}

async function Filters({ query }: { query: ListQuery }) {
  const t = await getTranslations("Applications");
  const tStatus = await getTranslations("Status");
  const tSource = await getTranslations("Source");
  const locale = await getLocale();

  return (
    <Form action={`/${locale}/applications`} className="bg-card grid gap-4 rounded-xl border p-4">
      <input type="hidden" name="view" value="list" />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="company">{t("filters.company")}</Label>
          <Input
            id="company"
            name="company"
            type="search"
            defaultValue={query.company}
            placeholder={t("filters.companyPlaceholder")}
            className="h-10"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="source">{t("filters.source")}</Label>
          <NativeSelect id="source" name="source" defaultValue={query.source ?? ""}>
            <option value="">{t("filters.anySource")}</option>
            {SOURCES.map((source) => (
              <option key={source} value={source}>
                {tSource(source)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="sort">{t("filters.sort")}</Label>
          <NativeSelect id="sort" name="sort" defaultValue={query.sort}>
            {SORTS.map((sort) => (
              <option key={sort} value={sort}>
                {t(`sort.${sort}`)}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">{t("filters.status")}</legend>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((status) => (
            <label
              key={status}
              className="has-checked:border-primary has-checked:bg-primary/10 flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm"
            >
              <input
                type="checkbox"
                name="status"
                value={status}
                defaultChecked={query.statuses.includes(status)}
                className="accent-primary"
              />
              <StatusDot status={status} />
              {tStatus(status)}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" className="h-10 px-5">
          {t("filters.apply")}
        </Button>
        {hasFilters(query) && (
          <Link href="/applications?view=list" className="text-primary text-sm hover:underline">
            {t("filters.clear")}
          </Link>
        )}
      </div>
    </Form>
  );
}

async function Table({ items, today, locale }: { items: Application[]; today: string; locale: string }) {
  const t = await getTranslations("Applications");
  const tSource = await getTranslations("Source");
  const date = (value: string | null) => (value ? formatDate(value, locale, today) : "—");

  return (
    <div className="hidden overflow-x-auto rounded-xl border md:block">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-muted-foreground text-start">
          <tr>
            {(["company", "role", "status", "applied", "followUp", "source"] as const).map((column) => (
              <th key={column} scope="col" className="px-3 py-2 text-start font-medium">
                {t(`table.${column}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((app) => (
            <tr key={app.id} className="hover:bg-muted/30 border-t">
              <td className="px-3 py-2 font-medium">
                <Link href={`/applications/${app.id}/edit`} className="hover:underline">
                  {app.company}
                </Link>
              </td>
              <td className="px-3 py-2">{app.role_title}</td>
              <td className="px-3 py-2">
                <StatusBadge status={app.status} />
              </td>
              <td className="text-muted-foreground px-3 py-2 whitespace-nowrap">{date(app.applied_on)}</td>
              <td
                className={cn(
                  "px-3 py-2 whitespace-nowrap",
                  app.follow_up_on && followUpState(app.follow_up_on, today) !== "upcoming"
                    ? "text-destructive font-medium"
                    : "text-muted-foreground",
                )}
              >
                {date(app.follow_up_on)}
              </td>
              <td className="text-muted-foreground px-3 py-2">{tSource(app.source)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PageLink({
  query,
  page,
  disabled,
  children,
}: {
  query: ListQuery;
  page: number;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const className = buttonVariants({ variant: "outline", className: "h-10 px-4" });
  if (disabled) {
    return (
      <span aria-disabled className={cn(className, "pointer-events-none opacity-50")}>
        {children}
      </span>
    );
  }
  return (
    <Link href={`/applications${toSearch(query, { page })}`} className={className}>
      {children}
    </Link>
  );
}
