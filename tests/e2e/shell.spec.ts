import { expect, test } from "@playwright/test";

/**
 * O shell e as 13 rotas (T-126; decisao D-CHAT-conversa-flutuante).
 *
 * Roda nos dois tamanhos que o criterio de aceite nomeia — 1440x900 e 1280x720
 * — porque cada projeto do playwright.config.ts fixa um deles.
 */

const ROTAS = [
  { url: "/rh/visao", titulo: "Visão geral", crumb: "Recursos Humanos" },
  { url: "/rh/colab", titulo: "Colaboradores", crumb: "Recursos Humanos" },
  { url: "/rh/turnover", titulo: "Turnover", crumb: "Recursos Humanos" },
  { url: "/rh/recrut", titulo: "Recrutamento", crumb: "Recursos Humanos" },
  { url: "/rh/trein", titulo: "Treinamento", crumb: "Recursos Humanos" },
  { url: "/rh/engaj", titulo: "Engajamento", crumb: "Recursos Humanos" },
  { url: "/rh/sal", titulo: "Salários", crumb: "Recursos Humanos" },
  {
    url: "/fin/visao",
    titulo: "Visão financeira",
    crumb: "Financeiro e controladoria",
  },
  {
    url: "/fin/caixa",
    titulo: "Fluxo de caixa",
    crumb: "Financeiro e controladoria",
  },
  {
    url: "/fin/orc",
    titulo: "Orçamentário",
    crumb: "Financeiro e controladoria",
  },
  {
    url: "/fin/contas",
    titulo: "Contas a pagar/receber",
    crumb: "Financeiro e controladoria",
  },
  {
    url: "/fin/fat",
    titulo: "Faturamento",
    crumb: "Financeiro e controladoria",
  },
  { url: "/int/cruz", titulo: "RH × Financeiro", crumb: "Integração" },
] as const;

test.describe("As 13 rotas resolvem no servidor", () => {
  for (const rota of ROTAS) {
    test(`${rota.url} responde 200 com titulo e breadcrumb proprios`, async ({
      page,
    }) => {
      const resposta = await page.goto(rota.url);
      expect(resposta?.status()).toBe(200);

      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        rota.titulo,
      );
      // Breadcrumb: modulo · ano do recorte (PRD secao 6.1).
      await expect(page.getByText(`${rota.crumb} · 2026`)).toBeVisible();
    });
  }

  test("slug invalido devolve 404", async ({ page }) => {
    for (const url of ["/rh/nao-existe", "/xx/visao", "/int/visao"]) {
      const resposta = await page.goto(url);
      expect(resposta?.status(), url).toBe(404);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        "Tela não encontrada",
      );
    }
  });
});

test.describe("O shell", () => {
  test("os tres modulos sao abas no cabecalho, e nao ha barra lateral", async ({
    page,
  }) => {
    await page.goto("/rh/visao");

    const cabecalho = page.locator('[data-teste="cabecalho"]');
    const tira = cabecalho.getByRole("navigation", { name: "Módulos" });
    await expect(tira).toBeVisible();

    const itens = tira.getByRole("link");
    await expect(itens).toHaveCount(3);
    await expect(itens.nth(0)).toContainText("Recursos Humanos");
    await expect(itens.nth(1)).toContainText("Financeiro");
    await expect(itens.nth(2)).toContainText("Integração");
    await expect(itens.nth(0)).toHaveAttribute("aria-current", "page");

    // A tira fica no centro da tela, e a tela comeca na borda esquerda: a
    // barra lateral do prototipo saiu.
    const caixaDaTira = await tira.boundingBox();
    const largura = await page.evaluate(() => window.innerWidth);
    expect(caixaDaTira).not.toBeNull();
    if (caixaDaTira === null) return;
    const centro = caixaDaTira.x + caixaDaTira.width / 2;
    expect(Math.abs(centro - largura / 2)).toBeLessThan(40);

    const conteudo = await page
      .locator('[data-teste="conteudo"]')
      .boundingBox();
    expect(conteudo?.x).toBe(0);
  });

  test("clicar num modulo abre a primeira tela dele", async ({ page }) => {
    await page.goto("/rh/turnover");
    const tira = page.getByRole("navigation", { name: "Módulos" });

    await tira.getByRole("link").nth(1).click();
    await expect(page).toHaveURL(/\/fin\/visao$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Visão financeira",
    );
    await expect(tira.getByRole("link").nth(1)).toHaveAttribute(
      "aria-current",
      "page",
    );

    await tira.getByRole("link").nth(2).click();
    await expect(page).toHaveURL(/\/int\/cruz$/);

    await tira.getByRole("link").nth(0).click();
    await expect(page).toHaveURL(/\/rh\/visao$/);
  });

  test("a raiz abre a primeira tela do primeiro modulo", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/rh\/visao$/);
  });

  test("o conteudo rola sem mover o cabecalho", async ({ page }) => {
    await page.goto("/rh/visao");

    const cabecalho = page.locator('[data-teste="cabecalho"]');
    const antes = await cabecalho.boundingBox();

    // Forca conteudo mais alto que a area visivel, para haver o que rolar.
    await page.locator('[data-teste="conteudo"]').evaluate((el) => {
      const enchimento = document.createElement("div");
      enchimento.style.height = "3000px";
      el.appendChild(enchimento);
      el.scrollTop = 900;
    });

    const rolagem = await page
      .locator('[data-teste="conteudo"]')
      .evaluate((el) => el.scrollTop);
    expect(rolagem, "a area de conteudo nao rolou").toBeGreaterThan(0);

    const depois = await cabecalho.boundingBox();
    expect(depois?.y, "o cabecalho se moveu junto com o conteudo").toBe(
      antes?.y,
    );
  });

  test("o body nunca rola na horizontal, e nada vaza para fora da viewport", async ({
    page,
  }) => {
    for (const rota of ROTAS) {
      await page.goto(rota.url);

      const excedeu = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      );
      expect(excedeu, `${rota.url} rolou na horizontal`).toBe(false);

      // Nao basta nao rolar: `overflow: hidden` faria qualquer largura passar
      // neste teste escondendo o conteudo. Aqui o que se afirma e que nenhum
      // elemento termina fora da viewport — o layout cabe, nao e recortado.
      const vazando = await page.evaluate(() => {
        const limite = window.innerWidth + 1;
        return [...document.querySelectorAll<HTMLElement>("body *")]
          .filter((el) => el.getBoundingClientRect().right > limite)
          .map(
            (el) =>
              `${el.tagName.toLowerCase()} ate ${Math.round(el.getBoundingClientRect().right)}px`,
          )
          .slice(0, 5);
      });
      expect(vazando, `${rota.url} tem elemento fora da viewport`).toEqual([]);
    }
  });

  test("com a conversa aberta, a tela continua cabendo", async ({ page }) => {
    await page.goto("/rh/visao");
    await page.locator('[data-teste="chat-abrir"]').click();
    await expect(
      page.getByRole("complementary", { name: "Conversa com os dados" }),
    ).toBeVisible();

    const excedeu = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(excedeu).toBe(false);

    const vazando = await page.evaluate(() => {
      const limite = window.innerWidth + 1;
      return [...document.querySelectorAll<HTMLElement>("body *")].filter(
        (el) => el.getBoundingClientRect().right > limite,
      ).length;
    });
    expect(vazando).toBe(0);
  });
});
