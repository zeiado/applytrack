import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Application } from "@/lib/applications/model";

const jar = new Map<string, string>();
const set = vi.fn((name: string, value: string) => jar.set(name, value));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { value: jar.get(name) } : undefined), set }),
}));

function app(id: string, follow_up_on: string | null = null): Application {
  return { id, follow_up_on } as Application;
}

async function load(extensionUrl = "") {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_EXTENSION_URL", extensionUrl);
  return import("./guide");
}

beforeEach(() => {
  jar.clear();
  set.mockClear();
});
afterEach(() => vi.unstubAllEnvs());

describe("guideSteps", () => {
  it("starts with nothing done, and no extension step before it's published", async () => {
    const { guideSteps } = await load();
    expect(await guideSteps([])).toEqual([
      { key: "add", done: false, href: "/applications/new" },
      { key: "followUp", done: false, href: "/applications/new" },
    ]);
  });

  it("ticks off the first step and links the second to the newest application", async () => {
    const { guideSteps } = await load();
    const steps = await guideSteps([app("new"), app("old")]);
    expect(steps?.[0]?.done).toBe(true);
    expect(steps?.[1]?.href).toBe("/applications/new#follow_up_on");
  });

  it("is gone once any application has a follow-up date", async () => {
    const { guideSteps } = await load();
    expect(await guideSteps([app("a"), app("b", "2030-01-05")])).toBeNull();
  });

  it("stays gone once finished, even with no follow-up left", async () => {
    const { finishGuide, guideSteps } = await load();
    await finishGuide();
    expect(set).toHaveBeenCalledWith("__Host-guide", "done", expect.objectContaining({ httpOnly: true, secure: true }));
    expect(await guideSteps([app("a")])).toBeNull();
  });

  it("shows the extension step once there's a store link, done after the extension saved a job", async () => {
    const { guideSteps, markExtensionUsed } = await load("https://chromewebstore.google.com/detail/sekka/abc");
    expect((await guideSteps([]))?.[2]).toEqual({
      key: "extension",
      done: false,
      href: "https://chromewebstore.google.com/detail/sekka/abc",
    });
    await markExtensionUsed();
    expect((await guideSteps([]))?.[2]?.done).toBe(true);
  });
});
