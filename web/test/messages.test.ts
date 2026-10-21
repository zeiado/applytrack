import { describe, expect, it } from "vitest";

import ar from "../messages/ar.json";
import en from "../messages/en.json";

// {"Home": {"title": "Hi"}} → {"Home.title": "Hi"}
function flatten(messages: object, prefix = ""): Record<string, string> {
  return Object.fromEntries(
    Object.entries(messages).flatMap(([key, value]) =>
      typeof value === "object" && value !== null
        ? Object.entries(flatten(value, `${prefix}${key}.`))
        : [[`${prefix}${key}`, String(value)]],
    ),
  );
}

const arabic = flatten(ar);
const english = flatten(en);

describe("messages", () => {
  it("has the same keys in Arabic and English", () => {
    expect(Object.keys(arabic).sort()).toEqual(Object.keys(english).sort());
  });

  it("has no empty messages", () => {
    const empty = Object.entries({ ...arabic, ...english }).filter(([, v]) => v.trim() === "");
    expect(empty).toEqual([]);
  });

  it("keeps the same placeholders in both languages", () => {
    const placeholders = (text = "") => (text.match(/\{\w+\}/g) ?? []).sort().join(",");
    const mismatched = Object.keys(english).filter(
      (key) => placeholders(english[key]) !== placeholders(arabic[key]),
    );
    expect(mismatched).toEqual([]);
  });
});
