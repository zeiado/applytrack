import { type ApplicationSource, type ApplicationStatus, SORTS, type Sort, SOURCES, STATUSES } from "./model";

export const PAGE_SIZE = 20;

/** The list view's state, read from the URL so a filtered list can be bookmarked. */
export type ListQuery = {
  statuses: ApplicationStatus[];
  source: ApplicationSource | null;
  company: string;
  sort: Sort;
  page: number;
};

type SearchParams = Record<string, string | string[] | undefined>;

function all(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function first(value: string | string[] | undefined): string | undefined {
  return all(value)[0];
}

function oneOf<T extends string>(options: readonly T[], value: string | undefined): T | null {
  return options.includes(value as T) ? (value as T) : null;
}

/** Unknown or malformed values are dropped, not errors: URLs get edited by hand. */
export function parseListQuery(params: SearchParams): ListQuery {
  const page = Number.parseInt(first(params.page) ?? "1", 10);
  return {
    statuses: [...new Set(all(params.status))].filter((s): s is ApplicationStatus =>
      (STATUSES as readonly string[]).includes(s),
    ),
    source: oneOf(SOURCES, first(params.source)),
    company: (first(params.company) ?? "").trim().slice(0, 200),
    sort: oneOf(SORTS, first(params.sort)) ?? "-created_at",
    page: Number.isFinite(page) && page >= 1 ? Math.min(page, 10_000) : 1,
  };
}

/** The same query as API parameters. */
export function toApiParams(query: ListQuery) {
  return {
    status: query.statuses.length > 0 ? query.statuses : undefined,
    source: query.source ? [query.source] : undefined,
    company: query.company || undefined,
    sort: query.sort,
    limit: PAGE_SIZE,
    offset: (query.page - 1) * PAGE_SIZE,
  };
}

/** The URL search string for a query (defaults left out), e.g. for pagination links. */
export function toSearch(query: ListQuery, changes: Partial<ListQuery> = {}): string {
  const next = { ...query, ...changes };
  const params = new URLSearchParams({ view: "list" });
  for (const status of next.statuses) params.append("status", status);
  if (next.source) params.set("source", next.source);
  if (next.company) params.set("company", next.company);
  if (next.sort !== "-created_at") params.set("sort", next.sort);
  if (next.page > 1) params.set("page", String(next.page));
  return `?${params}`;
}

export function hasFilters(query: ListQuery): boolean {
  return query.statuses.length > 0 || query.source !== null || query.company !== "";
}

/** The CSV export's API query: the list's filters and sort, every page. Excel needs the
 * byte order mark (the API's default) to show Arabic. */
export function toExportSearch(query: ListQuery): string {
  const params = new URLSearchParams();
  for (const status of query.statuses) params.append("status", status);
  if (query.source) params.set("source", query.source);
  if (query.company) params.set("company", query.company);
  params.set("sort", query.sort);
  return `?${params}`;
}

/** URLSearchParams as the plain object `parseListQuery` reads (repeated keys → arrays). */
export function searchParamsObject(params: URLSearchParams): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  for (const key of new Set(params.keys())) {
    const values = params.getAll(key);
    result[key] = values.length === 1 ? (values[0] as string) : values;
  }
  return result;
}
