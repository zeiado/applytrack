import { describe, expect, it } from "vitest";

import { ACCESS_COOKIE, clearSessionCookies, REFRESH_COOKIE, setSessionCookies } from "./cookies";
import { safeNextPath, toActionError } from "./errors";
import { protectedRoute } from "./routes";

describe("safeNextPath", () => {
  it.each(["/dashboard", "/dashboard?tab=list", "/applications/123"])("keeps %s", (path) => {
    expect(safeNextPath(path)).toBe(path);
  });

  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "dashboard",
    "/en/dashboard",
    "/ar",
    "",
    null,
    42,
  ])("refuses %s", (path) => {
    expect(safeNextPath(path)).toBeNull();
  });
});

describe("toActionError", () => {
  it("keeps known codes and the Retry-After header", () => {
    const response = new Response(null, { status: 429, headers: { "Retry-After": "42" } });
    const error = { error: { code: "too_many_login_attempts", message: "x" } };
    expect(toActionError(error, response)).toEqual({
      code: "too_many_login_attempts",
      retryAfter: 42,
    });
  });

  it("maps codes it doesn't explain to unknown", () => {
    expect(toActionError({ error: { code: "something_new", message: "x" } })).toEqual({
      code: "unknown",
    });
    expect(toActionError(undefined)).toEqual({ code: "unknown" });
  });
});

describe("protectedRoute", () => {
  it.each([
    ["/dashboard", "member"],
    ["/dashboard/settings", "member"],
    ["/login", "guest"],
    ["/register", "guest"],
    ["/", null],
    ["/forgot-password", null],
    ["/dashboards", null],
  ])("%s is %s", (path, kind) => {
    expect(protectedRoute(path)).toBe(kind);
  });
});

describe("session cookies", () => {
  function jar() {
    const set = new Map<string, { value: string; options: Record<string, unknown> }>();
    return {
      set,
      writer: {
        set: (name: string, value: string, options: Record<string, unknown>) =>
          set.set(name, { value, options }),
      },
    };
  }

  it("stores both tokens in httpOnly, Secure, Lax cookies", () => {
    const cookies = jar();
    setSessionCookies(cookies.writer, {
      access_token: "access",
      refresh_token: "refresh",
      token_type: "bearer",
      expires_in: 1800,
      refresh_expires_in: 2592000,
    });

    expect(cookies.set.get(ACCESS_COOKIE)).toEqual({
      value: "access",
      options: { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 1740 },
    });
    expect(cookies.set.get(REFRESH_COOKIE)?.options.maxAge).toBe(2592000);
    expect(ACCESS_COOKIE.startsWith("__Host-")).toBe(true);
  });

  it("clears both with the same flags, or __Host- cookies wouldn't change", () => {
    const cookies = jar();
    clearSessionCookies(cookies.writer);
    for (const name of [ACCESS_COOKIE, REFRESH_COOKIE]) {
      expect(cookies.set.get(name)).toEqual({
        value: "",
        options: { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 },
      });
    }
  });
});
