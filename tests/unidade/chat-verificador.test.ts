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

/*
 * As três reescritas determinísticas. Cada uma nasceu de um texto real que o
 * modelo escreveu certo e o verificador barrou (2026-09-03, com o gpt-4o).
 */
describe("o sinal dito em palavra", () => {
  const negativo = roe({ valor: -2.3 });

  it.each([
    "A cada R$ 100 de patrimônio, a empresa destruiu R$ 2,3 em valor.",
    "A cada R$ 100 faturados, o prejuízo foi de R$ 2,3.",
    "Houve uma perda de R$ 2,3 para cada R$ 100 investidos.",
    "O retorno fica 5,6 p.p. abaixo do CDI de 13,9% ao ano.",
    "Rende 5,6 p.p. a menos que o CDI, um resultado negativo.",
    "O ROE foi -2,3%, e a cada R$ 100 devolveu -R$ 2,3.",
  ])("aceita '%s'", (texto) => {
    expect(divergencias(texto, negativo)).toEqual([]);
  });

  it.each([
    ["R$ 2,3", "A cada R$ 100 de patrimônio, a empresa devolveu R$ 2,3."],
    ["R$ 2,3", "Houve um ganho de R$ 2,3 para cada R$ 100 investidos."],
    ["5,6 p.p.", "O retorno fica 5,6 p.p. acima do CDI de 13,9% ao ano."],
    ["+2,3%", "O ROE foi +2,3% no período."],
  ])("recusa %s sem a palavra do sinal (%s)", (esperado, texto) => {
    expect(divergencias(texto, negativo)).toEqual([esperado]);
  });

  it("o sinal positivo pode ficar implícito", () => {
    const acima = roe({
      comparacao: {
        familia: "retorno",
        leituras: [
          {
            rotulo: "Diferença para o CDI",
            valor: 2.7,
            unidade: "pp",
            formula: "ROE − CDI",
            referencia: CDI,
          },
        ],
        base: null,
      },
    });
    expect(
      divergencias("Uma diferença de 2,7 p.p. sobre o CDI de 13,9%.", acima),
    ).toEqual([]);
    expect(
      divergencias("Uma diferença de +2,7 p.p. sobre o CDI de 13,9%.", acima),
    ).toEqual([]);
  });
});

describe("o número que veio no material", () => {
  it("repetir a pergunta não é inventar", () => {
    const pergunta = "Se a receita cair 10%, o que acontece com o lucro?";
    const texto = "Com a receita 10% menor, o ROE foi de 8,3%.";
    expect(divergencias(texto, roe(), pergunta)).toEqual([]);
    expect(divergencias(texto, roe())).toEqual(["10%"]);
  });

  it("o rótulo e a definição da métrica também contam", () => {
    const simulado = roe({ rotulo: "Resultado com receita 10% menor" });
    expect(
      divergencias("A queda de 10% na receita leva o ROE a 8,3%.", simulado),
    ).toEqual([]);

    const parado = roe({
      decisao:
        "PROVISORIO (D-H03, 2026-09-03). Itens sem movimentação há mais de 90 dias.",
    });
    expect(
      divergencias("São os itens parados por mais de 90 dias.", parado),
    ).toEqual([]);
    expect(
      divergencias("São os itens parados por mais de 60 dias.", parado),
    ).toEqual(["60 dias"]);
  });

  it("aritmética sobre números permitidos continua barrada", () => {
    // 8,3% − 5,6 p.p. = 2,7%: número que ninguém calculou.
    expect(
      divergencias("Descontado o CDI, sobram 2,7% de retorno.", roe()),
    ).toEqual(["2,7%"]);
  });
});

describe("o apoio em porcentagem também se traduz em reais", () => {
  it("R$ 16,7 a cada R$ 100 é a margem EBITDA de 16,7%", () => {
    const ebitda = roe({
      metrica: "ebitda",
      rotulo: "EBITDA",
      valor: 200,
      unidade: "BRL_mi",
      consideracoes: [
        {
          rotulo: "Margem EBITDA",
          valor: 16.7,
          unidade: "pct",
          origem: "apoio",
          metrica: "margem_ebitda",
        },
      ],
      comparacao: null,
    });
    expect(
      divergencias(
        "EBITDA foi R$ 200,0 mi: a cada R$ 100 de receita, R$ 16,7 ficaram.",
        ebitda,
      ),
    ).toEqual([]);
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
