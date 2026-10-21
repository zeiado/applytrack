import { afterEach, describe, expect, it, vi } from "vitest";

import { apiClient, apiUrl } from "./client";

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
  it("calls typed API paths on the base URL", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ status: "ok", version: "0.4.0" })),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { data } = await apiClient("https://api.example.com").GET("/health");

    expect(data).toEqual({ status: "ok", version: "0.4.0" });
    const request = (fetchMock.mock.calls[0] as unknown as [Request])[0];
    expect(request.url).toBe("https://api.example.com/health");
  });
});
