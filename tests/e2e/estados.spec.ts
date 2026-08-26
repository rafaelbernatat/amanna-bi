import { expect, test } from "@playwright/test";

/**
 * Os seis estados e a altura do esqueleto, medidos no navegador (T-132).
 *
 * O que só o navegador prova, e por isso está aqui e não em `tests/unidade`:
 *
 * 1. **a altura resolvida.** O teste de unidade confere que o esqueleto declara
 *    a altura da tabela; este confere que o navegador chega ao mesmo número
 *    depois de aplicar `box-sizing`, borda, `flex` e o resto do CSS. Uma borda
 *    de 1 px em `content-box` já bastaria para o declarado e o desenhado
 *    divergirem, e o HTML servido continuaria dizendo a coisa certa.
 *
 * 2. **que os seis estados chegam à tela juntos.** A página os desenha lado a
 *    lado; se algum sumisse por erro de renderização no cliente, o HTML
 *    servido não avisaria.
 */

/** A folga que o aceite dá. A diferença medida é zero — ver `altura.ts`. */
const FOLGA_EM_PX = 4;

const ESTADOS = [
  "carregando",
  "com_dado",
  "vazio_no_recorte",
  "erro_de_fonte",
  "sem_permissao",
  "defasado",
];

test.describe("os seis estados da seção 6.4", () => {
  test("os seis painéis e os seis cartões chegam à tela", async ({ page }) => {
    await page.goto("/verificacao/estados");

    for (const estado of ESTADOS) {
      await expect(
        page.locator(`[data-caso-de-painel="${estado}"]`),
        `painel em ${estado}`,
      ).toBeVisible();
      await expect(
        page.locator(`[data-caso-de-cartao="${estado}"]`),
        `cartão em ${estado}`,
      ).toBeVisible();
    }
  });

  test("o esqueleto e a caixa final têm a mesma altura nas 12 formas", async ({
    page,
  }) => {
    await page.goto("/verificacao/estados");

    const pares = page.locator("[data-forma-medida]");
    const quantas = await pares.count();

    // As doze do Anexo A.1. Menos que isso é forma que deixou de ser medida.
    expect(quantas).toBe(12);

    for (let i = 0; i < quantas; i += 1) {
      const par = pares.nth(i);
      const forma = await par.getAttribute("data-forma-medida");

      const esqueleto = await par
        .locator('[data-medida="esqueleto"] [data-teste="esqueleto"]')
        .boundingBox();
      const final = await par
        .locator('[data-medida="final"] [data-grafico]')
        .boundingBox();

      expect(
        esqueleto,
        `${String(forma)}: esqueleto não desenhou`,
      ).not.toBeNull();
      expect(
        final,
        `${String(forma)}: caixa final não desenhou`,
      ).not.toBeNull();
      if (esqueleto === null || final === null) continue;

      expect(
        Math.abs(esqueleto.height - final.height),
        `${String(forma)}: esqueleto ${String(esqueleto.height)} px, final ${String(final.height)} px`,
      ).toBeLessThanOrEqual(FOLGA_EM_PX);
    }
  });

  test("o painel sem permissão não serve agregado", async ({ page }) => {
    /*
     * Medido sobre o HTML **servido**, e não sobre o DOM depois de hidratar: o
     * risco da seção 11 é o número sair do servidor, e um `display: none` no
     * cliente não desfaz isso — quem quiser o valor lê o fonte da página.
     */
    const resposta = await page.goto("/verificacao/estados");
    const html = (await resposta?.text()) ?? "";

    const bloco = /data-caso-de-painel="sem_permissao"[\s\S]*?<\/section>/.exec(
      html,
    );
    expect(bloco, "o caso sem_permissao sumiu da página").not.toBeNull();
    expect(bloco?.[0] ?? "").toContain("Você não tem acesso a este recorte");
    // Nenhum dígito de três ou mais casas: agregado não tem como caber nisso.
    expect(bloco?.[0] ?? "").not.toMatch(/>\s*[\d.,]{3,}\s*</);
  });

  test("o esqueleto não pisca valor antes do dado chegar", async ({ page }) => {
    await page.goto("/verificacao/estados");

    const carregando = page.locator(
      '[data-caso-de-painel="carregando"] [data-teste="esqueleto"]',
    );
    await expect(carregando).toBeVisible();
    await expect(carregando).toHaveAttribute("aria-busy", "true");

    // Nenhum texto numérico dentro do esqueleto: ele é silhueta, não dado.
    const texto = (await carregando.innerText()).trim();
    expect(texto).toBe("");
  });

  test("o selo de dado defasado aparece em destaque", async ({ page }) => {
    await page.goto("/verificacao/estados");

    const selo = page.locator(
      '[data-caso-de-painel="defasado"] [data-teste="selo-de-frescor"]',
    );
    await expect(selo).toBeVisible();
    await expect(selo).toHaveAttribute("data-defasado", "1");
    // Cor nunca é o único sinal (seção 13): a palavra está escrita.
    await expect(selo).toContainText("Dado defasado");
  });
});
