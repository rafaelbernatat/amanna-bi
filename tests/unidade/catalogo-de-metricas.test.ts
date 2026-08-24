/**
 * O carregador do catálogo de métricas (T-112, seção 9.4).
 *
 * O catálogo é onde a definição de uma métrica vira decisão registrada. Um
 * carregador tolerante desfaz isso em silêncio: a entrada entra pela metade,
 * o número aparece na tela, e a definição que faltava passa a ser o que o
 * código adivinhou.
 *
 * Por isso os testes aqui são quase todos de **recusa** — e o último bloco
 * existe para provar que o carregador não recusa tudo, que seria a forma
 * preguiçosa de passar em todos os outros.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parse } from "yaml";
import { describe, expect, it } from "vitest";

import {
  carregarCatalogo,
  CatalogoInvalido,
  conferirCatalogo,
  conferirEntrada,
  DIMENSOES_DE_GRAO,
  GRAO_MINIMO_EXIGIDO,
} from "@/semantica/catalogo";

/** A entrada da seção 9.4 do PRD, escrita lá campo a campo. */
const VALIDA = {
  rotulo: "Turnover 12 meses",
  fonte: "vw_fato_rh_mes",
  formula: "soma(desligamentos, 12m) / media(headcount_fte, 12m)",
  unidade: "pct",
  agg: "ratio",
  sentido: "menor_melhor",
  meta: 14.0,
  grao_minimo: ["area", "mes"],
  sinonimos: ["turnover", "rotatividade", "saidas"],
  decisao: "Transferencia interna NAO conta como desligamento.",
};

function semO(campo: string) {
  const c = { ...VALIDA } as Record<string, unknown>;
  delete c[campo];
  return c;
}

const OBRIGATORIOS = [
  "rotulo",
  "fonte",
  "formula",
  "unidade",
  "agg",
  "sentido",
  "grao_minimo",
  "sinonimos",
] as const;

describe("os oito campos sem os quais a entrada não existe", () => {
  it.each(OBRIGATORIOS)("recusa entrada sem '%s'", (campo) => {
    const p = conferirEntrada("m", semO(campo));
    expect(p.map((x) => x.campo)).toContain(campo);
  });

  it("nomeia o campo que falta, não só 'inválido'", () => {
    // Quem está editando o YAML precisa saber qual linha escrever.
    const p = conferirEntrada("turnover_12m", semO("formula"));
    expect(p[0]?.metrica).toBe("turnover_12m");
    expect(p[0]?.campo).toBe("formula");
    expect(p[0]?.problema).toContain("ausente");
  });

  it("devolve todos os que faltam, não o primeiro", () => {
    // Quem escreve métrica nova erra três campos; descobrir um por rodada de
    // build é o que faz alguém desistir de manter o catálogo em dia.
    const p = conferirEntrada("m", { rotulo: "X" });
    expect(p.length).toBeGreaterThanOrEqual(7);
  });

  it("campo presente mas vazio conta como ausente", () => {
    // `formula: ""` passaria numa checagem de presença e violaria PR-3 igual.
    expect(
      conferirEntrada("m", { ...VALIDA, formula: "   " }).map((x) => x.campo),
    ).toContain("formula");
    expect(
      conferirEntrada("m", { ...VALIDA, sinonimos: [] }).map((x) => x.campo),
    ).toContain("sinonimos");
  });
});

describe("agg fora de {sum, last, ratio}", () => {
  it.each(["media", "avg", "SUM", "", "count"])("recusa agg '%s'", (agg) => {
    const p = conferirEntrada("m", { ...VALIDA, agg });
    expect(p.map((x) => x.campo)).toContain("agg");
  });

  it("aceita os três", () => {
    for (const agg of ["sum", "last", "ratio"]) {
      const entrada = { ...VALIDA, agg, unidade: "FTE" };
      expect(conferirEntrada("m", entrada)).toEqual([]);
    }
  });

  /**
   * A regra 4 da seção 9.2, um nível acima de T-104.
   *
   * `agregar()` já lança ao somar `pct`. Mas isso só protege quem chama
   * `agregar()`. Uma métrica declarada `unidade: pct, agg: sum` é a mesma falha
   * na camada do catálogo — e aqui ela é pega antes de existir consulta.
   */
  it("recusa somar percentual, mesmo com tudo mais correto", () => {
    for (const unidade of ["pct", "pp"]) {
      const p = conferirEntrada("m", { ...VALIDA, unidade, agg: "sum" });
      expect(p.map((x) => x.campo)).toContain("agg");
      expect(p.find((x) => x.campo === "agg")?.problema).toContain("9.2");
    }
  });

  it("mas aceita somar o que é aditivo", () => {
    for (const unidade of ["BRL_mi", "FTE", "dias"]) {
      expect(conferirEntrada("m", { ...VALIDA, unidade, agg: "sum" })).toEqual(
        [],
      );
    }
  });
});

describe("grao_minimo abaixo de [area, mes]", () => {
  it.each([
    ["colaborador", "mes"],
    ["cpf"],
    ["matricula", "dia"],
    ["area", "dia"],
    ["nome"],
  ])("recusa grão %j", (...grao) => {
    const p = conferirEntrada("m", { ...VALIDA, grao_minimo: grao });
    expect(p.map((x) => x.campo)).toContain("grao_minimo");
  });

  it("a mensagem nomeia o piso, porque não é erro de digitação", () => {
    const p = conferirEntrada("m", {
      ...VALIDA,
      grao_minimo: ["colaborador"],
    });
    const msg = p.find((x) => x.campo === "grao_minimo")?.problema ?? "";
    expect(msg).toContain("area");
    expect(msg).toContain("mes");
    expect(msg).toContain("seção 11");
  });

  it("aceita grão mais grosso — só mensal é legítimo", () => {
    expect(conferirEntrada("m", { ...VALIDA, grao_minimo: ["mes"] })).toEqual(
      [],
    );
    expect(
      conferirEntrada("m", { ...VALIDA, grao_minimo: ["entidade", "mes"] }),
    ).toEqual([]);
  });

  it("recusa lista vazia — grão ausente não é grão grosso", () => {
    expect(
      conferirEntrada("m", { ...VALIDA, grao_minimo: [] }).map((x) => x.campo),
    ).toContain("grao_minimo");
  });

  it("o piso é [area, mes], como a seção 11 diz", () => {
    expect([...GRAO_MINIMO_EXIGIDO]).toEqual(["area", "mes"]);
    expect(DIMENSOES_DE_GRAO).toContain("area");
    expect(DIMENSOES_DE_GRAO).toContain("mes");
    expect(DIMENSOES_DE_GRAO).not.toContain("colaborador");
  });
});

describe("o esquema é fechado", () => {
  it("recusa campo desconhecido", () => {
    // Um `formala:` com erro de digitação passaria como campo novo, e a
    // `formula` de verdade contaria como ausente — dois erros, um confuso.
    const p = conferirEntrada("m", { ...VALIDA, formala: "x" });
    expect(p.map((x) => x.campo)).toContain("formala");
  });

  it("recusa id fora do padrão", () => {
    for (const id of ["Turnover", "turnover-12m", "12m", "turnover 12m"]) {
      const p = conferirCatalogo({ [id]: VALIDA });
      expect(p.map((x) => x.campo)).toContain("(id)");
    }
  });

  it("recusa catálogo vazio e catálogo que não é mapa", () => {
    expect(conferirCatalogo({}).length).toBe(1);
    expect(conferirCatalogo([]).length).toBe(1);
    expect(conferirCatalogo(null).length).toBe(1);
    expect(conferirCatalogo("turnover").length).toBe(1);
  });
});

describe("carregarCatalogo", () => {
  it("lança com a lista inteira, e não com o primeiro problema", () => {
    try {
      carregarCatalogo({ m: { rotulo: "X" } });
      expect.unreachable("devia ter lançado");
    } catch (e) {
      expect(e).toBeInstanceOf(CatalogoInvalido);
      expect((e as CatalogoInvalido).problemas.length).toBeGreaterThan(3);
    }
  });

  it("meta ausente vira null, e não zero", () => {
    // 'Meta zero' seria um alvo; 'sem meta' é a ausência de alvo. Confundir os
    // dois faria o painel mostrar 100% de desvio contra uma meta inventada.
    const c = carregarCatalogo({ m: semO("meta") });
    expect(c.get("m")?.meta).toBeNull();
  });

  it("decisao ausente vira null", () => {
    expect(
      carregarCatalogo({ m: semO("decisao") }).get("m")?.decisao,
    ).toBeNull();
  });

  it("devolve a entrada tipada, com o id junto", () => {
    const c = carregarCatalogo({ turnover_12m: VALIDA });
    const m = c.get("turnover_12m");
    expect(m?.id).toBe("turnover_12m");
    expect(m?.agg).toBe("ratio");
    expect(m?.meta).toBe(14);
  });
});

describe("o catálogo versionado do repositório", () => {
  const documento: unknown = parse(
    readFileSync(
      resolve(__dirname, "..", "..", "catalogo", "metricas.yaml"),
      "utf8",
    ),
  );

  it("passa na conferência", () => {
    expect(conferirCatalogo(documento)).toEqual([]);
  });

  it("e traz as 42 métricas, não mais só uma", () => {
    /*
     * O arquivo esteve incompleto de propósito enquanto H-08 travava tudo. A
     * decisão de modo mockup destravou a escrita: T-113 trouxe as 21 do Anexo B
     * e T-148 as 21 do achado 5. A aprovação continua em H-08.
     *
     * Seriam 36 pela contagem do PRD — 21 mais os 15 do achado. A diferença é
     * a subcontagem do próprio achado, registrada em H-48.
     */
    expect(carregarCatalogo(documento).size).toBe(42);
  });

  it("traz a métrica que a seção 9.4 escreve por extenso", () => {
    /*
     * As 21 do Anexo B entraram em T-113, sob a decisão de modo mockup.
     *
     * Este caso conferia, até então, que a `decisao` de `turnover_12m`
     * continha "Transferencia interna" — o texto que T-112 transcreveu do
     * **exemplo** da seção 9.4 do PRD. O exemplo termina em "aprovado por RH e
     * Controladoria em 2026-08", e essa aprovação **não aconteceu**: a seção 18
     * do mesmo PRD lista P2 como pendente e H-06 continua aberto.
     *
     * Copiar uma ilustração para o arquivo de verdade transforma exemplo em
     * alegação. O campo foi reescrito para dizer o que é, e o teste passou a
     * conferir isso.
     */
    const c = carregarCatalogo(documento);
    const m = c.get("turnover_12m");
    expect(m).toBeDefined();
    expect(m?.unidade).toBe("pct");
    expect(m?.agg).toBe("ratio");
    expect(m?.sentido).toBe("menor_melhor");
    expect(m?.decisao).toContain("H-06");
    expect(m?.decisao).toContain("PROVISORIO");
  });

  it("toda métrica com decisão discutida traz a decisão escrita", () => {
    // Seção 9.4: "é o que impede que a discussão volte do zero em seis meses".
    const c = carregarCatalogo(documento);
    for (const m of c.values()) {
      if (m.decisao !== null) expect(m.decisao.length).toBeGreaterThan(20);
    }
  });
});
