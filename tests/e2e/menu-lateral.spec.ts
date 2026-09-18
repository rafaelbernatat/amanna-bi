import { expect, test, type Page } from "@playwright/test";

/**
 * O menu lateral de telas (T-421; D-NAVEGACAO-menu-lateral-e-filtros-vivos).
 *
 * Os modulos continuam abas no cabecalho; as telas do modulo ativo vivem numa
 * coluna a esquerda, que recolhe a uma faixa fina e lembra a escolha. O que so
 * o navegador prova: a geometria, o clique que preserva o recorte, o cookie que
 * o servidor le no proximo quadro, e o recolhimento automatico quando a
 * conversa abre ao lado em 1280 px.
 */

const MENU = '[data-teste="menu-lateral"]';
const COOKIE = "amanna-bi.menu";
const ABERTO = 220;
const RECOLHIDO = 44;

async function tabAte(page: Page, teste: string, limite = 40) {
  for (let i = 1; i <= limite; i += 1) {
    await page.keyboard.press("Tab");
    const atual = await page.evaluate(
      () => document.activeElement?.getAttribute("data-teste") ?? "",
    );
    if (atual === teste) return i;
  }
  return -1;
}

test.describe("o menu lateral de telas", () => {
  test.describe("lista as telas do modulo ativo, com a atual marcada", () => {
    for (const [url, quantas, atual] of [
      ["/rh/colab", 7, "Colaboradores"],
      ["/fin/caixa", 5, "Fluxo de caixa"],
      ["/int/cruz", 1, "RH × Financeiro"],
    ] as const) {
      test(`${url}: ${String(quantas)} telas`, async ({ page }) => {
        await page.goto(url);
        const menu = page.getByRole("navigation", { name: /Telas de/ });
        await expect(menu).toBeVisible();
        const links = menu.getByRole("link");
        await expect(links).toHaveCount(quantas);
        await expect(menu.getByRole("link", { name: atual })).toHaveAttribute(
          "aria-current",
          "page",
        );
      });
    }
  });

  test("um clique preserva o recorte e descarta o painel destacado", async ({
    page,
  }) => {
    await page.goto("/rh/visao?periodo=dezembro&painel=rh-turnover");
    await page.locator('[data-teste="tela-turnover"]').click();
    await expect(page).toHaveURL(/\/rh\/turnover\?periodo=dezembro$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Turnover",
    );
  });

  test("recolher guarda a escolha, e o servidor ja abre recolhido no proximo quadro", async ({
    page,
    context,
  }) => {
    await page.goto("/rh/visao");
    const menu = page.locator(MENU);
    expect((await menu.boundingBox())?.width).toBe(ABERTO);

    await page.locator('[data-teste="recolher-menu"]').click();
    await expect(menu).toHaveAttribute("data-recolhido", "1");
    expect((await menu.boundingBox())?.width).toBe(RECOLHIDO);
    // Recolhido, cada tela vira um icone clicavel com o titulo acessivel
    // (T-442): o link continua, o texto some.
    const colab = page.locator('[data-teste="tela-colab"]');
    await expect(colab).toBeVisible();
    await expect(colab).toHaveAttribute("aria-label", "Colaboradores");
    await expect(colab.locator('[data-parte="titulo"]')).toBeHidden();
    await expect(colab.locator("svg[data-icone]")).toBeVisible();
    expect((await colab.boundingBox())?.width ?? 0).toBeLessThanOrEqual(
      RECOLHIDO,
    );
    await expect(page.locator('[data-teste="recolher-menu"]')).toHaveAttribute(
      "aria-expanded",
      "false",
    );

    const cookie = (await context.cookies()).find((c) => c.name === COOKIE);
    expect(cookie?.value).toBe("recolhido");

    // O servidor decide o primeiro quadro: o HTML cru ja vem recolhido.
    const resposta = await page.request.get("/rh/visao", {
      headers: { cookie: `${COOKIE}=recolhido` },
    });
    const html = await resposta.text();
    expect(html).toContain('data-recolhido="1"');
    // E no shell, nao num pedaco streamado depois: o menu vem antes do
    // cabecalho da tela e antes de qualquer boundary pendente do fluxo. Foi
    // o que o CI mediu como deslocamento de 220 px quando o menu lia a busca
    // por gancho sob Suspense.
    const menuNoHtml = html.indexOf('data-teste="menu-lateral"');
    expect(menuNoHtml).toBeGreaterThan(-1);
    expect(menuNoHtml).toBeLessThan(html.indexOf('data-teste="cabecalho"'));
    const primeiroPendente = html.indexOf('<template id="B:');
    expect(primeiroPendente === -1 || menuNoHtml < primeiroPendente).toBe(true);

    await page.locator('[data-teste="recolher-menu"]').click();
    await expect(menu).toHaveAttribute("data-recolhido", "0");
    expect(
      (await context.cookies()).find((c) => c.name === COOKIE)?.value,
    ).toBe("aberto");
  });

  test("com a conversa aberta, o menu recolhe sozinho onde nao cabe", async ({
    page,
  }, info) => {
    await page.goto("/rh/visao");
    await page.locator('[data-teste="chat-abrir"]').click();
    await expect(
      page.getByRole("complementary", { name: "Conversa com os dados" }),
    ).toBeVisible();

    const largura = (await page.locator(MENU).boundingBox())?.width;
    if (info.project.name === "1280x720") {
      // 1280 menos a conversa: menos de 900 para a tela.
      expect(largura).toBe(RECOLHIDO);
      await expect(page.locator('[data-teste="recolher-menu"]')).toBeHidden();
      // Os icones continuam la, clicaveis.
      await expect(page.locator('[data-teste="tela-colab"]')).toBeVisible();
    } else {
      expect(largura).toBe(ABERTO);
    }
    // E nada vaza da viewport, com ou sem o menu.
    const vazando = await page.evaluate(() => {
      const limite = window.innerWidth + 1;
      return [...document.querySelectorAll<HTMLElement>("body *")].filter(
        (el) => el.getBoundingClientRect().right > limite,
      ).length;
    });
    expect(vazando).toBe(0);
  });

  test("recolhido por cookie, o icone da tela navega e o menu segue recolhido", async ({
    page,
    context,
    baseURL,
  }) => {
    await context.addCookies([
      { name: COOKIE, value: "recolhido", url: String(baseURL) },
    ]);
    await page.goto("/rh/visao?periodo=dezembro");
    const menu = page.locator(MENU);
    await expect(menu).toHaveAttribute("data-recolhido", "1");
    await page.locator('[data-teste="tela-turnover"]').click();
    await expect(page).toHaveURL(/\/rh\/turnover\?periodo=dezembro$/);
    await expect(menu).toHaveAttribute("data-recolhido", "1");
    expect((await menu.boundingBox())?.width).toBe(RECOLHIDO);
  });

  test("o botao e as telas estao na ordem de foco", async ({ page }) => {
    await page.goto("/rh/visao");
    expect(await tabAte(page, "recolher-menu")).toBeGreaterThan(0);
    expect(await tabAte(page, "tela-colab")).toBeGreaterThan(0);
  });
});
