import type { ErrorEvent } from "@sentry/nextjs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { maskEmails, scrubEvent, sentryOptions, stripUrl } from "./sentry";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Sentry options", () => {
  it("is off without a DSN", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    expect(sentryOptions().enabled).toBe(false);
  });

  it("sends no personal data and no traces", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://key@o1.ingest.sentry.io/1");
    const options = sentryOptions();
    expect(options.enabled).toBe(true);
    expect(options.dataCollection).toMatchObject({
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    });
    expect(options.tracesSampleRate).toBe(0);
  });
});

describe("scrubEvent", () => {
  it("removes the user, cookies, headers, bodies, queries and tokens", () => {
    const event = {
      type: undefined,
      user: { email: "ada@example.com", ip_address: "1.2.3.4" },
      message: "Login failed for ada@example.com",
      request: {
        url: "https://app.example.com/en/verify-email#token=secret",
        query_string: "next=/x",
        cookies: { "__Host-at": "jwt" },
        headers: { Cookie: "a=b" },
        data: { password: "hunter2" },
      },
      exception: { values: [{ type: "Error", value: "No account ada@example.com" }] },
      breadcrumbs: [
        { category: "navigation", data: { from: "/en/unsubscribe#token=secret", to: "/en/settings?x=1" } },
        { category: "fetch", data: { url: "/api/unsubscribe?token=secret" }, message: "to bob@example.com" },
      ],
    } as unknown as ErrorEvent;

    const scrubbed = JSON.stringify(scrubEvent(event));

    expect(scrubbed).not.toMatch(/secret|hunter2|jwt|@example\.com|1\.2\.3\.4|a=b/);
    expect(scrubbed).toContain("https://app.example.com/en/verify-email");
    expect(scrubbed).toContain("/en/settings");
  });

  it("masks emails and strips URLs", () => {
    expect(maskEmails("a.b+c@mail.example.co.uk, x@y.io")).toBe("[email], [email]");
    expect(stripUrl("/a/b?c=1#d")).toBe("/a/b");
    expect(stripUrl("/a/b")).toBe("/a/b");
  });
});
