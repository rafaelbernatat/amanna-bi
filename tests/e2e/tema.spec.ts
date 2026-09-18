import { expect, test, type Page } from "@playwright/test";

/**
 * O tema que a pessoa escolhe vence o do sistema, nas duas direcoes (T-418), e
 * o grafico passa a seguir o sistema a partir da segunda tela (T-422).
 *
 * O defeito que T-418 corrige era invisivel para todo teste que existia: a
 * folha e o documento escreviam o atributo com nomes diferentes, e o botao de
 * tema nao fazia nada. So um navegador com a preferencia emulada e o clique
 * de verdade provam as duas direcoes — e e por isso que isto e e2e.
 *
 * As cores sao os fundos das duas peles de `tema.ts`, como o navegador as
 * devolve.
 */
const FUNDO_ESCURO = "rgb(11, 11, 12)";
const FUNDO_CLARO = "rgb(247, 248, 248)";

const COOKIE_DO_SISTEMA = "amanna-bi.tema-do-sistema";

function esquemaDeCor(page: Page, seletor = "html"): Promise<string> {
  return page
    .locator(seletor)
    .first()
    .evaluate((el) => getComputedStyle(el).colorScheme);
}

function fundoDoCorpo(page: Page): Promise<string> {
  return page
    .locator("body")
    .evaluate((el) => getComputedStyle(el).backgroundColor);
}

test.describe("O tema escolhido vence o do sistema (T-418)", () => {
  test("num sistema escuro, sem escolha, a moldura abre escura e o botao oferece o claro", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/rh/visao");

    await expect(page.locator("html")).not.toHaveAttribute("data-tema");
    expect(await esquemaDeCor(page)).toBe("dark");
    expect(await fundoDoCorpo(page)).toBe(FUNDO_ESCURO);

    await expect(
      page.locator('[data-teste="trocar-tema-para-claro"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-teste="trocar-tema-para-escuro"]'),
    ).toBeHidden();

    // Os controles nativos acompanham a pele: o select dos filtros e escuro.
    expect(await esquemaDeCor(page, '[data-teste="filtro-periodo"]')).toBe(
      "dark",
    );
  });

  test("escolher o claro num sistema escuro clareia a tela, e voltar escurece", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/rh/visao");

    await page.locator('[data-teste="trocar-tema-para-claro"]').click();
    await page.waitForURL("**/rh/visao");
    await expect(page.locator("html")).toHaveAttribute("data-tema", "claro");
    expect(await esquemaDeCor(page)).toBe("light");
    expect(await fundoDoCorpo(page)).toBe(FUNDO_CLARO);
    await expect(
      page.locator('[data-teste="trocar-tema-para-escuro"]'),
    ).toBeVisible();

    await page.locator('[data-teste="trocar-tema-para-escuro"]').click();
    await page.waitForURL("**/rh/visao");
    await expect(page.locator("html")).toHaveAttribute("data-tema", "escuro");
    expect(await fundoDoCorpo(page)).toBe(FUNDO_ESCURO);
  });

  test("escolher o escuro num sistema claro escurece a tela", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/rh/visao");
    expect(await fundoDoCorpo(page)).toBe(FUNDO_CLARO);
    await expect(
      page.locator('[data-teste="trocar-tema-para-claro"]'),
    ).toBeHidden();

    await page.locator('[data-teste="trocar-tema-para-escuro"]').click();
    await page.waitForURL("**/rh/visao");
    await expect(page.locator("html")).toHaveAttribute("data-tema", "escuro");
    expect(await esquemaDeCor(page)).toBe("dark");
    expect(await fundoDoCorpo(page)).toBe(FUNDO_ESCURO);
  });

  test("a troca volta a mesma tela, com o recorte e o painel destacado", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/fin/visao?periodo=dezembro&painel=fin-dre");

    await page.locator('[data-teste="trocar-tema-para-escuro"]').click();
    await page.waitForURL(/\/fin\/visao\?/);

    const url = new URL(page.url());
    expect(url.searchParams.get("periodo")).toBe("dezembro");
    expect(url.searchParams.get("painel")).toBe("fin-dre");
    await expect(page.locator("html")).toHaveAttribute("data-tema", "escuro");
  });
});

test.describe("O grafico segue o sistema a partir da segunda tela (T-422)", () => {
  test("em sistema escuro sem escolha, a segunda tela ja desenha na pele escura", async ({
    page,
    context,
  }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/rh/visao");

    // A primeira tela sai clara: nenhum servidor enxerga a preferencia antes
    // de o navegador conta-la. O script conta, e o cookie fica.
    await expect(
      page.locator('[data-teste="grade-de-paineis"]'),
    ).toHaveAttribute("data-pele", "claro");
    const cookie = (await context.cookies()).find(
      (c) => c.name === COOKIE_DO_SISTEMA,
    );
    expect(cookie?.value).toBe("escuro");

    await page.goto("/rh/turnover");
    await expect(
      page.locator('[data-teste="grade-de-paineis"]'),
    ).toHaveAttribute("data-pele", "escuro");
  });

  test("a escolha explicita vence a observacao do sistema", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/rh/visao");
    await page.locator('[data-teste="trocar-tema-para-claro"]').click();
    await page.waitForURL("**/rh/visao");

    await page.goto("/rh/turnover");
    await expect(
      page.locator('[data-teste="grade-de-paineis"]'),
    ).toHaveAttribute("data-pele", "claro");
    expect(await fundoDoCorpo(page)).toBe(FUNDO_CLARO);
  });
});
