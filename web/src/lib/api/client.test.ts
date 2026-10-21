import { afterEach, describe, expect, it, vi } from "vitest";

import { apiClient, apiHeaders, apiUrl, clientIpFrom } from "./client";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("apiUrl", () => {
  it("defaults to the local API", () => {
    vi.stubEnv("API_URL", undefined);
    expect(apiUrl()).toBe("http://localhost:8000");
  });

  it("uses API_URL without a trailing slash", () => {
    vi.stubEnv("API_URL", "https://api.example.com/");
    expect(apiUrl()).toBe("https://api.example.com");
  });
});

describe("apiClient", () => {
  it("calls typed API paths with the visitor's headers", async () => {
    vi.stubEnv("API_URL", "https://api.example.com");
    vi.stubEnv("API_PROXY_SECRET", "s".repeat(40));
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(
      async () => new Response(JSON.stringify({ status: "ok", version: "1" })),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { data } = await apiClient({ clientIp: "203.0.113.7", accessToken: "abc" }).GET(
      "/health",
    );

    expect(data).toEqual({ status: "ok", version: "1" });
    const [url, init] = fetchMock.mock.calls[0]!;
    const headers = new Headers(init.headers);
    expect(url).toBe("https://api.example.com/health");
    expect(headers.get("authorization")).toBe("Bearer abc");
    expect(headers.get("x-client-ip")).toBe("203.0.113.7");
    expect(init.body).toBeUndefined();
  });
});

describe("apiHeaders", () => {
  it("vouches for the visitor's IP only with the shared secret", () => {
    vi.stubEnv("API_PROXY_SECRET", "");
    expect(apiHeaders({ clientIp: "203.0.113.7" })).toEqual({});

    vi.stubEnv("API_PROXY_SECRET", "secret-value");
    expect(apiHeaders({ clientIp: "203.0.113.7" })).toEqual({
      "X-Proxy-Secret": "secret-value",
      "X-Client-IP": "203.0.113.7",
    });
    expect(apiHeaders({ clientIp: null })).toEqual({});
  });
});

describe("clientIpFrom", () => {
  it("prefers x-real-ip, then the first x-forwarded-for entry", () => {
    expect(clientIpFrom(new Headers({ "x-real-ip": " 203.0.113.7 " }))).toBe("203.0.113.7");
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "198.51.100.1, 10.0.0.1" }))).toBe(
      "198.51.100.1",
    );
    expect(clientIpFrom(new Headers())).toBeNull();
  });
});
