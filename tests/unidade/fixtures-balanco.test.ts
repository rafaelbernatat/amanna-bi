/**
 * O balanço e a dívida da fixture (perguntas de CFO, 2026-09-03).
 *
 * As duas views são derivadas da DRE, do caixa e das contas que já existiam,
 * e é isso que se confere aqui: a identidade contábil fecha em todo mês, o
 * imobilizado anda com capex e depreciação, o patrimônio anda com o lucro, a
 * dívida por linha soma o resultado financeiro — e nenhuma taxa está guardada.
 */

import { describe, expect, it } from "vitest";

import {
  DISTRIBUICAO_ANUAL,
  IMOBILIZADO_DE_ABERTURA,
  PATRIMONIO_DE_ABERTURA,
  VW_FATO_BALANCO_MES,
} from "@/acesso/fixtures/balanco";
import {
  AMORTIZACAO_ANUAL,
  CAPTACAO_ANUAL,
  LINHAS_DE_CREDITO,
  VW_FATO_DIVIDA_MES,
} from "@/acesso/fixtures/divida";
import { ENTIDADES_ARMAZENADAS } from "@/acesso/fixtures/eixos";
import { FATIA_DA_UNIDADE_SP } from "@/acesso/fixtures/entidade";
import { VW_FATO_CONTAS, VW_FATO_FIN_MES } from "@/acesso/fixtures/fin";

const UM_MILHAO = 1_000_000;
const MESES_NO_ANO = 12;

const somaPor = <T>(linhas: readonly T[], f: (l: T) => number) =>
  linhas.reduce((acc, l) => acc + f(l), 0);

const emMilhoes = (reais: number) => Math.round(reais / UM_MILHAO);

describe("vw_fato_balanco_mes", () => {
  it("tem uma linha por mês e entidade, sem o agregado e sem fração", () => {
    expect(VW_FATO_BALANCO_MES).toHaveLength(
      MESES_NO_ANO * ENTIDADES_ARMAZENADAS.length,
    );
    expect(
      VW_FATO_BALANCO_MES.filter((l) => l.entidade === "consolidado"),
    ).toEqual([]);
    const quebradas = VW_FATO_BALANCO_MES.flatMap((l) =>
      Object.entries(l).filter(
        ([, v]) => typeof v === "number" && !Number.isInteger(v),
      ),
    );
    expect(quebradas).toEqual([]);
  });

  it("não guarda taxa, prazo nem múltiplo: só saldos e fluxos", () => {
    const primeira = VW_FATO_BALANCO_MES[0];
    expect(primeira).toBeDefined();
    const colunas = Object.keys(primeira ?? {});
    expect(
      colunas.filter((c) =>
        /liquidez|roe|roa|roic|margem|taxa|percentual|pmr|pme|pmp|ciclo|vezes/i.test(
          c,
        ),
      ),
    ).toEqual([]);
  });

  it("a identidade contábil fecha em toda linha, com outros ativos não negativos", () => {
    for (const l of VW_FATO_BALANCO_MES) {
      expect(l.ativoTotal).toBe(
        l.passivoCirculante + l.dividaLongoPrazo + l.patrimonioLiquido,
      );
      expect(
        l.ativoTotal - l.ativoCirculante - l.imobilizado,
        `${l.mes} ${l.entidade}`,
      ).toBeGreaterThanOrEqual(0);
    }
  });

  it("o circulante contém o caixa, o a receber e o estoque das outras views", () => {
    for (const l of VW_FATO_BALANCO_MES) {
      const dre = VW_FATO_FIN_MES.find(
        (f) => f.mes === l.mes && f.entidade === l.entidade,
      );
      const aReceber = somaPor(
        VW_FATO_CONTAS.filter(
          (c) => c.mes === l.mes && c.entidade === l.entidade,
        ),
        (c) => c.aReceber,
      );
      expect(l.ativoCirculante).toBeGreaterThanOrEqual(
        (dre?.saldoDeCaixa ?? 0) + aReceber + (dre?.estoque ?? 0),
      );
      expect(l.aplicacoesFinanceiras).toBeLessThanOrEqual(
        dre?.saldoDeCaixa ?? 0,
      );
      expect(l.estoqueSemGiro).toBeLessThanOrEqual(dre?.estoque ?? 0);
      expect(l.aReceberVencido).toBeLessThanOrEqual(aReceber);
    }
  });

  it("o imobilizado anda com capex menos depreciação, do início ao fim", () => {
    // Mês a mês, por entidade: o saldo de um mês é o do anterior mais o capex
    // menos a depreciação daquele mês, lidos da DRE.
    for (const entidade of ENTIDADES_ARMAZENADAS) {
      const saldos = VW_FATO_BALANCO_MES.filter((l) => l.entidade === entidade);
      saldos.forEach((l, i) => {
        const anterior = saldos[i - 1];
        if (anterior === undefined) return;
        const dre = VW_FATO_FIN_MES.find(
          (f) => f.mes === l.mes && f.entidade === entidade,
        );
        expect(l.imobilizado).toBe(
          anterior.imobilizado +
            (dre?.capex ?? 0) -
            (dre?.depreciacaoEAmortizacao ?? 0),
        );
      });
    }
    const dezembroConsolidado = somaPor(
      VW_FATO_BALANCO_MES.filter((l) => l.mes === "2026-12"),
      (l) => l.imobilizado,
    );
    const capexMenosDepreciacao =
      somaPor(VW_FATO_FIN_MES, (f) => f.capex) -
      somaPor(VW_FATO_FIN_MES, (f) => f.depreciacaoEAmortizacao);
    expect(emMilhoes(dezembroConsolidado)).toBe(
      IMOBILIZADO_DE_ABERTURA + emMilhoes(capexMenosDepreciacao),
    );
  });

  it("o patrimônio anda com o lucro do ano menos a distribuição: 368 − 8 − 10 = 350", () => {
    const dezembro = somaPor(
      VW_FATO_BALANCO_MES.filter((l) => l.mes === "2026-12"),
      (l) => l.patrimonioLiquido,
    );
    const lucroDoAno =
      somaPor(VW_FATO_FIN_MES, (f) => f.receitaLiquida) -
      somaPor(VW_FATO_FIN_MES, (f) => f.cmv) -
      somaPor(VW_FATO_FIN_MES, (f) => f.despesasOperacionais) -
      somaPor(VW_FATO_FIN_MES, (f) => f.depreciacaoEAmortizacao) -
      somaPor(VW_FATO_FIN_MES, (f) => f.resultadoFinanceiro) -
      somaPor(VW_FATO_FIN_MES, (f) => f.naoOperacional);
    expect(emMilhoes(lucroDoAno)).toBe(-8);
    expect(emMilhoes(dezembro)).toBe(
      PATRIMONIO_DE_ABERTURA + emMilhoes(lucroDoAno) - DISTRIBUICAO_ANUAL,
    );
    expect(
      emMilhoes(somaPor(VW_FATO_BALANCO_MES, (l) => l.distribuicaoASocios)),
    ).toBe(DISTRIBUICAO_ANUAL);
  });

  it("dezembro fecha nos números da narrativa", () => {
    const dez = VW_FATO_BALANCO_MES.filter((l) => l.mes === "2026-12");
    const total = (f: (l: (typeof dez)[number]) => number) =>
      emMilhoes(somaPor(dez, f));
    expect(total((l) => l.ativoCirculante)).toBe(450);
    expect(total((l) => l.passivoCirculante)).toBe(461);
    expect(total((l) => l.dividaCurtoPrazo)).toBe(300);
    expect(total((l) => l.dividaLongoPrazo)).toBe(600);
    expect(total((l) => l.patrimonioLiquido)).toBe(350);
    expect(total((l) => l.imobilizado)).toBe(840);
    expect(total((l) => l.ativoTotal)).toBe(1411);
  });

  it("juros e impostos são os degraus da DRE, mês a mês", () => {
    for (const l of VW_FATO_BALANCO_MES) {
      const dre = VW_FATO_FIN_MES.find(
        (f) => f.mes === l.mes && f.entidade === l.entidade,
      );
      expect(l.jurosPagos).toBe(dre?.resultadoFinanceiro);
      expect(l.impostosSobreLucro).toBe(dre?.naoOperacional);
    }
  });

  it("amortização mais distribuição menos captação é o financiamento da ponte do caixa", () => {
    const fluxo =
      somaPor(VW_FATO_BALANCO_MES, (l) => l.amortizacaoDeDivida) +
      somaPor(VW_FATO_BALANCO_MES, (l) => l.distribuicaoASocios) -
      somaPor(VW_FATO_BALANCO_MES, (l) => l.captacao);
    expect(fluxo).toBe(somaPor(VW_FATO_FIN_MES, (f) => f.financiamento));
    expect(emMilhoes(fluxo)).toBe(
      AMORTIZACAO_ANUAL + DISTRIBUICAO_ANUAL - CAPTACAO_ANUAL,
    );
  });

  it("o ROE de dezembro difere entre o consolidado e a Unidade SP", () => {
    const roe = (linhas: readonly (typeof VW_FATO_BALANCO_MES)[number][]) => {
      const entidades = new Set(linhas.map((l) => l.entidade));
      const dre = VW_FATO_FIN_MES.filter((f) => entidades.has(f.entidade));
      const lucro =
        somaPor(dre, (f) => f.receitaLiquida) -
        somaPor(dre, (f) => f.cmv) -
        somaPor(dre, (f) => f.despesasOperacionais) -
        somaPor(dre, (f) => f.depreciacaoEAmortizacao) -
        somaPor(dre, (f) => f.resultadoFinanceiro) -
        somaPor(dre, (f) => f.naoOperacional);
      return lucro / somaPor(linhas, (l) => l.patrimonioLiquido);
    };
    const dez = VW_FATO_BALANCO_MES.filter((l) => l.mes === "2026-12");
    expect(roe(dez)).not.toBe(
      roe(dez.filter((l) => l.entidade === "unidade-sp")),
    );
  });
});

describe("vw_fato_divida_mes", () => {
  it("tem uma linha por mês, entidade e linha de crédito", () => {
    expect(VW_FATO_DIVIDA_MES).toHaveLength(
      MESES_NO_ANO * ENTIDADES_ARMAZENADAS.length * LINHAS_DE_CREDITO.length,
    );
  });

  it("os juros por linha somam o resultado financeiro da DRE, por mês e entidade", () => {
    for (const dre of VW_FATO_FIN_MES) {
      const juros = somaPor(
        VW_FATO_DIVIDA_MES.filter(
          (d) => d.mes === dre.mes && d.entidade === dre.entidade,
        ),
        (d) => d.jurosPagos,
      );
      expect(juros, `${dre.mes} ${dre.entidade}`).toBe(dre.resultadoFinanceiro);
    }
  });

  it("os saldos por linha são a dívida do balanço, por prazo", () => {
    for (const l of VW_FATO_BALANCO_MES) {
      const linhas = VW_FATO_DIVIDA_MES.filter(
        (d) => d.mes === l.mes && d.entidade === l.entidade,
      );
      expect(
        somaPor(
          linhas.filter((d) => d.prazo === "curto"),
          (d) => d.saldo,
        ),
      ).toBe(l.dividaCurtoPrazo);
      expect(
        somaPor(
          linhas.filter((d) => d.prazo === "longo"),
          (d) => d.saldo,
        ),
      ).toBe(l.dividaLongoPrazo);
    }
  });

  it("dezembro fecha em 900 com as três linhas da narrativa", () => {
    const dez = VW_FATO_DIVIDA_MES.filter((d) => d.mes === "2026-12");
    for (const linha of LINHAS_DE_CREDITO) {
      expect(
        emMilhoes(
          somaPor(
            dez.filter((d) => d.linha === linha.codigo),
            (d) => d.saldo,
          ),
        ),
        linha.codigo,
      ).toBe(linha.saldoDezembro);
    }
    expect(emMilhoes(somaPor(dez, (d) => d.saldo))).toBe(900);
  });

  it("cada linha tem a sua taxa: a mais cara é a antecipação, a mais barata o longo prazo", () => {
    const taxa = (codigo: string) => {
      const doAno = VW_FATO_DIVIDA_MES.filter((d) => d.linha === codigo);
      const saldoMedio = somaPor(doAno, (d) => d.saldo) / MESES_NO_ANO;
      return somaPor(doAno, (d) => d.jurosPagos) / saldoMedio;
    };
    expect(taxa("antecipacao-de-recebiveis")).toBeGreaterThan(
      taxa("capital-de-giro"),
    );
    expect(taxa("capital-de-giro")).toBeGreaterThan(
      taxa("financiamento-longo-prazo"),
    );
  });

  it("a fatia da dívida é a declarada, e não é a do patrimônio", () => {
    const UM_PONTO = 0.011;
    const daUnidadeSp =
      somaPor(
        VW_FATO_DIVIDA_MES.filter((d) => d.entidade === "unidade-sp"),
        (d) => d.saldo,
      ) / somaPor(VW_FATO_DIVIDA_MES, (d) => d.saldo);
    expect(
      Math.abs(daUnidadeSp - (FATIA_DA_UNIDADE_SP["divida"] ?? 0)),
    ).toBeLessThan(UM_PONTO);
    expect(FATIA_DA_UNIDADE_SP["divida"]).not.toBe(
      FATIA_DA_UNIDADE_SP["balanco"],
    );
  });
});
