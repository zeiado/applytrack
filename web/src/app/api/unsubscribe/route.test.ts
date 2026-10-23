// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "./route";

const ADDRESS = "https://app.example.com/api/unsubscribe?token=abc.def";

function oneClick(url = ADDRESS): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "List-Unsubscribe=One-Click",
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("one-click unsubscribe", () => {
  it("passes the token to the API", async () => {
    const api = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", api);

    const response = await POST(oneClick());

    expect(response.status).toBe(200);
    const [url, init] = api.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://localhost:8000/api/v1/email/unsubscribe");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ token: "abc.def" });
  });

  it("rejects a missing token without calling the API", async () => {
    const api = vi.fn();
    vi.stubGlobal("fetch", api);

    expect((await POST(oneClick("https://app.example.com/api/unsubscribe"))).status).toBe(400);
    expect(api).not.toHaveBeenCalled();
  });

  it("passes on a rejected token, and reports an unreachable API", async () => {
    vi.stubGlobal("fetch", async () => new Response("{}", { status: 400 }));
    expect((await POST(oneClick())).status).toBe(400);

    vi.stubGlobal("fetch", async () => {
      throw new TypeError("fetch failed");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await POST(oneClick())).status).toBe(502);
  });

  it("opened in a browser, it shows the page and changes nothing", () => {
    const api = vi.fn();
    vi.stubGlobal("fetch", api);

    const response = GET(new Request(ADDRESS));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://app.example.com/unsubscribe#token=abc.def");
    expect(api).not.toHaveBeenCalled();
  });
});
