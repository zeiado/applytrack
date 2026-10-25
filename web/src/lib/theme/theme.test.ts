import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { applyTheme, readTheme, saveTheme, subscribeTheme, THEME_SCRIPT } from "./theme";

function deviceIsDark(dark: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: dark && query === "(prefers-color-scheme: dark)",
    addEventListener: vi.fn(),
  }));
}

const root = () => document.documentElement;

beforeEach(() => {
  localStorage.clear();
  root().className = "";
  root().style.colorScheme = "";
  deviceIsDark(false);
});
afterEach(() => vi.unstubAllGlobals());

describe("readTheme", () => {
  it("is system unless light or dark was chosen", () => {
    expect(readTheme()).toBe("system");
    localStorage.setItem("theme", "purple");
    expect(readTheme()).toBe("system");
    localStorage.setItem("theme", "dark");
    expect(readTheme()).toBe("dark");
  });
});

describe("applyTheme", () => {
  it("follows the device for system", () => {
    applyTheme("system");
    expect(root().classList.contains("dark")).toBe(false);
    deviceIsDark(true);
    applyTheme("system");
    expect(root().classList.contains("dark")).toBe(true);
    expect(root().style.colorScheme).toBe("dark");
  });

  it("light and dark ignore the device", () => {
    deviceIsDark(true);
    applyTheme("light");
    expect(root().classList.contains("dark")).toBe(false);
    deviceIsDark(false);
    applyTheme("dark");
    expect(root().classList.contains("dark")).toBe(true);
  });
});

describe("saveTheme", () => {
  it("remembers the choice, forgets it for system, and tells listeners", () => {
    const listener = vi.fn();
    const stop = subscribeTheme(listener);
    saveTheme("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(root().classList.contains("dark")).toBe(true);
    saveTheme("system");
    expect(localStorage.getItem("theme")).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);
    stop();
  });
});

describe("the script in <head>", () => {
  it("applies the saved theme the same way", () => {
    localStorage.setItem("theme", "dark");
    new Function(THEME_SCRIPT)();
    expect(root().classList.contains("dark")).toBe(true);
    localStorage.setItem("theme", "light");
    deviceIsDark(true);
    new Function(THEME_SCRIPT)();
    expect(root().classList.contains("dark")).toBe(false);
  });
});
