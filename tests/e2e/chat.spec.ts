import { expect, test, type Page } from "@playwright/test";

/**
 * O chat como conversa (secao 7; decisao D-CHAT-conversa-flutuante).
 *
 * O servidor do e2e sobe sem gateway (ver `playwright.config.ts`): o que se
 * prova aqui e o comportamento de tela — o botao flutuante, a conversa que
 * continua, o painel que aparece na vista — e nao a redacao do modelo. O
 * numero e o mesmo com ou sem gateway; e o estagio 2 quem o produz.
 */

const PERGUNTA = "Como está o turnover?";

/** O tempo que os estagios 1 e 2 levam com fixtures e sem gateway: pouco. */
const ESPERA = 15_000;

async function abrirChat(page: Page) {
  await page.locator('[data-teste="chat-abrir"]').click();
  const chat = page.getByRole("complementary", {
    name: "Conversa com os dados",
  });
  await expect(chat).toBeVisible();
  return chat;
}

async function perguntar(page: Page, texto: string) {
  const campo = page.locator('[data-teste="chat-campo"]');
  await campo.fill(texto);
  await campo.press("Enter");
}

test.describe("o botao flutuante", () => {
  test("esta em toda tela, e abre a conversa encostada a direita", async ({
    page,
  }) => {
    await page.goto("/fin/caixa");
    const flutuante = page.locator('[data-teste="chat-flutuante"]');
    await expect(flutuante).toBeVisible();
    await expect(page.locator('[data-teste="chat"]')).toHaveCount(0);

    const chat = await abrirChat(page);
    await expect(flutuante).toHaveCount(0);

    // Encostada, e nao sobreposta: a conversa ocupa uma coluna propria e a
    // tela encolhe para caber ao lado. E o que deixa o painel destacado
    // visivel enquanto a resposta fala dele.
    const conteudo = await page
      .locator('[data-teste="conteudo"]')
      .boundingBox();
    const caixaDoChat = await chat.boundingBox();
    expect(conteudo).not.toBeNull();
    expect(caixaDoChat).not.toBeNull();
    if (conteudo === null || caixaDoChat === null) return;
    expect(conteudo.x + conteudo.width).toBeLessThanOrEqual(caixaDoChat.x + 1);

    // O guia da tela: as tres perguntas de fin/caixa.
    await expect(chat.locator('[data-teste="chat-guia"]')).toHaveCount(3);
    await expect(chat.locator('[data-teste="chat-guia"]').first()).toHaveText(
      "Qual o saldo de caixa?",
    );
  });

  test("Escape fecha, e o botao volta", async ({ page }) => {
    await page.goto("/rh/visao");
    const chat = await abrirChat(page);
    await chat.locator('[data-teste="chat-campo"]').press("Escape");
    await expect(chat).toHaveCount(0);
    await expect(page.locator('[data-teste="chat-flutuante"]')).toBeVisible();
  });
});

test.describe("a resposta filtra a tela e destaca o grafico", () => {
  test("uma sugestao do guia responde, navega e deixa o painel na vista", async ({
    page,
  }) => {
    await page.goto("/rh/turnover");
    const chat = await abrirChat(page);

    await chat
      .locator('[data-teste="chat-guia"]', { hasText: "desligamentos" })
      .click();

    await expect(chat.locator('[data-teste="chat-pergunta"]')).toHaveText(
      "Quantos desligamentos tivemos?",
    );
    await expect(chat.locator('[data-teste="chat-resposta"]')).toBeVisible({
      timeout: ESPERA,
    });

    // A URL carrega o painel destacado (secao 6.6), e a tela o marca.
    await expect(page).toHaveURL(/\/rh\/turnover\?painel=tov-tipos$/);
    const destacado = page.locator('[data-teste="painel"][data-destacado="1"]');
    await expect(destacado).toHaveAttribute("data-painel", "tov-tipos");
    await expect(
      destacado.locator('[data-teste="rotulo-de-referencia"]'),
    ).toHaveText("Gráfico referenciado pela IA");
    await expect(destacado).toBeInViewport({ ratio: 0.5 });

    // O que a resposta fez com a tela, dito na conversa; e o proximo passo.
    const acoes = chat.locator('[data-teste="chat-acoes"]');
    await expect(acoes).toContainText("Tela: Recursos Humanos · Turnover");
    await expect(
      chat.locator('[data-teste="chat-atalhos"] button').first(),
    ).toBeVisible();
  });

  test("a pergunta de outra tela leva ate ela, no recorte da pergunta", async ({
    page,
  }) => {
    await page.goto("/fin/caixa");
    await abrirChat(page);
    await perguntar(page, "Como está o turnover em dezembro?");

    await expect(page).toHaveURL(
      /\/rh\/visao\?periodo=dezembro&painel=rh-turnover$/,
      {
        timeout: ESPERA,
      },
    );
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Visão geral",
    );
    await expect(
      page.locator('[data-teste="banner-de-recorte"]'),
    ).toContainText("Período: Dezembro");
    await expect(
      page.locator('[data-teste="painel"][data-destacado="1"]'),
    ).toHaveAttribute("data-painel", "rh-turnover");
  });

  test("desfazer volta a tela e ao recorte de origem (RF-14)", async ({
    page,
  }) => {
    await page.goto("/fin/caixa?periodo=dezembro");
    const chat = await abrirChat(page);
    await perguntar(page, PERGUNTA);
    await expect(page).toHaveURL(
      /\/rh\/visao\?periodo=dezembro&painel=rh-turnover$/,
      {
        timeout: ESPERA,
      },
    );

    await chat.locator('[data-teste="chat-desfazer"]').first().click();
    await expect(page).toHaveURL(/\/fin\/caixa\?periodo=dezembro$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Fluxo de caixa",
    );
  });
});

test.describe("a conversa continua", () => {
  test("um acompanhamento de recorte herda a metrica e refiltra o painel", async ({
    page,
  }) => {
    await page.goto("/rh/visao");
    const chat = await abrirChat(page);
    await perguntar(page, PERGUNTA);
    await expect(chat.locator('[data-teste="chat-resposta"]')).toHaveCount(1, {
      timeout: ESPERA,
    });

    await chat
      .locator('[data-teste="chat-atalhos"] button', {
        hasText: "E só em dezembro?",
      })
      .click();

    await expect(chat.locator('[data-teste="chat-pergunta"]')).toHaveCount(2);
    await expect(chat.locator('[data-teste="chat-resposta"]')).toHaveCount(2, {
      timeout: ESPERA,
    });
    await expect(page).toHaveURL(
      /\/rh\/visao\?periodo=dezembro&painel=rh-turnover$/,
    );
    await expect(
      page.locator('[data-teste="banner-de-recorte"]'),
    ).toContainText("Período: Dezembro");
    // A segunda resposta e sobre a mesma metrica: o painel destacado e o mesmo.
    await expect(
      chat.locator('[data-teste="chat-acoes"]').nth(1),
    ).toContainText("Período: Dezembro");
  });

  test("sobrevive a trocar de modulo e a recarregar", async ({ page }) => {
    await page.goto("/rh/visao");
    const chat = await abrirChat(page);
    await perguntar(page, PERGUNTA);
    await expect(chat.locator('[data-teste="chat-resposta"]')).toHaveCount(1, {
      timeout: ESPERA,
    });

    await page
      .getByRole("navigation", { name: "Módulos" })
      .getByRole("link", { name: "Financeiro" })
      .click();
    await expect(page).toHaveURL(/\/fin\/visao$/);
    await expect(chat.locator('[data-teste="chat-pergunta"]')).toHaveText(
      PERGUNTA,
    );

    await page.reload();
    const deNovo = page.getByRole("complementary", {
      name: "Conversa com os dados",
    });
    await expect(deNovo).toBeVisible();
    await expect(deNovo.locator('[data-teste="chat-pergunta"]')).toHaveText(
      PERGUNTA,
    );
    await expect(deNovo.locator('[data-teste="chat-resposta"]')).toHaveCount(1);

    // "Nova conversa" limpa, e a tela fica onde esta.
    await deNovo.locator('[data-teste="chat-nova"]').click();
    await expect(deNovo.locator('[data-teste="chat-pergunta"]')).toHaveCount(0);
    await expect(page).toHaveURL(/\/fin\/visao$/);
  });

  test("um link com ?pergunta= abre a conversa ja perguntando", async ({
    page,
  }) => {
    await page.goto(`/rh/visao?pergunta=${encodeURIComponent(PERGUNTA)}`);
    const chat = page.getByRole("complementary", {
      name: "Conversa com os dados",
    });
    await expect(chat).toBeVisible();
    await expect(chat.locator('[data-teste="chat-pergunta"]')).toHaveText(
      PERGUNTA,
    );
    await expect(page).toHaveURL(/\/rh\/visao\?painel=rh-turnover$/, {
      timeout: ESPERA,
    });
  });
});

test.describe("a resposta traz o grafico e as leituras (D-CHAT-ferramentas)", () => {
  test("uma pergunta simples desenha o painel destacado dentro da conversa", async ({
    page,
  }) => {
    await page.goto("/rh/visao");
    const chat = await abrirChat(page);
    await perguntar(page, PERGUNTA);
    await expect(chat.locator('[data-teste="chat-resposta"]')).toBeVisible({
      timeout: ESPERA,
    });
    // O mesmo envelope que a tela desenha, na bolha: nada e relido.
    const grafico = chat.locator('[data-teste="chat-grafico"]');
    await expect(grafico).toBeVisible();
    await expect(grafico).toHaveAttribute("data-painel", "rh-turnover");
    // A moldura da tela continua unica: o grafico do chat nao e um painel.
    await expect(
      page.locator('[data-teste="painel"][data-painel="rh-turnover"]'),
    ).toHaveCount(1);
  });

  test("'o que esse grafico mostra?' explica o painel em foco sem sair da tela", async ({
    page,
  }) => {
    await page.goto("/fin/visao?painel=fin-dre");
    const chat = await abrirChat(page);
    await perguntar(page, "O que esse gráfico mostra?");

    const resposta = chat.locator('[data-teste="chat-resposta"]');
    await expect(resposta).toBeVisible({ timeout: ESPERA });
    // Sem gateway, o resumo e deterministico: o painel em foco e lido pela
    // ferramenta explicar_grafico, e a leitura aparece na resposta.
    const leituras = chat.locator('[data-teste="chat-leitura-de-ferramenta"]');
    await expect(leituras.first()).toHaveAttribute(
      "data-ferramenta",
      "explicar_grafico",
    );
    await expect(resposta).toContainText(/ponte da DRE|DRE/i);
    await expect(page).toHaveURL(/\/fin\/visao\?/);
    await expect(
      page.locator('[data-teste="painel"][data-destacado="1"]'),
    ).toHaveAttribute("data-painel", "fin-dre");
  });

  test("uma pergunta composta sem gateway recebe a recusa util, sem navegar", async ({
    page,
  }) => {
    await page.goto("/rh/visao");
    const chat = await abrirChat(page);
    await perguntar(page, "Compare a margem líquida com o turnover");
    const recusa = chat.locator('[data-teste="chat-recusa"]');
    await expect(recusa).toBeVisible({ timeout: ESPERA });
    await expect(recusa).toContainText(/uma métrica por vez/);
    await expect(page).toHaveURL(/\/rh\/visao$/);
  });
});

test.describe("o que o chat recusa", () => {
  test("pergunta fora do catalogo recebe recusa, sem numero e sem navegar", async ({
    page,
  }) => {
    await page.goto("/rh/visao");
    const chat = await abrirChat(page);
    await perguntar(page, "Quanto vale a empresa?");

    await expect(chat.locator('[data-teste="chat-recusa"]')).toBeVisible({
      timeout: ESPERA,
    });
    await expect(chat.locator('[data-teste="chat-recusa"]')).toContainText(
      /não tenho/i,
    );
    await expect(page).toHaveURL(/\/rh\/visao$/);
    await expect(
      page.locator('[data-teste="painel"][data-destacado="1"]'),
    ).toHaveCount(0);
  });
});

test.describe("o painel destacado fica na vista sem rolagem manual (RF-13)", () => {
  test("um painel abaixo da dobra e rolado ate a vista depois da resposta", async ({
    page,
  }) => {
    // A ponte da DRE e o quarto painel de fin/visao: comeca abaixo da dobra
    // nos dois tamanhos de tela. Sem rolagem, a pessoa nao a veria.
    await page.goto("/fin/visao");
    await abrirChat(page);
    await perguntar(page, "Qual o lucro apurado do ano?");

    await expect(page).toHaveURL("/fin/visao?painel=fin-dre", {
      timeout: ESPERA,
    });
    const destacado = page.locator('[data-teste="painel"][data-destacado="1"]');
    await expect(destacado).toHaveAttribute("data-painel", "fin-dre");
    await expect(destacado).toBeInViewport({ ratio: 0.5 });

    const rolagem = await page
      .locator('[data-teste="conteudo"]')
      .evaluate((el) => el.scrollTop);
    expect(rolagem, "a tela nao rolou ate o painel").toBeGreaterThan(0);
  });

  test("colar a URL com painel= tambem rola ate ele", async ({ page }) => {
    await page.goto("/fin/visao?painel=fin-dre");
    const destacado = page.locator('[data-teste="painel"][data-destacado="1"]');
    await expect(destacado).toBeInViewport({ ratio: 0.5 });
  });
});

test.describe("um grafico para toda resposta (T-432)", () => {
  test("uma metrica sem painel na tela desenha a propria serie de doze meses na bolha", async ({
    page,
  }) => {
    await page.goto("/fin/visao");
    const chat = await abrirChat(page);
    await perguntar(page, "Qual o ROE?");
    await expect(chat.locator('[data-teste="chat-resposta"]')).toBeVisible({
      timeout: ESPERA,
    });
    const grafico = chat.locator('[data-teste="chat-grafico"]');
    await expect(grafico).toBeVisible();
    await expect(grafico).toHaveAttribute("data-painel", "chat-serie-roe");
    // Nao ha painel na tela para destacar: a URL nao ganha painel=.
    await expect(page).not.toHaveURL(/painel=/);
  });
});
