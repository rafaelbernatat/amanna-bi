/**
 * O verificador numérico do chat (RF-15) com o envelope do documento de CFO.
 *
 * Todo número do texto tem de existir no envelope, na forma canônica de
 * `formatarValor`. O modelo que escrever "1,8x" em vez de "1,8 vezes", ou
 * "14,00%" em vez de "14,0%", tem a redação recusada — forma diferente é
 * número não conferido.
 */

import { describe, expect, it } from "vitest";

import type { TaxaDeReferencia } from "@/acesso/referencias/sgs";
import { divergencias, montarTexto } from "@/chat/perguntar";
import type { Resolucao } from "@/chat/resolver";
import { QUERY_PADRAO } from "@/semantica/contrato";

const CDI: TaxaDeReferencia = {
  id: "cdi",
  nome: "CDI",
  valor: 13.9,
  periodicidade: "ao ano",
  vigenteDesde: "2026-09-02",
  fonte: "Banco Central do Brasil · SGS série 4389",
};
const IPCA: TaxaDeReferencia = {
  id: "ipca_12m",
  nome: "IPCA 12 meses",
  valor: 4.44,
  periodicidade: "acumulado em 12 meses",
  vigenteDesde: "2026-07-01",
  fonte: "Banco Central do Brasil · SGS série 13522",
};

/** Um envelope de ROE, como o estágio 2 o montaria. */
function roe(parcial: Partial<Resolucao> = {}): Resolucao {
  return {
    metrica: "roe",
    rotulo: "ROE",
    valor: 8.3,
    unidade: "pct",
    formula: "lucro_liquido(12m) / patrimonio_liquido(fim)",
    decisao: null,
    asOf: "2026-12-31",
    consideracoes: [
      {
        rotulo: "Lucro líquido",
        valor: 12,
        unidade: "BRL_mi",
        origem: "apoio",
        metrica: "lucro_liquido",
      },
      {
        rotulo: "Patrimônio líquido",
        valor: null,
        unidade: "BRL_mi",
        origem: "apoio",
        metrica: "patrimonio_liquido",
      },
    ],
    familia: "retorno",
    referencias: [CDI, IPCA],
    comparacao: {
      familia: "retorno",
      leituras: [
        {
          rotulo: "Diferença para o CDI",
          valor: -5.6,
          unidade: "pp",
          formula: "ROE − CDI",
          referencia: CDI,
        },
        {
          rotulo: "Ganho real sobre o IPCA",
          valor: 3.7,
          unidade: "pct",
          formula: "(1 + ROE) ÷ (1 + IPCA 12 meses) − 1",
          referencia: IPCA,
        },
      ],
      base: null,
    },
    comparacaoIndisponivelPorque: null,
    acoes: { filtros: QUERY_PADRAO, tela: null, painel: null },
    fontes: ["vw_fato_balanco_mes"],
    painel: null,
    ...parcial,
  };
}

/** Um envelope de múltiplo. */
function liquidez(): Resolucao {
  return roe({
    metrica: "liquidez_corrente",
    rotulo: "Liquidez corrente",
    valor: 1.8,
    unidade: "vezes",
    consideracoes: [],
    familia: "liquidez",
    referencias: [],
    comparacao: null,
    comparacaoIndisponivelPorque:
      "esta métrica se lê pelo próprio múltiplo, não contra juros",
  });
}

describe("o que o texto pode citar", () => {
  it.each([
    "O ROE foi de 8,3% no período.",
    "A cada R$ 100 dos sócios, a operação devolveu R$ 8,3.",
    "Rende -5,6 p.p. abaixo do CDI de 13,9% ao ano.",
    "Ganho real de 3,7% sobre o IPCA de 4,4%.",
    "Com lucro líquido de R$ 12,0 mi e patrimônio líquido sem dado.",
  ])("aceita '%s'", (texto) => {
    expect(divergencias(texto, roe())).toEqual([]);
  });

  it.each([
    ["14,00%", "o CDI de 14,00% ao ano"],
    ["R$ 8 mi", "lucro de R$ 8 mi"],
    ["3,9%", "ganho real de 3,9%"],
    ["R$ 12,0 milhões", "lucro de R$ 12,0 milhões"],
    ["+2,1 p.p.", "subiu +2,1 p.p."],
  ])("recusa %s (%s)", (_esperado, texto) => {
    expect(divergencias(texto, roe()).length).toBeGreaterThan(0);
  });

  it("o múltiplo só passa por extenso", () => {
    expect(
      divergencias("A liquidez corrente é de 1,8 vezes.", liquidez()),
    ).toEqual([]);
    expect(
      divergencias("Para cada R$ 1,00 devido há R$ 1,8.", liquidez()),
    ).toEqual([]);
    expect(divergencias("A liquidez corrente é de 1,8x.", liquidez())).toEqual([
      "1,8x",
    ]);
    expect(divergencias("A liquidez corrente é de 1,8×.", liquidez())).toEqual([
      "1,8×",
    ]);
  });

  it("não confunde período com número citado", () => {
    expect(
      divergencias("Nos 12 meses até dez/2026, o ROE foi de 8,3%.", roe()),
    ).toEqual([]);
    expect(divergencias("Foram 12 horas de reunião.", roe())).toEqual([]);
  });
});

describe("o texto montado nunca diverge do próprio envelope", () => {
  it.each([
    ["retorno", roe()],
    ["múltiplo", liquidez()],
    ["sem dado", roe({ valor: null, comparacao: null })],
  ])("%s", (_nome, r) => {
    expect(divergencias(montarTexto(r, ""), r)).toEqual([]);
  });

  it("o texto montado cita o apoio, as leituras e o próximo passo", () => {
    const texto = montarTexto(roe(), "");
    expect(texto).toContain(
      "O que explica: Lucro líquido R$ 12,0 mi; Patrimônio líquido sem dado.",
    );
    expect(texto).toContain("Diferença para o CDI: -5,6 p.p.");
    expect(texto).toContain("Ganho real sobre o IPCA: 3,7%");
    // O próximo passo entra quando a métrica tem um declarado.
    expect(montarTexto(roe({ metrica: "ebitda" }), "")).toContain(
      "Quer ver a conversão de caixa?",
    );
  });
});
