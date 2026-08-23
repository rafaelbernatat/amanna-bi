/**
 * O recorte compartilhável, no servidor (T-127, seção 6.6).
 *
 * O round-trip puro está em `tests/unidade/query-na-url.test.ts`. O que só o
 * navegador prova é o resto do aceite: que **colar a URL numa sessão limpa**
 * reproduz filtros, tela e painel destacado — sem estado guardado em lugar
 * nenhum, porque não há lugar nenhum onde guardar.
 *
 * Cada teste do Playwright já roda em contexto novo, sem cookie nem
 * armazenamento herdado. É exatamente a "sessão limpa" do aceite.
 */

import { expect, test, type Page } from "@playwright/test";

const RECORTE = {
  periodo: "4-trimestre",
  ano: "2025",
  entidade: "unidade-sp",
  area: "tecnologia",
  modalidade: "hibrido",
} as const;

const BUSCA = new URLSearchParams(RECORTE).toString();

async function lerRecorte(page: Page) {
  const alvo = page.locator('[data-teste="recorte"]');
  await expect(alvo).toBeAttached();
  return {
    periodo: await alvo.getAttribute("data-periodo"),
    ano: await alvo.getAttribute("data-ano"),
    entidade: await alvo.getAttribute("data-entidade"),
    area: await alvo.getAttribute("data-area"),
    modalidade: await alvo.getAttribute("data-modalidade"),
    painel: await alvo.getAttribute("data-painel"),
    avisos: await alvo.getAttribute("data-avisos"),
  };
}

test.describe("colar a URL numa sessão limpa", () => {
  test("reproduz os cinco filtros", async ({ page }) => {
    await page.goto(`/rh/turnover?${BUSCA}`);

    const r = await lerRecorte(page);
    expect(r.periodo).toBe("4-trimestre");
    expect(r.ano).toBe("2025");
    expect(r.entidade).toBe("unidade-sp");
    expect(r.area).toBe("tecnologia");
    expect(r.modalidade).toBe("hibrido");
    expect(r.avisos).toBe("0");
  });

  test("reproduz o painel destacado", async ({ page }) => {
    await page.goto("/fin/orc?painel=orc-desvio");
    expect((await lerRecorte(page)).painel).toBe("orc-desvio");
  });

  test("o ano da URL chega ao cabeçalho, e não um padrão fixo", async ({
    page,
  }) => {
    // A prova de que o recorte atravessou até a interface. Antes de T-127 o
    // cabeçalho trazia "2026" escrito no código.
    await page.goto("/rh/visao?ano=2024");
    await expect(page.locator("header")).toContainText("2024");
  });

  test("URL sem filtro nenhum abre no recorte padrão", async ({ page }) => {
    await page.goto("/rh/visao");
    const r = await lerRecorte(page);
    expect(r.periodo).toBe("12-meses");
    expect(r.entidade).toBe("consolidado");
    expect(r.avisos).toBe("0");
  });
});

test.describe("trocar de tela preserva o recorte", () => {
  /*
   * O aceite diz "trocar de tela preserva os cinco filtros".
   *
   * O primeiro caso abaixo *parecia* provar isso e não provava: ele abre duas
   * rotas com a **mesma** string de busca e confere que as duas leem o mesmo
   * recorte. Isso é o round-trip outra vez — quem carregou o recorte de uma
   * tela para a outra foi o teste, escrevendo `?${BUSCA}` nas duas linhas.
   *
   * No produto quem troca de tela é a pessoa, clicando na tira de abas ou na
   * barra lateral. Os dois casos seguintes clicam, que é a única forma de a
   * frase do aceite significar o que ela diz.
   */
  test("as duas telas leem o mesmo recorte da mesma busca", async ({
    page,
  }) => {
    await page.goto(`/rh/turnover?${BUSCA}`);
    const antes = await lerRecorte(page);

    await page.goto(`/fin/caixa?${BUSCA}`);
    const depois = await lerRecorte(page);

    expect(depois).toEqual(antes);
    expect(page.url()).toContain("/fin/caixa");
  });

  test("clicar numa aba da tira leva o recorte junto", async ({ page }) => {
    await page.goto(`/rh/turnover?${BUSCA}`);
    const antes = await lerRecorte(page);

    await page.getByRole("link", { name: "Recrutamento" }).click();
    await expect(page).toHaveURL(/\/rh\/recrut/);

    const depois = await lerRecorte(page);
    expect(depois).toEqual(antes);
  });

  test("clicar num módulo da barra lateral leva o recorte junto", async ({
    page,
  }) => {
    await page.goto(`/rh/turnover?${BUSCA}`);
    const antes = await lerRecorte(page);

    await page
      .getByRole("link", { name: /Financeiro/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/fin\/visao/);

    const depois = await lerRecorte(page);
    expect(depois).toEqual(antes);
  });

  test("o recorte padrão continua produzindo link limpo", async ({ page }) => {
    /*
     * O outro lado da preservação, e o que impede a correção de virar poluição:
     * no consolidado, o link da aba não pode ganhar cinco parâmetros que não
     * dizem nada. `queryParaBusca` omite o que é igual ao padrão, e é isso que
     * mantém a URL compartilhável legível (T-127, seção 6.6).
     */
    await page.goto("/rh/visao");
    const aba = page.getByRole("link", { name: "Turnover" });
    expect(await aba.getAttribute("href")).toBe("/rh/turnover");
  });
});

test.describe("filtro inexistente no link", () => {
  test("cai no padrão e a tela diz que caiu", async ({ page }) => {
    // Link truncado no e-mail ou favorito velho: abrir no padrão é o certo,
    // abrir no padrão em silêncio não é. A pessoa leria "12 meses" achando
    // que está vendo o que pediu.
    await page.goto("/rh/visao?periodo=decada&area=juridico");

    const r = await lerRecorte(page);
    expect(r.periodo).toBe("12-meses");
    expect(r.area).toBe("todas");
    expect(r.avisos).toBe("2");

    const aviso = page.locator('[data-teste="aviso-de-recorte"]');
    await expect(aviso).toBeVisible();
    await expect(aviso).toContainText("decada");
    await expect(aviso).toContainText("juridico");
  });

  test("recorte íntegro não mostra aviso nenhum", async ({ page }) => {
    // Senão o aviso apareceria sempre e viraria ruído que ninguém lê.
    await page.goto(`/rh/visao?${BUSCA}`);
    await expect(page.locator('[data-teste="aviso-de-recorte"]')).toHaveCount(
      0,
    );
  });

  test("URL hostil não derruba a tela", async ({ page }) => {
    const resposta = await page.goto(
      "/rh/visao?periodo=&area=%%%&ano=abacaxi&painel=&modalidade[]=x",
    );
    expect(resposta?.status()).toBe(200);
    await expect(page.locator("main")).toBeVisible();
  });
});
