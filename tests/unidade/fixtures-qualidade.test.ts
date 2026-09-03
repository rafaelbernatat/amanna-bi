/**
 * A natureza das contas e a qualidade do razão na fixture (perguntas de CFO,
 * etapa 2).
 *
 * As duas views são derivadas da DRE e do caixa: custo fixo mais variável é
 * CMV mais despesas em toda linha, e todo agregado de qualidade é uma parte do
 * movimento do mês. O que se confere é o que uma taxa guardada pronta
 * esconderia: as partes cabem no todo, e mudam por mês e por entidade.
 */

import { describe, expect, it } from "vitest";

import { ENTIDADES_ARMAZENADAS } from "@/acesso/fixtures/eixos";
import { VW_FATO_FIN_MES } from "@/acesso/fixtures/fin";
import { VW_FATO_NATUREZA_MES } from "@/acesso/fixtures/natureza";
import { VW_FATO_QUALIDADE_MES } from "@/acesso/fixtures/qualidade";

const MESES_NO_ANO = 12;
const UM_MILHAO = 1_000_000;
const DEZ_MIL = 10_000;

const somaPor = <T>(linhas: readonly T[], f: (l: T) => number) =>
  linhas.reduce((acc, l) => acc + f(l), 0);

describe("vw_fato_natureza_mes", () => {
  it("fixo mais variável é CMV mais despesas, em toda linha", () => {
    expect(VW_FATO_NATUREZA_MES).toHaveLength(
      MESES_NO_ANO * ENTIDADES_ARMAZENADAS.length,
    );
    for (const l of VW_FATO_NATUREZA_MES) {
      const dre = VW_FATO_FIN_MES.find(
        (f) => f.mes === l.mes && f.entidade === l.entidade,
      );
      expect(l.custosFixos + l.custosVariaveis).toBe(
        (dre?.cmv ?? 0) + (dre?.despesasOperacionais ?? 0),
      );
      expect(Number.isInteger(l.custosFixos)).toBe(true);
      expect(l.custosFixos).toBeGreaterThan(0);
      expect(l.custosVariaveis).toBeGreaterThan(l.custosFixos);
    }
  });

  it("o ano fecha em 640 variáveis e 360 fixos, sobre 1.000 de custo", () => {
    const variaveis = somaPor(VW_FATO_NATUREZA_MES, (l) => l.custosVariaveis);
    const fixos = somaPor(VW_FATO_NATUREZA_MES, (l) => l.custosFixos);
    expect(Math.round((variaveis + fixos) / UM_MILHAO)).toBe(1000);
    expect(Math.round(variaveis / UM_MILHAO)).toBe(640);
    expect(Math.round(fixos / UM_MILHAO)).toBe(360);
  });

  it("a parte variável difere por entidade: a margem de contribuição muda sob recorte", () => {
    const fracao = (entidade: string) => {
      const linhas = VW_FATO_NATUREZA_MES.filter(
        (l) => l.entidade === entidade,
      );
      return (
        somaPor(linhas, (l) => l.custosVariaveis) /
        somaPor(linhas, (l) => l.custosFixos + l.custosVariaveis)
      );
    };
    const [primeira, segunda] = ENTIDADES_ARMAZENADAS;
    expect(fracao(primeira ?? "")).not.toBe(fracao(segunda ?? ""));
  });
});

describe("vw_fato_qualidade_mes", () => {
  it("tem uma linha por mês e entidade, inteira", () => {
    expect(VW_FATO_QUALIDADE_MES).toHaveLength(
      MESES_NO_ANO * ENTIDADES_ARMAZENADAS.length,
    );
    const quebradas = VW_FATO_QUALIDADE_MES.flatMap((l) =>
      Object.entries(l).filter(
        ([, v]) => typeof v === "number" && !Number.isInteger(v),
      ),
    );
    expect(quebradas).toEqual([]);
  });

  it("o movimento do mês é entradas mais saídas de caixa", () => {
    for (const l of VW_FATO_QUALIDADE_MES) {
      const dre = VW_FATO_FIN_MES.find(
        (f) => f.mes === l.mes && f.entidade === l.entidade,
      );
      expect(l.valorTotal).toBe(
        (dre?.entradasDeCaixa ?? 0) + (dre?.saidasDeCaixa ?? 0),
      );
    }
  });

  it("toda parte cabe no todo", () => {
    for (const l of VW_FATO_QUALIDADE_MES) {
      for (const contagem of [
        l.lancamentosForaDoPadrao,
        l.lancamentosEmContaParada,
        l.paresDeEstorno,
        l.lancamentosDeCompetenciaAnterior,
        l.lancamentosDuplicados,
      ]) {
        expect(contagem).toBeGreaterThan(0);
        expect(contagem).toBeLessThan(l.lancamentos);
      }
      for (const valor of [
        l.valorForaDoPadrao,
        l.valorDeEstornos,
        l.valorDeCompetenciaAnterior,
        l.valorDuplicado,
        l.valorSemCentroDeCusto,
        l.valorEmContaGenerica,
        l.valorSemNatureza,
        l.valorEmClassificacaoInconsistente,
        l.movimentacaoComPartesRelacionadas,
      ]) {
        expect(valor).toBeGreaterThan(0);
        expect(valor).toBeLessThan(l.valorTotal);
      }
      // As três lacunas de completude juntas ainda cabem no movimento.
      expect(
        l.valorSemCentroDeCusto + l.valorEmContaGenerica + l.valorSemNatureza,
      ).toBeLessThan(l.valorTotal);
    }
  });

  it("a taxa de exceção muda por mês e por entidade — não é constante guardada", () => {
    const taxa = (l: (typeof VW_FATO_QUALIDADE_MES)[number]) =>
      l.lancamentosForaDoPadrao / l.lancamentos;
    const daPrimeira = VW_FATO_QUALIDADE_MES.filter(
      (l) => l.entidade === ENTIDADES_ARMAZENADAS[0],
    );
    const taxas = new Set(daPrimeira.map((l) => Math.round(taxa(l) * DEZ_MIL)));
    expect(taxas.size).toBeGreaterThan(1);

    const janeiro = VW_FATO_QUALIDADE_MES.filter((l) => l.mes === "2026-01");
    const [a, b] = janeiro;
    if (a === undefined || b === undefined) {
      throw new Error("janeiro precisa ter uma linha por entidade");
    }
    expect(taxa(a)).not.toBe(taxa(b));
  });
});
