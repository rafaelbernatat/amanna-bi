import { expect, test } from "@playwright/test";

/**
 * CLS zero entre 1280 e 1920 px (T-129).
 *
 * O prototipo mede a largura da janela para calcular o tamanho do painel, e um
 * grafico que so sabe seu tamanho depois de medir pinta duas vezes. Aqui o
 * `viewBox` e fixo e a caixa tem `aspect-ratio`, entao o espaco ja esta
 * reservado no primeiro quadro e nada empurra o que veio antes.
 */

const LARGURAS = [1280, 1440, 1680, 1920];

/** Rotas com desenho servido: a galeria do nucleo e uma tela do produto. */
const ROTAS = ["/verificacao/svg", "/rh/visao"];

async function medirCls(
  page: import("@playwright/test").Page,
  url: string,
): Promise<number> {
  // O observador precisa existir antes de a pagina pintar.
  await page.addInitScript(() => {
    (window as unknown as { __cls: number }).__cls = 0;
    new PerformanceObserver((lista) => {
      for (const entrada of lista.getEntries()) {
        const deslocamento = entrada as PerformanceEntry & {
          value: number;
          hadRecentInput: boolean;
        };
        if (!deslocamento.hadRecentInput) {
          (window as unknown as { __cls: number }).__cls += deslocamento.value;
        }
      }
    }).observe({ type: "layout-shift", buffered: true });
  });

  await page.goto(url, { waitUntil: "load" });
  await page.waitForLoadState("networkidle");
  // Dois quadros: qualquer repintura tardia entra na conta.
  await page.evaluate(
    () =>
      new Promise<void>((ok) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            ok();
          }),
        ),
      ),
  );

  return page.evaluate(() => (window as unknown as { __cls: number }).__cls);
}

test.describe("Deslocamento de layout do desenho servido", () => {
  for (const largura of LARGURAS) {
    for (const url of ROTAS) {
      test(`CLS e zero em ${String(largura)} px na rota ${url}`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: largura, height: 900 });
        const cls = await medirCls(page, url);
        expect(cls, `${url} deslocou o layout em ${String(largura)} px`).toBe(
          0,
        );
      });
    }
  }

  test("a galeria desenha os seis casos de geometria", async ({ page }) => {
    await page.goto("/verificacao/svg");
    await expect(page.locator("[data-caso]")).toHaveCount(6);
    // Depois da revisao de D4 o desenho vem do recharts, no cliente.
    await expect(page.locator("svg.recharts-surface")).toHaveCount(6);
  });

  test("o servidor ja manda a caixa reservada, antes de o grafico montar", async ({
    request,
    baseURL,
  }) => {
    // Sem JavaScript: e o HTML servido, nao a pagina hidratada.
    const resposta = await request.get(`${String(baseURL)}/verificacao/svg`);
    expect(resposta.status()).toBe(200);
    const html = await resposta.text();

    // A caixa existe no HTML inicial, uma por caso...
    const caixas = html.match(/data-grafico/g) ?? [];
    expect(
      caixas.length,
      "o servidor nao reservou nenhuma caixa",
    ).toBeGreaterThanOrEqual(6);

    // ...com altura explicita, que e o que impede o deslocamento.
    expect(html, "a caixa foi servida sem altura").toMatch(/height:\s*200px/);

    // ...e o grafico ainda nao existe: quem segura o espaco e a caixa.
    expect(html).not.toContain("recharts-surface");
  });
});
