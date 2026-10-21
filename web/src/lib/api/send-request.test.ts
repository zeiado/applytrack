// @vitest-environment node
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { apiClient } from "./client";

let server: Server;

beforeAll(async () => {
  // Answers like the API does for a wrong password.
  server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => {
      response.writeHead(401, {
        "Content-Type": "application/json",
        "WWW-Authenticate": "Bearer",
      });
      response.end(JSON.stringify({ error: { code: "invalid_credentials", message: body } }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  vi.stubEnv("API_URL", `http://127.0.0.1:${(server.address() as AddressInfo).port}`);
});

afterAll(() => {
  vi.unstubAllEnvs();
  server.close();
});

describe("API requests with Node's fetch", () => {
  it("returns a 401 with WWW-Authenticate for a POST instead of failing", async () => {
    const { error, response } = await apiClient().POST("/api/v1/auth/login", {
      body: { username: "ada@example.com", password: "wrong", scope: "" },
      bodySerializer: (body) => new URLSearchParams(body as Record<string, string>),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    expect(response.status).toBe(401);
    expect(error?.error.code).toBe("invalid_credentials");
    // The body reached the server intact.
    expect(error?.error.message).toBe("username=ada%40example.com&password=wrong&scope=");
  });
});
