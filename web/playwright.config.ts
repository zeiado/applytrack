import os from "node:os";
import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

// End-to-end tests: the real API (with PostgreSQL) and the built web app.
// Locally: `make db` in the repo root, then `npm run build && npm run e2e`.
const API_PORT = 8000;
const WEB_PORT = 3000;
const DATABASE_URL =
  process.env.APPLYTRACK_DATABASE_URL ??
  "postgresql+psycopg://applytrack:applytrack@localhost:5432/applytrack";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/warm-up.ts",
  timeout: 60_000,
  fullyParallel: true,
  // Parallel browsers against one local server stall static files for 10-second steps
  // on Windows, so locally run one at a time. CI (Linux) runs two.
  workers: process.env.CI ? 2 : 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: `uv run alembic upgrade head && uv run uvicorn applytrack.main:app --port ${API_PORT}`,
      cwd: "..",
      url: `http://localhost:${API_PORT}/ready`,
      stdout: "pipe", // the API's request log, to see what a failing test did
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        APPLYTRACK_DATABASE_URL: DATABASE_URL,
        APPLYTRACK_EMAIL_BACKEND: "console",
        APPLYTRACK_PUBLIC_APP_URL: `http://localhost:${WEB_PORT}`,
        // CV uploads go to a local folder, and the worker reads them inside the API.
        APPLYTRACK_STORAGE_LOCAL_DIR: path.join(os.tmpdir(), "sekka-e2e-storage"),
        APPLYTRACK_STORAGE_LOCAL_URL: `http://localhost:${API_PORT}`,
        APPLYTRACK_RUN_WORKER_IN_API: "true",
        APPLYTRACK_WORKER_POLL_SECONDS: "0.5",
      },
    },
    {
      command: `npm run start -- --port ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}/en`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      // 127.0.0.1: uvicorn listens on IPv4 only, so this skips trying ::1 first.
      env: { API_URL: `http://127.0.0.1:${API_PORT}` },
    },
  ],
});
