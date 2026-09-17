import { defineConfig, devices } from "@playwright/test";

const PORTA = 3100;
const BASE_URL = `http://127.0.0.1:${PORTA}`;

/** O unico arquivo de e2e que escreve estado no servidor (a marca, D-MARCA). */
const MARCA = /marca\.spec\.ts$/;

// Os dois tamanhos nomeados no criterio de aceite de T-126.
const GRANDE = {
  ...devices["Desktop Chrome"],
  viewport: { width: 1440, height: 900 },
};
const PEQUENO = {
  ...devices["Desktop Chrome"],
  viewport: { width: 1280, height: 720 },
};

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
      testIgnore: MARCA,
      use: GRANDE,
    },
    {
      name: "1280x720",
      testIgnore: MARCA,
      use: PEQUENO,
    },
    /*
     * A marca roda nos dois tamanhos, mas **um tamanho depois do outro**.
     *
     * A marca vale para a instalacao inteira e o arnes tem um servidor so.
     * `mode: "serial"` dentro do arquivo ordena os casos de um projeto, e nao
     * impede que o mesmo arquivo rode ao mesmo tempo noutro projeto: o
     * `limpar` do afterEach de um tamanho apagava a proposta que o outro
     * tamanho estava prestes a aplicar, e o caso caia em "sem proposta". A
     * dependencia entre os dois projetos e o unico jeito de o Playwright
     * garantir que eles nao se sobreponham — e os demais arquivos continuam
     * paralelos, porque nao escrevem estado nenhum.
     */
    {
      name: "marca · 1440x900",
      testMatch: MARCA,
      use: GRANDE,
    },
    {
      name: "marca · 1280x720",
      testMatch: MARCA,
      dependencies: ["marca · 1440x900"],
      use: PEQUENO,
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
     *
     * `OPENROUTER_API_KEY` vazia, de proposito. O `.env.local` de quem
     * desenvolve pode ter a chave, e o Next a carregaria no `next start`; com
     * ela o chat do e2e iria ao gateway a cada pergunta -- lento, pago e
     * dependente de rede. Vazia, o chat responde pelo interpretador local, com
     * o mesmo numero: o que o e2e prova e a tela, e nao a redacao do modelo.
     */
    env: {
      DATA_SOURCE: "fixtures",
      AUTH_PROVIDER: "fixtures",
      OPENROUTER_API_KEY: "",
      /*
       * A personalizacao de marca ligada, em memoria e sobre sites de arnes.
       *
       * `memoria` porque cada subida comeca sem marca e um caso nao contamina
       * o proximo; `fixtures` porque o servidor de teste nao pode buscar um
       * site de verdade -- seria lento, dependeria de rede, e o resultado
       * mudaria quando o site mudasse. O que **nao** muda e a guarda de
       * endereco: ela fica na frente dos dois adaptadores, e o teste de
       * unidade confere os dois com a mesma tabela.
       */
      MARCA_ARMAZEM: "memoria",
      MARCA_SITE: "fixtures",
    },
    url: BASE_URL,
    reuseExistingServer: !process.env["CI"],
    timeout: 180_000,
  },
});
