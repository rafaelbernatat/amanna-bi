import { defineConfig, devices } from "@playwright/test";

const PORTA = 3100;
const BASE_URL = `http://127.0.0.1:${PORTA}`;

/**
 * Arnes de e2e (T-005.1).
 *
 * O `webServer` sobe a aplicacao sozinho — build de producao e `next start` —
 * para que `npm run e2e` nao dependa de nenhum passo manual, nem local nem no
 * pipeline (T-006).
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 1 : 0,
  reporter: process.env["CI"]
    ? [["list"], ["html", { open: "never" }]]
    : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run build && npx next start --port ${PORTA}`,
    url: BASE_URL,
    reuseExistingServer: !process.env["CI"],
    timeout: 180_000,
  },
});
