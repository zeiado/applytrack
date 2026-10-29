import { describe, expect, it } from "vitest";

import { matches, normalize } from "./search";
import { isTyping, shortcutFor } from "./shortcuts";

describe("search matching", () => {
  it("ignores case, extra spaces and Arabic spelling variants", () => {
    expect(normalize("  Nile   LABS ")).toBe("nile labs");
    expect(matches("اسكندريه", "شركة الإسكندرية")).toBe(true);
    expect(matches("مستشفي", "مستشفى")).toBe(true);
    expect(matches("مُطوِّر", "مطور واجهات")).toBe(true);
  });

  it("needs every word, across company and role", () => {
    expect(matches("nile front", "Nile Labs", "Junior frontend developer")).toBe(true);
    expect(matches("nile backend", "Nile Labs", "Junior frontend developer")).toBe(false);
    expect(matches("", "anything")).toBe(true);
  });
});

describe("shortcuts", () => {
  const key = (k: string, extra: Partial<KeyboardEvent> = {}) =>
    ({ key: k, metaKey: false, ctrlKey: false, altKey: false, target: document.body, ...extra }) as KeyboardEvent;

  it("opens search with Ctrl or Cmd+K, even while typing", () => {
    const input = document.createElement("input");
    expect(shortcutFor(key("k", { ctrlKey: true, target: input }), null)).toEqual({ kind: "palette" });
    expect(shortcutFor(key("K", { metaKey: true }), null)).toEqual({ kind: "palette" });
  });

  it("leaves single letters alone while typing", () => {
    const input = document.createElement("textarea");
    expect(isTyping(input)).toBe(true);
    expect(shortcutFor(key("n", { target: input }), null)).toBeNull();
  });

  it("understands n, /, ? and g pairs", () => {
    expect(shortcutFor(key("n"), null)).toEqual({ kind: "new" });
    expect(shortcutFor(key("/"), null)).toEqual({ kind: "palette" });
    expect(shortcutFor(key("?"), null)).toEqual({ kind: "help" });
    expect(shortcutFor(key("g"), null)).toEqual({ kind: "wait" });
    expect(shortcutFor(key("f"), "g")).toEqual({ kind: "go", href: "/follow-ups" });
    expect(shortcutFor(key("f"), null)).toBeNull();
  });
});
