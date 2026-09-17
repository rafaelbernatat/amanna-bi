import { expect, test, type Page } from "@playwright/test";

/**
 * A conversa em tela cheia, no celular da apresentação
 * (D-CONVITE-apresentacao).
 *
 * O servidor do arnês sobe em `fixtures` e sem gateway (ver
 * `playwright.config.ts`): `/conversa` não exige convite nesse modo, e o que
 * se prova aqui é a **tela** — a conversa ocupando o celular inteiro, o
 * gráfico dentro da bolha, o recorte indo para a URL da própria conversa. O
 * caminho do convite é teste de unidade, que cobre os dois envelopes e as duas
 * decisões sem subir dois servidores.
 */

const PERGUNTA = "Como está o turnover?";

/** O que os estagios 1 e 2 levam com fixtures e sem gateway: pouco. */
const ESPERA = 15_000;

async function perguntar(page: Page, texto: string) {
  const campo = page.locator('[data-teste="chat-campo"]');
  await campo.fill(texto);
  await campo.press("Enter");
}

/** O corpo da pagina nao rola na horizontal (T-126, e mais ainda num celular). */
async function rolouNaHorizontal(page: Page): Promise<boolean> {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
}

test.describe("a conversa ocupa o celular", () => {
  test("abre em tela cheia, sem botão flutuante e com o guia da tela", async ({
    page,
  }) => {
    await page.goto("/conversa?tela=rh/turnover");

    const chat = page.locator('[data-teste="chat"]');
    await expect(chat).toBeVisible();
    await expect(chat).toHaveAttribute("data-modo", "cheio");

    // Nada de botão flutuante nem de Fechar: a conversa é a tela.
    await expect(page.locator('[data-teste="chat-flutuante"]')).toHaveCount(0);
    await expect(page.locator('[data-teste="chat-fechar"]')).toHaveCount(0);

    // O guia é o da tela citada, e não o da padrão.
    const guia = page.locator('[data-teste="chat-guia"]');
    await expect(guia).toHaveCount(3);
    await expect(guia.first()).toHaveText("Qual o custo de reposição?");

    // A conversa ocupa a largura toda, e o corpo não rola na horizontal.
    const caixa = await chat.boundingBox();
    expect(caixa?.width).toBeGreaterThan(380);
    expect(await rolouNaHorizontal(page)).toBe(false);
  });

  test("tela fora do inventário abre a conversa na tela padrão", async ({
    page,
  }) => {
    await page.goto("/conversa?tela=xx/yy");
    await expect(page).toHaveURL(/\/conversa\?.*tela=rh%2Fvisao/);
    await expect(page.locator('[data-teste="chat"]')).toBeVisible();
  });
});

test.describe("perguntar pelo celular", () => {
  test("a resposta traz o gráfico na bolha e reescreve a URL da conversa", async ({
    page,
  }) => {
    await page.goto("/conversa?tela=fin/caixa");
    await perguntar(page, PERGUNTA);

    // O gráfico aparece com o número, antes do texto.
    const grafico = page.locator('[data-teste="chat-grafico"]');
    await expect(grafico).toBeVisible({ timeout: ESPERA });
    await expect(grafico).toHaveAttribute("data-painel", "rh-turnover");

    await expect(page.locator('[data-teste="chat-resposta"]')).toBeVisible({
      timeout: ESPERA,
    });

    // A conversa passou a falar de outra tela, e continua em /conversa.
    await expect(page).toHaveURL(/\/conversa\?/);
    await expect(page).toHaveURL(/tela=rh%2Fvisao/);
    await expect(page).toHaveURL(/painel=rh-turnover/);

    // Não há tela ao lado: o botão que levaria para fora não aparece.
    await expect(page.locator('[data-teste="chat-ver-grafico"]')).toHaveCount(
      0,
    );
    await expect(
      page.locator('[data-teste="chat-desfazer"]').first(),
    ).toBeVisible();

    // E o celular continua sem rolagem horizontal, com o gráfico dentro.
    expect(await rolouNaHorizontal(page)).toBe(false);
  });

  test("uma pergunta com recorte refiltra a própria conversa", async ({
    page,
  }) => {
    await page.goto("/conversa?tela=rh/visao");
    await perguntar(page, "Como está o turnover em dezembro?");

    await expect(page.locator('[data-teste="chat-resposta"]')).toBeVisible({
      timeout: ESPERA,
    });
    await expect(page).toHaveURL(/periodo=dezembro/);
    await expect(page).toHaveURL(/\/conversa\?/);
    await expect(
      page.locator('[data-teste="chat-acoes"]').first(),
    ).toContainText("Período: Dezembro");
  });

  test("desfazer volta ao recorte em que a pergunta foi feita", async ({
    page,
  }) => {
    await page.goto("/conversa?tela=rh/visao");
    await perguntar(page, "Como está o turnover em dezembro?");
    await expect(page.locator('[data-teste="chat-resposta"]')).toBeVisible({
      timeout: ESPERA,
    });

    await page.locator('[data-teste="chat-desfazer"]').first().click();
    await expect(page).toHaveURL(/\/conversa\?tela=rh%2Fvisao$/);
  });

  test("a conversa sobrevive a recarregar", async ({ page }) => {
    await page.goto("/conversa?tela=rh/visao");
    await perguntar(page, PERGUNTA);
    await expect(page.locator('[data-teste="chat-resposta"]')).toHaveCount(1, {
      timeout: ESPERA,
    });

    await page.reload();
    await expect(page.locator('[data-teste="chat-pergunta"]')).toHaveText(
      PERGUNTA,
    );
    await expect(page.locator('[data-teste="chat-resposta"]')).toHaveCount(1);
  });
});
