import { existsSync } from "node:fs";
import { join } from "node:path";

import { type BrowserContext, chromium, expect, type Page, test as base } from "@playwright/test";

import { register } from "./helpers";

// The browser extension (extension/, #69) in a real Chromium, against the local web app.
// Build it for the local app first:
//   cd ../extension && SEKKA_APP_URL=http://localhost:3000 npm run build
const EXTENSION = join(process.cwd(), "..", "extension", "dist");
const BASE_URL = "http://localhost:3000";
const JOB_PAGE = `${BASE_URL}/e2e-fixtures/job`;

// The few extension APIs the tests use (the web app doesn't load Chrome's types).
type ChromeApis = {
  chrome: {
    developerPrivate: { getExtensionsInfo(): Promise<{ id: string; name: string }[]> };
    tabs: { query(filter: { url: string }): Promise<{ id?: number }[]> };
  };
};

const test = base.extend<{ context: BrowserContext; extensionId: string }>({
  context: async ({}, provide) => {
    const context = await chromium.launchPersistentContext("", {
      channel: "chromium", // the full browser: the headless shell can't load extensions
      baseURL: BASE_URL,
      args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
    });
    // A job page like Wuzzuf's, served without the network.
    await context.route(JOB_PAGE, (route) =>
      route.fulfill({
        contentType: "text/html; charset=utf-8",
        body: `<!doctype html><title>Data Analyst vacancy in Cairo</title>
          <script type="application/ld+json">${JSON.stringify({
            "@context": "https://schema.org/",
            "@type": "JobPosting",
            title: "Data Analyst",
            hiringOrganization: { "@type": "Organization", name: "Valu" },
          })}</script><h1>Data Analyst</h1>`,
      }),
    );
    await provide(context);
    await context.close();
  },
  extensionId: async ({ context }, provide) => {
    const page = await context.newPage();
    await page.goto("chrome://extensions");
    const id = await page.evaluate(async () => {
      // chrome.developerPrivate exists on chrome://extensions only.
      const { developerPrivate } = (globalThis as unknown as ChromeApis).chrome;
      const all = await developerPrivate.getExtensionsInfo();
      return all.find((extension) => extension.name.startsWith("Sekka"))?.id;
    });
    await page.close();
    if (!id) throw new Error(`The extension isn't loaded. Build it into ${EXTENSION}`);
    await provide(id);
  },
});

test.skip(!existsSync(join(EXTENSION, "manifest.json")), `Build the extension into ${EXTENSION} first`);

/** Opens the popup as a page of its own, reading the job page's tab. */
async function openPopup(context: BrowserContext, extensionId: string): Promise<Page> {
  const job = await context.newPage();
  await job.goto(JOB_PAGE);
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  const tabId = await popup.evaluate(
    async (url) => (await (globalThis as unknown as ChromeApis).chrome.tabs.query({ url }))[0]?.id,
    JOB_PAGE,
  );
  await popup.goto(`chrome-extension://${extensionId}/popup.html?tab=${tabId}`);
  return popup;
}

test("saves the job on the page to the signed-in account", async ({ context, extensionId }) => {
  const page = await context.newPage();
  await register(page);

  const popup = await openPopup(context, extensionId);
  await expect(popup.getByLabel("Company")).toHaveValue("Valu");
  await expect(popup.getByRole("status")).toBeHidden(); // no "couldn't reach Sekka"
  await expect(popup.getByLabel("Role")).toHaveValue("Data Analyst");
  await expect(popup.getByLabel("Link")).toHaveValue(JOB_PAGE);

  await popup.getByLabel("Role").fill("Junior Data Analyst"); // the user can correct it
  await popup.getByRole("button", { name: "Save to Sekka" }).click();
  await expect(popup.getByText("Saved to Sekka")).toBeVisible();
  await expect(popup.getByRole("link", { name: "Open in Sekka" })).toHaveAttribute(
    "href",
    new RegExp(`^${BASE_URL}/applications/[0-9a-f-]{36}$`),
  );

  await page.goto("/en/applications");
  await expect(page.getByRole("heading", { name: "Valu" })).toBeVisible();
  await expect(page.getByText("Junior Data Analyst")).toBeVisible();
});

test("asks to log in when no one is", async ({ context, extensionId }) => {
  const popup = await openPopup(context, extensionId);
  await expect(popup.getByText("Log in to Sekka first")).toBeVisible();
  await expect(popup.getByRole("link", { name: "Log in" })).toHaveAttribute("href", `${BASE_URL}/login`);
});

test("websites can't use the extension's routes", async ({ request }) => {
  const response = await request.post("/api/extension/applications", {
    headers: { Origin: "https://evil.example" },
    data: { company: "x", role_title: "y" },
  });
  expect(response.status()).toBe(403);
  const session = await request.get("/api/extension/session", { headers: { Origin: "https://evil.example" } });
  expect(session.status()).toBe(403);
});
