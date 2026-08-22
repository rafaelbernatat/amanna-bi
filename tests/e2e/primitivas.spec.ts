import { expect, test } from "@playwright/test";

/**
 * As tres primitivas de serie (T-130).
 *
 * O criterio de aceite nomeia tres paineis e um estado:
 *   rh-headcount  barras com eixo secundario
 *   rec-vagas     empilhada com legenda
 *   tov-12m       linha com traco de meta
 *   serie vazia   estado "sem dado neste recorte", nao grafico em branco
 *
 * As series da galeria sao formas, nao numeros do Anexo C — esses dependem da
 * errata de H-03. O que se afirma aqui e a geometria e a estabilidade.
 */

const GALERIA = "/verificacao/svg";

/** O desenho em si — os icones da legenda tambem sao `recharts-surface`. */
const SUPERFICIE = ".recharts-wrapper > svg.recharts-surface";

/** Normaliza o que muda entre execucoes sem ser diferenca de desenho. */
function estavel(svg: string): string {
  return svg
    .replace(/\sid="[^"]*"/g, "")
    .replace(/url\(#[^)]*\)/g, "url(#)")
    .replace(/\sclip-path="[^"]*"/g, "");
}

test.describe("rh-headcount: barras com eixo secundario", () => {
  test("desenha duas series de barra e a linha do eixo direito", async ({
    page,
  }) => {
    await page.goto(GALERIA);
    const cartao = page.locator('[data-caso="rh-headcount"]');

    // 12 meses x 2 series de barra.
    await expect(cartao.locator(".recharts-bar-rectangle")).toHaveCount(24);
    // A linha do headcount, no eixo secundario.
    await expect(cartao.locator(".recharts-line-curve")).toHaveCount(1);
    // Dois eixos de valor: esquerdo e direito.
    await expect(cartao.locator(".recharts-yAxis")).toHaveCount(2);
    // A legenda separa admissoes de desligamentos sem depender so da cor.
    await expect(cartao.getByText("Admissões")).toBeVisible();
    await expect(cartao.getByText("Desligamentos")).toBeVisible();
  });

  test("os cortes calculados no servidor chegam aos dois eixos", async ({
    page,
  }) => {
    await page.goto(GALERIA);
    // No recharts 3 o valor do tick nao mora dentro de `.recharts-yAxis`:
    // fica em `.recharts-cartesian-axis-tick-value`, num outro ramo.
    const valores = await page
      .locator('[data-caso="rh-headcount"] .recharts-cartesian-axis-tick-value')
      .evaluateAll((ns) => ns.map((n) => n.textContent ?? ""));

    // Eixo esquerdo: admissoes e desligamentos, ancorado no zero.
    expect(valores, "o eixo esquerdo nao recebeu os cortes").toEqual(
      expect.arrayContaining(["0", "25"]),
    );
    // Eixo direito: headcount FTE, numa escala completamente outra.
    expect(valores, "o eixo secundario nao recebeu os cortes").toEqual(
      expect.arrayContaining(["1150", "1240"]),
    );
    // E os meses no eixo de categoria.
    expect(valores, "o eixo de categoria nao recebeu os meses").toEqual(
      expect.arrayContaining(["jan", "dez"]),
    );
  });
});

test.describe("rec-vagas: empilhada com legenda", () => {
  test("empilha tres faixas por area e nomeia cada uma", async ({ page }) => {
    await page.goto(GALERIA);
    const cartao = page.locator('[data-caso="rec-vagas"]');

    // 7 areas x 3 faixas.
    await expect(cartao.locator(".recharts-bar-rectangle")).toHaveCount(21);
    for (const faixa of ["Abertas", "Em andamento", "Fechadas"]) {
      await expect(cartao.getByText(faixa, { exact: true })).toBeVisible();
    }
  });

  test("as faixas se empilham em vez de se sobrepor", async ({ page }) => {
    await page.goto(GALERIA);
    // O recharts agrupa por serie, nao por categoria: as 7 primeiras barras
    // sao a faixa 'Abertas' das 7 areas, e assim por diante. Para provar o
    // empilhamento, compara-se a MESMA area nas tres faixas.
    const xs = await page
      .locator('[data-caso="rec-vagas"] .recharts-bar-rectangle path')
      .evaluateAll((nos) =>
        [0, 7, 14].map((i) =>
          Math.round(nos[i]?.getBoundingClientRect().x ?? -1),
        ),
      );
    expect(
      xs.every((x) => x >= 0),
      "faltou barra para comparar",
    ).toBe(true);
    expect(new Set(xs).size, "as faixas estao sobrepostas").toBe(3);
    expect(xs, "as faixas nao estao em ordem de empilhamento").toEqual(
      [...xs].sort((a, b) => a - b),
    );
  });
});

test.describe("tov-12m: linha com traco de meta", () => {
  test("desenha a serie e a linha de referencia rotulada", async ({ page }) => {
    await page.goto(GALERIA);
    const cartao = page.locator('[data-caso="tov-12m"]');

    await expect(cartao.locator(".recharts-line-curve")).toHaveCount(1);
    await expect(cartao.locator(".recharts-reference-line")).toHaveCount(1);
    // Cor nunca e o unico sinal (PRD secao 13): a meta vem rotulada.
    await expect(cartao.getByText("meta 14,0%")).toBeVisible();
  });
});

test.describe("Serie vazia e estado, nao grafico em branco", () => {
  const MOTIVOS = [
    { motivo: "sem_dado_no_recorte", titulo: "Sem dado neste recorte" },
    { motivo: "grupo_pequeno", titulo: "Grupo pequeno demais para exibir" },
    { motivo: "fora_do_perfil", titulo: "Você não tem acesso a este recorte" },
    { motivo: "fonte_indisponivel", titulo: "Não foi possível ler a fonte" },
  ] as const;

  for (const { motivo, titulo } of MOTIVOS) {
    test(`${motivo} mostra o motivo e nao desenha eixo`, async ({ page }) => {
      await page.goto(GALERIA);
      const cartao = page.locator(`[data-caso="vazio-${motivo}"]`);

      await expect(cartao.getByText(titulo)).toBeVisible();
      // Nenhum desenho: um eixo vazio seria indistinguivel de tudo zero.
      await expect(cartao.locator("svg.recharts-surface")).toHaveCount(0);
      await expect(cartao.locator(`[data-sem-dado="${motivo}"]`)).toHaveCount(
        1,
      );
    });
  }

  test("o estado vazio ocupa a mesma altura que o grafico ocuparia", async ({
    page,
  }) => {
    await page.goto(GALERIA);
    const vazio = await page
      .locator('[data-caso="vazio-sem_dado_no_recorte"] [data-sem-dado]')
      .boundingBox();
    const cheio = await page
      .locator('[data-caso="tov-12m"] [data-grafico]')
      .boundingBox();
    expect(Math.round(vazio?.height ?? 0)).toBe(Math.round(cheio?.height ?? 0));
  });

  test("o atalho para ampliar o recorte aparece quando existe", async ({
    page,
  }) => {
    await page.goto(GALERIA);
    await expect(
      page
        .locator('[data-caso="vazio-sem_dado_no_recorte"]')
        .getByText("Ampliar para todas as áreas"),
    ).toBeVisible();
  });
});

test.describe("Estabilidade do desenho", () => {
  for (const caso of ["rh-headcount", "rec-vagas", "tov-12m"]) {
    test(`${caso} produz o mesmo SVG em duas execucoes`, async ({ page }) => {
      await page.goto(GALERIA);
      const primeiro = estavel(
        (await page
          .locator(`[data-caso="${caso}"] ${SUPERFICIE}`)
          .innerHTML()) ?? "",
      );

      await page.reload();
      const segundo = estavel(
        (await page
          .locator(`[data-caso="${caso}"] ${SUPERFICIE}`)
          .innerHTML()) ?? "",
      );

      expect(primeiro.length, "o desenho saiu vazio").toBeGreaterThan(200);
      expect(segundo, `${caso} desenhou diferente na segunda execucao`).toBe(
        primeiro,
      );
    });
  }
});
