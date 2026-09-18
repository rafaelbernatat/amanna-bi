import { defineConfig, devices } from "@playwright/test";

/*
 * A porta do arnes, com escape por ambiente.
 *
 * `reuseExistingServer` e o que deixa reexecutar o e2e sem esperar um build
 * novo, e o preco dele e este: se **qualquer** processo estiver escutando a
 * porta, o Playwright o adota sem perguntar de quem e. Aconteceu — outro
 * projeto da mesma maquina subiu na 3100, e a suite inteira foi medir a
 * aplicacao errada, com 200 falhas que nao tinham nada a ver com o codigo.
 *
 * `E2E_PORTA` e a saida quando a porta padrao estiver tomada. O sintoma tem
 * cara propria: quase tudo falha de uma vez, inclusive casos que nao tocam a
 * mudanca. Antes de investigar o produto, conferir quem atende a porta.
 */
const PORTA = Number(process.env["E2E_PORTA"] ?? 3100);
const BASE_URL = `http://127.0.0.1:${PORTA}`;

/** O unico arquivo de e2e que escreve estado no servidor (a marca, D-MARCA). */
const MARCA = /marca\.spec\.ts$/;

/** A conversa em tela cheia, que so faz sentido num tamanho de celular. */
const CONVERSA = /conversa\.spec\.ts$/;

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
      testIgnore: [MARCA, CONVERSA],
      use: GRANDE,
    },
    {
      name: "1280x720",
      testIgnore: [MARCA, CONVERSA],
      use: PEQUENO,
    },
    /*
     * O celular da apresentacao (D-CONVITE-apresentacao).
     *
     * Viewport de iPhone 13 sobre o **mesmo** Chromium dos outros projetos, e
     * nao WebKit. O que este projeto prova e o layout de 390 px — a conversa
     * ocupando a tela, o rodape que o teclado nao cobre, o grafico na bolha
     * sem rolagem horizontal —, e isso nao depende do motor. Um terceiro
     * navegador no CI custa uns 100 MB de download por rodada para provar a
     * mesma coisa; quando houver caso que dependa do motor da Apple, ele entra
     * com a razao escrita.
     */
    {
      name: "celular",
      testMatch: CONVERSA,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: false,
        hasTouch: true,
      },
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
      /*
       * A apresentacao ligada, num modo de sessao aberto.
       *
       * E o arranjo que Produto pediu e que o arnes precisa cobrir: o painel
       * abre sem link nenhum (`AUTH_PROVIDER` acima continua `fixtures`) e o
       * botao do QR existe assim mesmo. O segredo e de arnes, nao serve fora
       * daqui, e por isso mora no arquivo -- rodar o e2e nao pode depender de
       * variavel que so uma maquina tem.
       */
      CONVITE_SEGREDO: "arnes-de-teste-do-amanna-bi-32-ou-mais",
    },
    url: BASE_URL,
    reuseExistingServer: !process.env["CI"],
    timeout: 180_000,
  },
});
