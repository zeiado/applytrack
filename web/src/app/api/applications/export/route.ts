import type { NextRequest } from "next/server";

import { proxyDownload } from "@/lib/api/download";
import { parseListQuery, searchParamsObject, toExportSearch, toSearch } from "@/lib/applications/query";

/** The applications as a CSV file that opens in Excel, with the list's filters (same URL
 * parameters as the list view). */
export async function GET(request: NextRequest): Promise<Response> {
  const query = parseListQuery(searchParamsObject(request.nextUrl.searchParams));
  return proxyDownload(request, {
    path: `/api/v1/applications/export.csv${toExportSearch(query)}`,
    contentType: "text/csv; charset=utf-8",
    filename: "applications.csv",
    returnTo: `/applications${toSearch({ ...query, page: 1 })}`,
  });
}
