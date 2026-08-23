/**
 * A barra de filtros e o banner de recorte ativo, no navegador (T-128).
 *
 * A regra pura — quais filtros diferem do padrão — está em
 * `tests/unidade/barra-de-filtros.test.ts`, e roda sobre a matriz canônica
 * inteira. Aqui fica o que só o navegador prova:
 *
 * - o controle nasce com o **padrão selecionado**, e não com a primeira opção;
 * - ele é **percorrível por Tab, setas e Enter, sem mouse**;
 * - o banner aparece e some, e o clique em "Voltar ao consolidado" restaura os
 *   cinco de uma vez;
 * - os 5 casos isolados e o combinado, feitos **pelos controles** — não
 *   escrevendo a URL à mão, que provaria só o que T-127 já provou.
 */

import { expect, test, type Page } from "@playwright/test";

const TELA = "/rh/visao";

/** Os cinco controles, com o rótulo do padrão e um valor fora dele. */
const FILTROS = [
  {
    campo: "periodo",
    padrao: "12 meses",
    fora: "4-trimestre",
    rotulo: "Período: 4º trimestre",
  },
  { campo: "ano", padrao: "2026", fora: "2025", rotulo: "Ano: 2025" },
  {
    campo: "entidade",
    padrao: "Consolidado",
    fora: "unidade-sp",
    rotulo: "Entidade: Unidade SP",
  },
  {
    campo: "area",
    padrao: "Todas",
    fora: "operacoes",
    rotulo: "Área: Operações",
  },
  {
    campo: "modalidade",
    padrao: "Todas",
    fora: "hibrido",
    rotulo: "Modalidade: Híbrido",
  },
] as const;

function controle(page: Page, campo: string) {
  return page.locator(`[data-teste="filtro-${campo}"]`);
}

/**
 * Os cinco campos do recorte, lidos **de uma vez só**.
 *
 * Cinco `getAttribute` seguidos são cinco idas ao navegador, e depois de uma
 * navegação de cliente a página pode trocar no meio: a primeira leitura
 * escreveu deste lado do render, o resto do outro. Aconteceu de verdade aqui —
 * `area` e `modalidade` voltaram já no padrão enquanto `periodo`, `ano` e
 * `entidade` ainda traziam o recorte antigo, e o teste apontou um defeito que
 * não existia. Um `evaluate` só lê um estado consistente.
 */
async function lerRecorte(page: Page) {
  const alvo = page.locator('[data-teste="recorte"]');
  await expect(alvo).toBeAttached();
  return alvo.evaluate((n) => ({
    periodo: n.getAttribute("data-periodo"),
    ano: n.getAttribute("data-ano"),
    entidade: n.getAttribute("data-entidade"),
    area: n.getAttribute("data-area"),
    modalidade: n.getAttribute("data-modalidade"),
  }));
}

test.describe("os cinco controles da tabela 6.2", () => {
  test("existem, e são cinco", async ({ page }) => {
    await page.goto(TELA);
    await expect(
      page.locator('[data-teste="barra-de-filtros"] select'),
    ).toHaveCount(5);
  });

  test.describe("cada um nasce com o padrão selecionado", () => {
    for (const f of FILTROS) {
      test(`${f.campo}: ${f.padrao}`, async ({ page }) => {
        await page.goto(TELA);
        // O texto da opção escolhida, não o código: é o que a pessoa lê.
        await expect(
          controle(page, f.campo).locator("option:checked"),
        ).toHaveText(f.padrao);
      });
    }
  });

  test("período oferece os quatro valores da 6.2, nessa ordem", async ({
    page,
  }) => {
    await page.goto(TELA);
    const textos = await controle(page, "periodo")
      .locator("option")
      .allTextContents();
    expect(textos).toEqual(["12 meses", "6 meses", "4º trimestre", "Dezembro"]);
  });

  test("os rótulos acentuados aparecem na tela, e os códigos no valor", async ({
    page,
  }) => {
    /*
     * O outro lado de T-186. O valor que viaja é `operacoes`; o texto que a
     * pessoa lê é "Operações". Antes de T-186 os dois eram a mesma string, e a
     * barra mostraria "Operacoes" e "Hibrido".
     */
    await page.goto(TELA);
    const area = controle(page, "area");
    await expect(area.locator('option[value="operacoes"]')).toHaveText(
      "Operações",
    );
    await expect(area.locator('option[value="logistica"]')).toHaveText(
      "Logística",
    );
    await expect(
      controle(page, "modalidade").locator('option[value="hibrido"]'),
    ).toHaveText("Híbrido");
  });

  test("o recorte da URL chega selecionado no controle", async ({ page }) => {
    // Sem isto, a barra abriria em "Todas" enquanto a tela mostra Operações —
    // e o próximo envio devolveria a pessoa ao consolidado sem ela pedir.
    await page.goto(`${TELA}?area=operacoes&periodo=dezembro`);
    await expect(controle(page, "area").locator("option:checked")).toHaveText(
      "Operações",
    );
    await expect(
      controle(page, "periodo").locator("option:checked"),
    ).toHaveText("Dezembro");
  });
});

test.describe("o banner aparece se e somente se algum filtro sai do padrão", () => {
  test("no consolidado o banner não existe na página", async ({ page }) => {
    // `toHaveCount(0)`, e não `not.toBeVisible()`: um banner escondido por CSS
    // continuaria sendo lido em voz alta por um leitor de tela.
    await page.goto(TELA);
    await expect(page.locator('[data-teste="banner-de-recorte"]')).toHaveCount(
      0,
    );
  });

  for (const f of FILTROS) {
    test(`isolado — trocar ${f.campo} pelo controle acende o banner`, async ({
      page,
    }) => {
      await page.goto(TELA);
      await controle(page, f.campo).selectOption(f.fora);
      await page.locator('[data-teste="aplicar-filtros"]').click();

      // O controle escreveu na URL: é o que prova que o filtro é o recorte.
      await expect(page).toHaveURL(
        new RegExp(`${f.campo}=${f.fora.replace(/\+/g, "\\+")}`),
      );

      const banner = page.locator('[data-teste="banner-de-recorte"]');
      await expect(banner).toBeVisible();
      // Lista **só** ele: um banner que lista os cinco sempre não informa nada.
      await expect(banner).toHaveAttribute("data-filtros", f.campo);
      await expect(
        page.locator('[data-teste="recorte-ativo-lista"]'),
      ).toHaveText(f.rotulo);
    });
  }

  test("combinado — três filtros juntos, e o banner lista os três", async ({
    page,
  }) => {
    await page.goto(TELA);
    await controle(page, "periodo").selectOption("dezembro");
    await controle(page, "entidade").selectOption("unidade-sp");
    await controle(page, "modalidade").selectOption("remoto");
    await page.locator('[data-teste="aplicar-filtros"]').click();

    const banner = page.locator('[data-teste="banner-de-recorte"]');
    await expect(banner).toHaveAttribute(
      "data-filtros",
      "periodo,entidade,modalidade",
    );
    await expect(page.locator('[data-teste="recorte-ativo-lista"]')).toHaveText(
      "Período: Dezembro · Entidade: Unidade SP · Modalidade: Remoto",
    );

    // E o que ficou no padrão não entra na lista nem na URL.
    expect(page.url()).not.toContain("ano=");
    expect(page.url()).not.toContain("area=");
  });
});

test.describe("voltar ao consolidado restaura os cinco", () => {
  test("um clique, e os cinco voltam ao padrão", async ({ page }) => {
    const RECORTE =
      "periodo=dezembro&ano=2025&entidade=unidade-sp&area=operacoes&modalidade=remoto";
    await page.goto(`${TELA}?${RECORTE}`);
    await expect(
      page.locator('[data-teste="banner-de-recorte"]'),
    ).toBeVisible();

    await page.locator('[data-teste="voltar-ao-consolidado"]').click();
    await expect(page).toHaveURL(TELA);

    expect(await lerRecorte(page)).toEqual({
      periodo: "12-meses",
      ano: "2026",
      entidade: "consolidado",
      area: "todas",
      modalidade: "todas",
    });
    await expect(page.locator('[data-teste="banner-de-recorte"]')).toHaveCount(
      0,
    );
    // E a URL volta a ser a da tela, limpa.
    expect(new URL(page.url()).search).toBe("");
  });

  test("os controles também voltam ao padrão, e não só a URL", async ({
    page,
  }) => {
    /*
     * O caso que o `<select>` não controlado quebraria.
     *
     * "Voltar ao consolidado" é navegação de cliente: o React reaproveita o nó
     * do `<select>`, e `defaultValue` só vale na montagem. Sem a chave que
     * carrega o valor atual, a barra continuaria mostrando "Operações" com a
     * URL já no consolidado.
     */
    await page.goto(`${TELA}?area=operacoes&periodo=dezembro`);
    await page.locator('[data-teste="voltar-ao-consolidado"]').click();

    await expect(controle(page, "area").locator("option:checked")).toHaveText(
      "Todas",
    );
    await expect(
      controle(page, "periodo").locator("option:checked"),
    ).toHaveText("12 meses");
  });
});

test.describe("sem mouse: Tab, setas e Enter", () => {
  /**
   * Pressiona Tab até chegar ao elemento pedido, ou desiste.
   *
   * Devolve quantos Tabs foram precisos. Desistir devolve `-1`, e o teste
   * reprova com isso — o que importa é que o controle seja **alcançável pela
   * ordem natural de foco**, sem `focus()` programático, que não é o que uma
   * pessoa faz.
   */
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

  test("os cinco controles são alcançáveis por Tab", async ({ page }) => {
    await page.goto(TELA);
    for (const f of FILTROS) {
      await page.evaluate(() => {
        (document.activeElement as HTMLElement | null)?.blur();
      });
      expect(
        await tabAte(page, `filtro-${f.campo}`),
        `filtro-${f.campo} não foi alcançado por Tab`,
      ).toBeGreaterThan(0);
    }
  });

  test("seta troca o valor e Enter aplica, sem tocar no mouse", async ({
    page,
  }) => {
    /*
     * O caminho exato do critério de aceite: Tab chega, seta escolhe, Enter
     * aplica. Nenhum `focus()` programático, nenhum clique.
     *
     * O Enter é dado no botão "Aplicar", e isso foi **medido**, não escolhido:
     * o envio implícito do HTML — Enter dentro de um campo envia o formulário —
     * vale para campos de texto, e o Chromium não o dispara a partir de um
     * `<select>`. A primeira versão deste caso pressionava Enter com o `<select>`
     * em foco e a URL não mudava. Como o botão está na ordem natural de foco,
     * logo depois dos cinco controles, o caminho de teclado continua sendo
     * Tab-setas-Enter, e continua sem uma linha de manipulador de tecla.
     */
    await page.goto(TELA);
    expect(await tabAte(page, "filtro-periodo")).toBeGreaterThan(0);

    await page.keyboard.press("ArrowDown");
    await expect(
      controle(page, "periodo").locator("option:checked"),
    ).toHaveText("6 meses");

    expect(
      await tabAte(page, "aplicar-filtros"),
      "o botão Aplicar não está na ordem de foco depois dos controles",
    ).toBeGreaterThan(0);
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/periodo=6-meses/);
    await expect(page.locator('[data-teste="recorte-ativo-lista"]')).toHaveText(
      "Período: 6 meses",
    );
  });
});

test.describe("a URL continua legível depois de mexer nos filtros", () => {
  test("aplicar no consolidado não deixa cinco parâmetros grudados", async ({
    page,
  }) => {
    /*
     * Um `<form method="get">` envia todos os campos, inclusive os que estão
     * no padrão. Sem a canonização da rota, sair do consolidado e voltar
     * deixaria `?periodo=12-meses&ano=2026&...` na barra de endereços — o
     * oposto da URL compartilhável que a seção 6.6 promete.
     */
    await page.goto(TELA);
    await page.locator('[data-teste="aplicar-filtros"]').click();
    expect(new URL(page.url()).search).toBe("");
  });

  test("e um filtro fora do padrão vira um parâmetro só", async ({ page }) => {
    await page.goto(TELA);
    await controle(page, "area").selectOption("marketing");
    await page.locator('[data-teste="aplicar-filtros"]').click();
    expect(new URL(page.url()).search).toBe("?area=marketing");
  });
});

test.describe("o destaque da IA atravessa a troca de filtro", () => {
  test("mudar de área não apaga o painel destacado", async ({ page }) => {
    // Seção 6.5: o destaque permanece até a próxima navegação. Trocar de
    // filtro é ficar na mesma tela — e um formulário GET reescreve a busca
    // inteira, então o destaque só sobrevive se for enviado junto.
    await page.goto("/fin/orc?painel=orc-desvio");
    await controle(page, "area").selectOption("financeiro");
    await page.locator('[data-teste="aplicar-filtros"]').click();

    expect(page.url()).toContain("painel=orc-desvio");
    await expect(page.locator('[data-teste="recorte"]')).toHaveAttribute(
      "data-painel",
      "orc-desvio",
    );
  });
});
