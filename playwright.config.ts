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
  // Os dois tamanhos nomeados no criterio de aceite de T-126. Todo caso de e2e
  // roda nos dois: e o unico jeito de a regra "o body nunca rola na horizontal"
  // significar alguma coisa.
  projects: [
    {
      name: "1440x900",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "1280x720",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 720 },
      },
    },
  ],
  webServer: {
    command: `npm run build && npx next start --port ${PORTA}`,
    /*
     * O boot valida a configuracao e aborta sem `DATA_SOURCE` (T-139).
     *
     * Estava so no workflow do CI, e por isso o e2e local subia sem ela --
     * mas so porque o servidor era reaproveitado de antes de a validacao
     * existir. Num clone limpo, `npm run e2e` nao subia. Declarar aqui deixa
     * local e pipeline com o mesmo ambiente, que e a unica forma de o verde
     * local significar alguma coisa.
     */
    env: { DATA_SOURCE: "fixtures", AUTH_PROVIDER: "fixtures" },
    url: BASE_URL,
    reuseExistingServer: !process.env["CI"],
    timeout: 180_000,
  },
});
