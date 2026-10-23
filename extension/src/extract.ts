export type Source = "job_board" | "company_site" | "other";

export type ExtractedJob = {
  company: string;
  role_title: string;
  job_url: string;
  source: Source;
};

/**
 * Reads the job on the page the user is looking at. It runs inside that page
 * (chrome.scripting.executeScript sends it as text), so it must not use anything
 * from outside its own body: no imports, no module-level values.
 *
 * In order: the page's schema.org JobPosting (Wuzzuf, Bayt, Forasna and LinkedIn when
 * signed out have one), LinkedIn's tab title when signed in ("Role | Company |
 * LinkedIn"), then the page's title. The user checks and corrects the result before
 * saving, so a rough guess is fine.
 */
export function extractJob(doc: Document = document, href: string = location.href): ExtractedJob {
  const clean = (value: unknown): string =>
    typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, 200) : "";

  const url = new URL(href);
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const BOARDS = ["linkedin.com", "wuzzuf.net", "bayt.com", "forasna.com"];
  const board = BOARDS.find((domain) => host === domain || host.endsWith(`.${domain}`)) ?? null;

  let role = "";
  let company = "";

  // 1. schema.org JobPosting
  const items: unknown[] = [];
  for (const script of Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))) {
    try {
      for (const item of [JSON.parse(script.textContent ?? "")].flat()) {
        items.push(item);
        const graph = (item as { "@graph"?: unknown })?.["@graph"];
        if (Array.isArray(graph)) items.push(...graph);
      }
    } catch {
      // Not valid JSON: skip it.
    }
  }
  const posting = items.find((item) => {
    const type = (item as { "@type"?: unknown } | null)?.["@type"];
    return type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"));
  }) as { title?: unknown; hiringOrganization?: unknown } | undefined;
  if (posting) {
    role = clean(posting.title);
    const org = posting.hiringOrganization;
    company = clean(typeof org === "string" ? org : (org as { name?: unknown } | undefined)?.name);
  }

  // 2. LinkedIn, signed in: no JobPosting, but the tab title is "Role | Company | LinkedIn"
  //    (after an unread count like "(3) ").
  const linkedInId =
    board === "linkedin.com"
      ? (url.pathname.match(/\/jobs\/view\/(\d+)/)?.[1] ?? url.searchParams.get("currentJobId"))
      : null;
  if (board === "linkedin.com" && (!role || !company)) {
    const parts = doc.title.replace(/^\(\d+\+?\)\s*/, "").split(" | ");
    if (parts.length >= 3 && parts[parts.length - 1] === "LinkedIn") {
      role ||= clean(parts.slice(0, -2).join(" | "));
      company ||= clean(parts[parts.length - 2]);
    } else if (linkedInId && !role) {
      // The search page shows a job beside the list; its link in the list names the role.
      role = clean(doc.querySelector(`a[href*="/jobs/view/${linkedInId}"]`)?.textContent);
    }
  }

  // 3. Any other page: its title. A company's own careers page often names the company
  //    in og:site_name; on a job board that would be the board's name instead.
  if (!role && board !== "linkedin.com") {
    role =
      clean(doc.querySelector("h1")?.textContent) ||
      clean(doc.querySelector('meta[property="og:title"]')?.getAttribute("content")) ||
      clean(doc.title);
  }
  if (!company && !board) {
    company = clean(doc.querySelector('meta[property="og:site_name"]')?.getAttribute("content"));
  }

  // The link: LinkedIn's plain job address, else the page's canonical address, else
  // this one without tracking parameters.
  let jobUrl: string;
  if (linkedInId) {
    jobUrl = `https://www.linkedin.com/jobs/view/${linkedInId}/`;
  } else {
    const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute("href");
    let resolved: URL | null = null;
    try {
      resolved = canonical ? new URL(canonical, href) : null;
    } catch {
      resolved = null;
    }
    if (resolved && /^https?:$/.test(resolved.protocol) && resolved.hostname === url.hostname) {
      jobUrl = resolved.href;
    } else {
      const plain = new URL(href);
      plain.hash = "";
      for (const key of Array.from(plain.searchParams.keys())) {
        if (/^(utm_|fbclid$|gclid$|ref$|refId$|trackingId$)/i.test(key)) plain.searchParams.delete(key);
      }
      jobUrl = plain.href;
    }
  }

  return {
    company,
    role_title: role,
    job_url: jobUrl.slice(0, 2048),
    source: board ? "job_board" : company ? "company_site" : "other",
  };
}
