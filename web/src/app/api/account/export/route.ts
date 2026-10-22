import { proxyDownload } from "@/lib/api/download";

/** "Download my data": the API's JSON export (Egypt's PDPL right of access) as a file. */
export async function GET(request: Request): Promise<Response> {
  return proxyDownload(request, {
    path: "/api/v1/users/me/export",
    contentType: "application/json; charset=utf-8",
    filename: "applytrack-export.json",
    returnTo: "/settings",
  });
}
