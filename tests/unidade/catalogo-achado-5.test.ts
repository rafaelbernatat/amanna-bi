/**
 * As métricas do achado 5 no catálogo (T-148).
 *
 * O aceite: as métricas do achado 5 *"existem no catálogo com fórmula, unidade
 * e agg, e **cada uma tem medida correspondente nas fixtures**"*.
 *
 * A segunda metade é a que dá valor à primeira. Uma métrica com fórmula bonita
 * e nenhuma coluna atrás é uma promessa: quando alguém for calcular, descobre
 * que o dado não está lá. O teste central deste arquivo confere que **toda
 * coluna citada existe de fato na view citada** — não por lista escrita à mão,
 * mas lendo as chaves das linhas da própria fixture.
 *
 * ## Como uma coluna é reconhecida
 *
 * A origem declara `medida` e `denominador` em texto, porque algumas são
 * expressões (`receitaLiquida - cmv`). A regra: **todo identificador em
 * camelCase com maiúscula interna precisa ser uma coluna real**. Palavra
 * portuguesa não tem maiúscula no meio — `contagem`, `valores`, `distintos`
 * passam; `somaDeIdade`, `headcountFte`, `notasEmitidas` são conferidos.
 *
 * É a diferença entre um teste que aceita qualquer prosa e um que sabe
 * distinguir prosa de nome de coluna.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parse } from "yaml";
import { describe, expect, it } from "vitest";

import { VIEWS, type NomeDeView } from "@/acesso/fixtures/adaptador";
import { carregarCatalogo, type Metrica } from "@/semantica/catalogo";
import { REGISTRO_DE_KPIS } from "@/semantica/kpis";
import { ORIGEM_DOS_KPIS_CONSTANTES } from "@/semantica/origem-de-kpi";

const RAIZ = process.cwd();
const CATALOGO = carregarCatalogo(
  parse(readFileSync(resolve(RAIZ, "catalogo", "metricas.yaml"), "utf8")),
);
const METRICAS: readonly Metrica[] = [...CATALOGO.values()];

/** As chaves de uma view, lidas da primeira linha da fixture. */
function colunasDe(view: string): ReadonlySet<string> {
  const linhas = VIEWS[view as NomeDeView];
  if (linhas === undefined) return new Set();
  return new Set(Object.keys(linhas[0] ?? {}));
}

/** Os identificadores que **parecem nome de coluna**: camelCase com maiúscula interna. */
function identificadoresDeColuna(texto: string): readonly string[] {
  return [...texto.matchAll(/\b[a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*\b/g)].map(
    (m) => m[0],
  );
}

/* ------------------------------------------------------------------ *
 * As métricas existem
 * ------------------------------------------------------------------ */

describe("as métricas do achado 5 estão no catálogo", () => {
  it("o catálogo passou de 21 para 42 métricas", () => {
    // 21 do Anexo B mais 21 do achado 5. Seriam 36 pela contagem do PRD; a
    // diferença é a subcontagem do achado, registrada em H-48.
    expect(METRICAS).toHaveLength(42);
  });

  it("os 15 que o aceite nomeia estão todos lá", () => {
    /*
     * A lista literal do aceite de T-148, uma a uma. É o cruzamento que o
     * aceite pede, e nomear cada uma é o que impede o teste de passar com uma
     * contagem em vez de com as métricas certas.
     */
    const OS_QUINZE = [
      "idade_media",
      "tempo_medio_de_casa",
      "tempo_fechamento",
      "custo_por_contratacao",
      "encargos_sobre_salarios",
      "mediana_salarial",
      "participacao_treinamento",
      "conclusao_treinamento",
      "cobertura_da_pesquisa",
      "ticket_medio",
      "concentracao_top_10",
      "pmr",
      "pme",
      "pmp",
      "inadimplencia",
    ];
    expect(OS_QUINZE).toHaveLength(15);
    const faltando = OS_QUINZE.filter((id) => !CATALOGO.has(id));
    expect(faltando).toEqual([]);
  });

  it("e os 23 KPIs constantes têm métrica, não só os 15", () => {
    // A subcontagem do achado 5 (H-48): fazer pelos 15 do texto deixaria oito
    // KPIs sem definição no catálogo.
    const constantes = REGISTRO_DE_KPIS.filter((k) => k.constanteNoPrototipo);
    expect(constantes).toHaveLength(23);

    const semMetrica = constantes
      .map((k) => ORIGEM_DOS_KPIS_CONSTANTES.find((o) => o.kpi === k.id))
      .filter((o) => o === undefined || !CATALOGO.has(o.metrica))
      .map((o) => o?.kpi ?? "(sem origem)");
    expect(semMetrica).toEqual([]);
  });

  it("cada uma traz fórmula, unidade e agg", () => {
    const incompletas = METRICAS.filter(
      (m) =>
        m.formula.trim() === "" ||
        String(m.unidade).trim() === "" ||
        String(m.agg).trim() === "",
    ).map((m) => m.id);
    expect(incompletas).toEqual([]);
  });

  it("nenhuma taxa está declarada como somável", () => {
    // A regra 4 da seção 9.2. Das 21 novas, quase todas são `ratio` — é a
    // natureza de um KPI do achado 5: quase todos são uma divisão.
    const NAO_SOMAVEIS = ["pct", "pp", "pontos", "anos"];
    const erradas = METRICAS.filter(
      (m) => NAO_SOMAVEIS.includes(m.unidade) && m.agg === "sum",
    ).map((m) => m.id);
    expect(erradas).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * Cada uma tem medida correspondente nas fixtures
 * ------------------------------------------------------------------ */

describe("cada métrica tem coluna de origem que existe de fato", () => {
  it("as views citadas existem na fixture", () => {
    const fora = ORIGEM_DOS_KPIS_CONSTANTES.filter(
      (o) => colunasDe(o.view).size === 0,
    ).map((o) => `${o.kpi}: ${o.view}`);
    expect(fora).toEqual([]);
  });

  it("toda coluna citada na medida existe na view", () => {
    /*
     * O teste que dá sentido ao aceite. Uma fórmula que cita `custoDeAquisicao`
     * numa view que não tem essa coluna é uma promessa que quebra na hora de
     * calcular — e quebra em produção, porque o catálogo passa na conferência
     * de esquema do mesmo jeito.
     */
    const fora: string[] = [];
    for (const origem of ORIGEM_DOS_KPIS_CONSTANTES) {
      const colunas = colunasDe(origem.view);
      for (const id of identificadoresDeColuna(origem.medida)) {
        if (!colunas.has(id)) fora.push(`${origem.kpi}: ${origem.view}.${id}`);
      }
    }
    expect(fora).toEqual([]);
  });

  it("e toda coluna citada no denominador também", () => {
    const fora: string[] = [];
    for (const origem of ORIGEM_DOS_KPIS_CONSTANTES) {
      if (origem.denominador === null) continue;
      // `outraView.coluna` diz de onde vem: separa antes de conferir.
      const [primeiro, segundo] = origem.denominador.split(".");
      const view = segundo === undefined ? origem.view : (primeiro ?? "");
      const expressao = segundo ?? primeiro ?? "";
      const colunas = colunasDe(view);
      for (const id of identificadoresDeColuna(expressao)) {
        if (!colunas.has(id)) fora.push(`${origem.kpi}: ${view}.${id}`);
      }
    }
    expect(fora).toEqual([]);
  });

  it("a varredura reconhece nome de coluna e ignora prosa", () => {
    /*
     * A guarda contra o teste acima passar por não encontrar nada. Se o
     * reconhecedor não achasse identificador nenhum, os dois casos acima
     * passariam sempre.
     */
    expect(identificadoresDeColuna("soma(somaDeIdade) / headcountFte")).toEqual(
      ["somaDeIdade", "headcountFte"],
    );
    expect(
      identificadoresDeColuna("contagem de valores distintos da dimensão uf"),
    ).toEqual([]);
    // E ele encontra coisa de verdade nas origens declaradas.
    const achados = ORIGEM_DOS_KPIS_CONSTANTES.flatMap((o) =>
      identificadoresDeColuna(o.medida),
    );
    expect(achados.length).toBeGreaterThan(15);
  });

  it("uma coluna inventada seria pega", () => {
    // A ocorrência plantada. Sem isto, "zero infratores" poderia significar
    // "a busca não sabe procurar".
    const colunas = colunasDe("vw_fato_rh_mes");
    expect(colunas.has("somaDeIdade")).toBe(true);
    expect(colunas.has("custoDeAquisicao")).toBe(false);
    expect(identificadoresDeColuna("soma(custoDeAquisicao)")).toEqual([
      "custoDeAquisicao",
    ]);
  });
});

/* ------------------------------------------------------------------ *
 * Duas correções de contagem, em teste
 * ------------------------------------------------------------------ */

describe("as duas correções que H-48 pede", () => {
  it("mediana salarial está no catálogo, e não é KPI", () => {
    /*
     * O aceite de T-148 a lista entre os 15. Ela é texto de nota do painel
     * `sal-faixas`, não cartão de KPI — confirmado no protótipo e registrado em
     * H-48. Entra no catálogo assim mesmo: nota com número também declara
     * fórmula (PR-3, RF-09).
     */
    expect(CATALOGO.has("mediana_salarial")).toBe(true);
    const ehKpi = REGISTRO_DE_KPIS.some((k) => /[Mm]ediana/.test(k.rotulo));
    expect(ehKpi).toBe(false);
  });

  it("e o achado 5 conta 23, não 15", () => {
    const constantes = REGISTRO_DE_KPIS.filter((k) => k.constanteNoPrototipo);
    expect(constantes.length).toBe(23);
    expect(constantes.length).not.toBe(15);
  });
});
