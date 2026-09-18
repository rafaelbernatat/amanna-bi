import { expect, test, type Page } from "@playwright/test";

/** O segredo do arnês, o mesmo de `playwright.config.ts`. Não serve fora daqui. */
const SEGREDO_DO_ARNES = "arnes-de-teste-do-amanna-bi-32-ou-mais";

/** Assina um envelope como `src/seguranca/convite.ts`: base64url do JSON, ponto, HMAC. */
async function assinarEnvelope(
  objeto: Record<string, unknown>,
  segredo: string,
): Promise<string> {
  const payload = Buffer.from(JSON.stringify(objeto)).toString("base64url");
  const chave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(segredo),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const assinatura = await crypto.subtle.sign(
    "HMAC",
    chave,
    new TextEncoder().encode(payload),
  );
  return `${payload}.${Buffer.from(assinatura).toString("base64url")}`;
}

/** Escaneia o QR da tela de apresentação: chega ao cadastro (D-CONVIDADO). */
async function entrarPeloQr(page: Page, tela: string): Promise<void> {
  await page.goto(`/apresentar?tela=${tela}`);
  const endereco = await page
    .locator('[data-teste="endereco-do-convite"]')
    .textContent();
  await page.goto(endereco ?? "");
}

async function cadastrar(page: Page, nome: string, email: string) {
  await page.locator('[data-teste="cadastro-nome"]').fill(nome);
  await page.locator('[data-teste="cadastro-email"]').fill(email);
  await page.locator('[data-teste="entrar-na-conversa"]').click();
}

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

test.describe("o convidado do QR (D-CONVIDADO-cadastro)", () => {
  test("escanear pede nome e e-mail; e-mail incompleto volta com erro; depois a conversa sabe o nome", async ({
    page,
  }) => {
    await entrarPeloQr(page, "rh/turnover");
    await expect(
      page.locator('[data-teste="cadastro-de-convidado"]'),
    ).toBeVisible();
    await expect(page.locator('[data-teste="chat"]')).toHaveCount(0);
    await expect(page.locator('[data-teste="consentimento"]')).toContainText(
      "autoriza a Dreamy",
    );

    // Passa na validação do navegador, e não na nossa: o servidor devolve.
    await cadastrar(page, "Ana Souza", "ana@dreamy");
    await expect(page).toHaveURL(/erro=email/);
    await expect(
      page.locator('[data-teste="cadastro-de-convidado"]'),
    ).toHaveAttribute("data-erro", "email");

    await cadastrar(page, "Ana Souza", "ana@exemplo.com.br");
    await expect(page.locator('[data-teste="chat"]')).toHaveAttribute(
      "data-modo",
      "cheio",
    );
    await expect(page).toHaveURL(/tela=rh%2Fturnover/);
    await expect(page.locator('[data-teste="chat-saudacao"]')).toContainText(
      "Olá, Ana!",
    );
    await expect(page.locator('[data-teste="chat-quem"]')).toContainText("Ana");
    await expect(page.locator('[data-teste="chat-restantes"]')).toHaveText(
      /Restam 5 de 5/,
    );
    await expect(page.locator('[data-teste="chat-nova"]')).toHaveCount(0);
  });

  test("cinco perguntas; a sexta abre o convite; o clique é gravado; fechar tranca; recarregar mantém", async ({
    page,
    context,
  }) => {
    await entrarPeloQr(page, "rh/visao");
    await cadastrar(page, "Bruno Lima", "bruno@exemplo.com.br");
    await expect(page.locator('[data-teste="chat"]')).toBeVisible();

    const CINCO = 5;
    for (let i = 1; i <= CINCO; i += 1) {
      await perguntar(page, PERGUNTA);
      await expect(page.locator('[data-teste="chat-resposta"]')).toHaveCount(
        i,
        { timeout: ESPERA },
      );
    }
    await expect(page.locator('[data-teste="chat-restantes"]')).toHaveText(
      /Restam 0 de 5/,
    );

    // A sexta tentativa nao vai ao servidor: abre o convite.
    await perguntar(page, PERGUNTA);
    const convite = page.locator('[data-teste="convite-dreamy"]');
    await expect(convite).toBeVisible();
    await expect(convite).toHaveAttribute("data-origem", "limite");
    await expect(convite).toContainText("Gostou desta solução?");
    await expect(convite).toContainText(
      "Clique aqui e saiba como aplicar na sua empresa",
    );
    await expect(page.locator('[data-teste="chat-pergunta"]')).toHaveCount(
      CINCO,
    );

    // O clique: o site abre noutra aba (interceptado) e o registro chega.
    await context.route("**/dreamy.app.br/**", (rota) =>
      rota.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<p>ok</p>",
      }),
    );
    const [registro, aba] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().endsWith("/api/interesse") && r.status() === 204,
      ),
      context.waitForEvent("page"),
      page.locator('[data-teste="ir-para-dreamy"]').click(),
    ]);
    expect(registro.status()).toBe(204);
    await aba.close();

    await page.locator('[data-teste="fechar-convite"]').click();
    await expect(convite).toHaveCount(0);
    await expect(page.locator('[data-teste="chat-trancado"]')).toBeVisible();
    await expect(page.locator('[data-teste="chat-campo"]')).toBeDisabled();

    // Recarregar: a cota vem do servidor, e a proxima tentativa reabre o convite.
    await page.reload();
    await expect(page.locator('[data-teste="chat-restantes"]')).toHaveText(
      /Restam 0 de 5/,
    );
    await perguntar(page, PERGUNTA);
    await expect(page.locator('[data-teste="convite-dreamy"]')).toBeVisible();
  });

  test("abrir uma tela do painel no celular volta a conversa", async ({
    page,
  }) => {
    await entrarPeloQr(page, "rh/visao");
    await cadastrar(page, "Carla Dias", "carla@exemplo.com.br");
    await expect(page.locator('[data-teste="chat"]')).toBeVisible();

    await page.goto("/rh/visao");
    await expect(page).toHaveURL(/\/conversa\?/);
    await expect(page.locator('[data-teste="chat"]')).toBeVisible();
  });

  test("quando a sessao vence, o mesmo convite abre pelo relogio", async ({
    page,
  }) => {
    // Um convite curto, assinado com o segredo do arnes: vence em segundos.
    const SEGUNDOS = 12;
    const agora = Math.floor(Date.now() / 1000);
    const token = await assinarEnvelope(
      {
        v: 1,
        tipo: "convite",
        sala: "demo",
        perfil: "auditor",
        expira: agora + SEGUNDOS,
      },
      SEGREDO_DO_ARNES,
    );
    await page.goto(
      `/entrar?convite=${token}&ir=${encodeURIComponent("/conversa?tela=rh/visao")}`,
    );
    await cadastrar(page, "Davi Rocha", "davi@exemplo.com.br");
    await expect(page.locator('[data-teste="chat"]')).toBeVisible();

    const convite = page.locator('[data-teste="convite-dreamy"]');
    await expect(convite).toBeVisible({ timeout: (SEGUNDOS + 5) * 1000 });
    await expect(convite).toHaveAttribute("data-origem", "expiracao");
  });
});
