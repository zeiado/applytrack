// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { extractJob } from "../src/extract";

function page(html: string, title = ""): Document {
  return new DOMParser().parseFromString(`<html><head><title>${title}</title>${html}</head><body></body></html>`, "text/html");
}

function jobPosting(posting: object): string {
  return `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org/", ...posting })}</script>`;
}

// Shaped like the real pages (checked October 2026).
describe("job boards with a schema.org JobPosting", () => {
  it("Wuzzuf", () => {
    const doc = page(
      jobPosting({
        "@type": "JobPosting",
        title: "Software QA Engineer",
        hiringOrganization: { "@type": "Organization", name: "Confidential" },
      }) + '<link rel="canonical" href="https://wuzzuf.net/jobs/p/qgirmns03vbu-software-qa-engineer-cairo-egypt">',
      "Software QA Engineer vacancy in Cairo, Egypt | 3 to 5 years experience",
    );
    expect(extractJob(doc, "https://wuzzuf.net/jobs/p/qgirmns03vbu-software-qa-engineer-cairo-egypt?o=3&l=sp")).toEqual({
      company: "Confidential",
      role_title: "Software QA Engineer",
      job_url: "https://wuzzuf.net/jobs/p/qgirmns03vbu-software-qa-engineer-cairo-egypt",
      source: "job_board",
      job_description: "",
    });
  });

  it("Bayt", () => {
    const doc = page(
      jobPosting({
        "@type": "JobPosting",
        title: "Senior Software Developer - ELK expert",
        hiringOrganization: { name: "Orange - Other locations" },
      }),
    );
    const job = extractJob(doc, "https://www.bayt.com/en/egypt/jobs/senior-software-developer-elk-expert-75347019/");
    expect(job.role_title).toBe("Senior Software Developer - ELK expert");
    expect(job.company).toBe("Orange - Other locations");
    expect(job.source).toBe("job_board");
  });

  it("Forasna, in Arabic, inside a list with other data", () => {
    const doc = page(
      `<script type="application/ld+json">${JSON.stringify([
        { "@type": "JobPosting", title: "كابتن صالة  (يشترط خبره بالمطاعم الانترناشيونال)", hiringOrganization: { name: "سيدج" } },
        { "@type": "BreadcrumbList" },
      ])}</script>`,
    );
    const job = extractJob(doc, "https://forasna.com/job/p/%D9%83%D8%A7%D8%A8%D8%AA%D9%86-444883");
    expect(job.role_title).toBe("كابتن صالة (يشترط خبره بالمطاعم الانترناشيونال)");
    expect(job.company).toBe("سيدج");
  });

  it("finds it inside an @graph, and skips broken JSON", () => {
    const doc = page(
      '<script type="application/ld+json">{not json</script>' +
        jobPosting({ "@graph": [{ "@type": "WebPage" }, { "@type": ["JobPosting"], title: "Analyst", hiringOrganization: "Valu" }] }),
    );
    const job = extractJob(doc, "https://careers.example.com/jobs/1");
    expect(job.role_title).toBe("Analyst");
    expect(job.company).toBe("Valu");
  });
});

describe("LinkedIn", () => {
  it("signed in: from the tab title, with a plain job link", () => {
    const doc = page("", "(3) Senior Full Stack .NET Developer (ASP.NET Core & Angular) | BarCloud | LinkedIn");
    expect(extractJob(doc, "https://www.linkedin.com/jobs/view/4477374392/?trackingId=abc&refId=x")).toEqual({
      company: "BarCloud",
      role_title: "Senior Full Stack .NET Developer (ASP.NET Core & Angular)",
      job_url: "https://www.linkedin.com/jobs/view/4477374392/",
      source: "job_board",
      job_description: "",
    });
  });

  it("from the search page: the selected job's link and its title in the list", () => {
    const doc = page("", "Jobs | LinkedIn");
    doc.body.innerHTML = '<a href="/jobs/view/4477374392/?trk=x"> Backend Engineer </a>';
    const job = extractJob(doc, "https://www.linkedin.com/jobs/search-results/?currentJobId=4477374392&keywords=x");
    expect(job.job_url).toBe("https://www.linkedin.com/jobs/view/4477374392/");
    expect(job.role_title).toBe("Backend Engineer");
    expect(job.company).toBe("");
  });

  it("signed out: the JobPosting wins", () => {
    const doc = page(jobPosting({ "@type": "JobPosting", title: "Data Analyst", hiringOrganization: { name: "Paymob" } }), "Paymob hiring Data Analyst in Cairo | LinkedIn");
    const job = extractJob(doc, "https://eg.linkedin.com/jobs/view/data-analyst-at-paymob-4477374392");
    expect(job).toMatchObject({ role_title: "Data Analyst", company: "Paymob" });
  });
});

describe("any other page", () => {
  it("a company's careers page: the heading and the site's name", () => {
    const doc = page('<meta property="og:site_name" content="Instabug">', "Careers");
    doc.body.innerHTML = "<h1>Backend Engineer</h1>";
    expect(extractJob(doc, "https://instabug.com/careers/backend?utm_source=x&utm_medium=y#apply")).toEqual({
      company: "Instabug",
      role_title: "Backend Engineer",
      job_url: "https://instabug.com/careers/backend",
      source: "company_site",
      job_description: "",
    });
  });

  it("a page with nothing to go on gives its title and leaves the rest to the user", () => {
    const job = extractJob(page("", "Some page"), "https://example.org/x");
    expect(job).toEqual({ company: "", role_title: "Some page", job_url: "https://example.org/x", source: "other", job_description: "" });
  });

  it("ignores a canonical link to another site", () => {
    const doc = page('<link rel="canonical" href="https://evil.example/elsewhere">', "Job");
    expect(extractJob(doc, "https://jobs.example.com/1").job_url).toBe("https://jobs.example.com/1");
  });

  it("keeps fields within the API's limits", () => {
    const job = extractJob(page("", "x".repeat(500)), "https://example.org/");
    expect(job.role_title).toHaveLength(200);
  });
});

describe("job description", () => {
  // Lines joined with newlines, to compare with the extracted text.
  const text = (...lines: string[]) => lines.join("\n");

  it("from the JobPosting's HTML, with paragraphs and lists", () => {
    const doc = page(
      jobPosting({
        "@type": "JobPosting",
        title: "QA Engineer",
        description: "<p>We build <b>payments</b>.</p><h3>You have</h3><ul><li>3+ years</li><li>SQL</li></ul>Apply<br>today<style>p { color: red }</style>",
      }),
    );
    expect(extractJob(doc, "https://wuzzuf.net/jobs/p/1").job_description).toBe(
      text("We build payments.", "", "You have", "", "- 3+ years", "- SQL", "", "Apply", "today"),
    );
  });

  it("reads HTML sent escaped, and Arabic", () => {
    const doc = page(jobPosting({ "@type": "JobPosting", title: "x", description: "&lt;p&gt;مطلوب   محاسب&lt;/p&gt;&lt;p&gt;خبرة سنتين&lt;/p&gt;" }));
    expect(extractJob(doc, "https://forasna.com/job/p/1").job_description).toBe(text("مطلوب محاسب", "", "خبرة سنتين"));
  });

  // Shaped like LinkedIn signed in, October 2026: generated class names, the text in
  // expandable boxes, the job's first and the company's second.
  it("LinkedIn signed in: the box under About the job, not the company's", () => {
    const doc = page("", "AI Software Engineer | Advansys | LinkedIn");
    doc.body.innerHTML =
      '<div class="l4j"><h2>About the job</h2><span data-testid="expandable-text-box"><strong>About The Role<br><br></strong>We build AI.<br><br><ul><li> Design APIs </li><li> Ship models </li></ul></span><button>… more</button></div>' +
      '<div><h2>About the company</h2><span data-testid="expandable-text-box">Advansys is an engineering firm.</span></div>';
    expect(extractJob(doc, "https://www.linkedin.com/jobs/search-results/?currentJobId=4476176909").job_description).toBe(
      text("About The Role", "", "We build AI.", "", "- Design APIs", "- Ship models"),
    );
  });

  it("LinkedIn's older layout", () => {
    const doc = page("", "Backend Engineer | Valu | LinkedIn");
    doc.body.innerHTML = '<div id="job-details"><span><p>Build APIs.</p><button>Show more</button></span></div>';
    expect(extractJob(doc, "https://www.linkedin.com/jobs/view/1/").job_description).toBe("Build APIs.");
  });

  // Shaped like Indeed's search page, October 2026: the job beside the list, no JobPosting.
  it("Indeed's search page: role, company, link and the text under the heading", () => {
    const doc = page("", "200+ Software Engineer Jobs | Indeed");
    doc.body.innerHTML =
      '<h1>software engineer jobs in Cairo</h1><div class="jobsearch-RightPane"><div data-testid="desktop-job-header"><h5 data-testid="vj-job-title">Node.js Associate Engineer</h5><a href="https://eg.indeed.com/cmp/Capgemini">Capgemini</a></div>' +
      '<div><div><h2>Full job description</h2></div><div><style>.x{}</style><h4>Job Description</h4><p>Job Requirements:</p><ul><li><p>1+ years of experience working in software development</p></li><li><p>Strong NodeJS and REST APIs</p></li></ul></div></div></div>';
    expect(extractJob(doc, "https://eg.indeed.com/jobs?q=software+engineer&l=Cairo&vjk=fcabf3b555d1fdc2")).toEqual({
      company: "Capgemini",
      role_title: "Node.js Associate Engineer",
      job_url: "https://eg.indeed.com/viewjob?jk=fcabf3b555d1fdc2",
      source: "job_board",
      job_description: text("Job Requirements:", "", "- 1+ years of experience working in software development", "- Strong NodeJS and REST APIs"),
    });
  });

  it("a careers page: the text under a Job description heading, in Arabic too", () => {
    const doc = page("", "Careers");
    doc.body.innerHTML =
      "<h1>محاسب</h1><section><h3>وصف الوظيفة</h3><p>مطلوب محاسب بخبرة سنتين في شركة توزيع، يجيد Excel والتقارير الشهرية، ويقدر يتعامل مع الموردين والعملاء.</p></section>";
    expect(extractJob(doc, "https://careers.example.com/jobs/1").job_description).toBe(
      "مطلوب محاسب بخبرة سنتين في شركة توزيع، يجيد Excel والتقارير الشهرية، ويقدر يتعامل مع الموردين والعملاء.",
    );
  });

  it("takes nothing from a page without a JobPosting or a description heading", () => {
    const doc = page("", "Careers");
    doc.body.innerHTML = '<div id="job-details"><p>Not from LinkedIn</p></div><h2>Our values</h2><p>' + "We care. ".repeat(30) + "</p>";
    expect(extractJob(doc, "https://example.org/jobs/1").job_description).toBe("");
  });

  it("keeps it within the API's limit", () => {
    const doc = page(jobPosting({ "@type": "JobPosting", title: "x", description: "a".repeat(30_000) }));
    expect(extractJob(doc, "https://bayt.com/1").job_description).toHaveLength(20_000);
  });
});

it("runs on its own, as Chrome runs it inside the page", () => {
  // executeScript sends the function as text, so it can't use anything around it.
  const standalone = new Function(`return (${extractJob.toString()})`)() as typeof extractJob;
  document.title = "Role | Company | LinkedIn";
  expect(standalone(document, "https://www.linkedin.com/jobs/view/1/")).toMatchObject({ role_title: "Role", company: "Company" });
});
