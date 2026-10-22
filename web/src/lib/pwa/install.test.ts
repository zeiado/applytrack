import { describe, expect, it } from "vitest";

import { installMode } from "./install";

const ANDROID = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/141.0 Mobile Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Version/18.6 Mobile Safari/604.1";
const IPAD = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.6 Safari/605.1.15";

describe("installMode", () => {
  const base = { standalone: false, canPrompt: false, userAgent: ANDROID, maxTouchPoints: 5 };

  it("says so when it's already the installed app", () => {
    expect(installMode({ ...base, standalone: true, canPrompt: true })).toBe("installed");
  });

  it("offers the browser's dialog when there is one", () => {
    expect(installMode({ ...base, canPrompt: true })).toBe("prompt");
  });

  it("explains Safari's Share menu on iPhone and iPad", () => {
    expect(installMode({ ...base, userAgent: IPHONE })).toBe("ios");
    // iPadOS says it's a Mac; a Mac has no touch screen.
    expect(installMode({ ...base, userAgent: IPAD, maxTouchPoints: 5 })).toBe("ios");
    expect(installMode({ ...base, userAgent: IPAD, maxTouchPoints: 0 })).toBe("manual");
  });

  it("points to the browser menu otherwise", () => {
    expect(installMode(base)).toBe("manual");
  });
});
