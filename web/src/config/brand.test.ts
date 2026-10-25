import { afterEach, expect, it, vi } from "vitest";

async function feedbackUrl(value: string | undefined) {
  vi.resetModules();
  if (value !== undefined) vi.stubEnv("NEXT_PUBLIC_FEEDBACK_URL", value);
  return (await import("./brand")).FEEDBACK_URL;
}

afterEach(() => vi.unstubAllEnvs());

it("uses an https feedback form", async () => {
  expect(await feedbackUrl("https://tally.so/r/abc")).toBe("https://tally.so/r/abc");
});

it("hides the links without one, or with anything but https", async () => {
  expect(await feedbackUrl("")).toBe("");
  expect(await feedbackUrl("http://tally.so/r/abc")).toBe("");
  expect(await feedbackUrl("javascript:alert(1)")).toBe("");
});
