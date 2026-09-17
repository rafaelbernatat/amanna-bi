/**
 * A quinta porta: o ranking de uma métrica por uma dimensão (D-CHAT-ferramentas).
 *
 * O que se prova sobre as fixtures: o total é o de `getMetric`; onde a
 * dimensão parte a métrica, os itens somam o total; onde a métrica não abre
 * pela dimensão, a resposta é "não abre", e não uma lista de consolidados
 * repetidos; o limite corta e diz que cortou; a fronteira recusa dimensão fora
 * da lista antes de tocar a fonte.
 */

import { describe, expect, it } from "vitest";

import { calcularMetrica } from "@/acesso/calculo/metricas";
import { MetricaDesconhecida } from "@/acesso/calculo/metricas";
import {
  calcularRanking,
  LIMITE_MAXIMO_DE_RANKING,
  metricasQueAbremPor,
} from "@/acesso/calculo/ranking";
import { criarFonteDeFixtures } from "@/acesso/fixtures/adaptador";
import { BASE_DE_FIXTURES } from "@/acesso/fixtures/base";
import { criarFronteira } from "@/acesso/fronteira";
import { dimensoesProvisorias } from "@/acesso/dimensoes-provisorias";
import {
  AREAS,
  DIMENSOES_DE_RANKING,
  ENTIDADES,
  QUERY_PADRAO,
} from "@/semantica/contrato";
import { GraoProibido } from "@/seguranca/grao";
import { escopoDaSessao } from "@/seguranca/identidade";

/** O escopo de quem enxerga tudo, derivado de uma sessão como em produção. */
const TUDO = escopoDaSessao({
  sujeito: "teste:diretoria",
  perfil: "diretoria",
  entidades: [...ENTIDADES],
  areas: [...AREAS],
});

describe("calcularRanking", () => {
  it("o total é o mesmo número de getMetric, no mesmo recorte", () => {
    const ranking = calcularRanking(
      BASE_DE_FIXTURES,
      { metrica: "headcount_fte", dimensao: "area", limite: 10 },
      QUERY_PADRAO,
    );
    const metrica = calcularMetrica(
      BASE_DE_FIXTURES,
      "headcount_fte",
      QUERY_PADRAO,
    );
    expect(ranking.total).toBe(metrica.value);
    expect(ranking.unit).toBe(metrica.unit);
    expect(ranking.abre).toBe(true);
  });

  it("por área, as sete partes somam o total e vêm da maior para a menor", () => {
    const ranking = calcularRanking(
      BASE_DE_FIXTURES,
      { metrica: "headcount_fte", dimensao: "area", limite: 10 },
      QUERY_PADRAO,
    );
    expect(ranking.itens).toHaveLength(7);
    const soma = ranking.itens.reduce((a, i) => a + (i.valor ?? 0), 0);
    expect(Math.abs(soma - (ranking.total ?? 0))).toBeLessThan(0.001);
    const valores = ranking.itens.map((i) => i.valor ?? 0);
    expect([...valores].sort((a, b) => b - a)).toEqual(valores);
    expect(ranking.itens[0]?.rotulo).not.toBe(ranking.itens[0]?.codigo);
  });

  it("sob recorte de uma área, o ranking por área tem uma categoria só", () => {
    const ranking = calcularRanking(
      BASE_DE_FIXTURES,
      { metrica: "headcount_fte", dimensao: "area", limite: 10 },
      { ...QUERY_PADRAO, area: "tecnologia" },
    );
    expect(ranking.itens.map((i) => i.codigo)).toEqual(["tecnologia"]);
  });

  it("métrica cuja view não tem área não abre por área — em vez de repetir o consolidado", () => {
    const ranking = calcularRanking(
      BASE_DE_FIXTURES,
      { metrica: "receita_liquida", dimensao: "area", limite: 10 },
      QUERY_PADRAO,
    );
    expect(ranking.abre).toBe(false);
    expect(ranking.itens).toEqual([]);
    expect(ranking.total).not.toBeNull();
  });

  it("por cliente, a receita dos dez maiores é a concentração, não o total", () => {
    const ranking = calcularRanking(
      BASE_DE_FIXTURES,
      { metrica: "receita_liquida", dimensao: "cliente", limite: 10 },
      QUERY_PADRAO,
    );
    expect(ranking.abre).toBe(true);
    expect(ranking.itens.length).toBeGreaterThan(0);
    const soma = ranking.itens.reduce((a, i) => a + (i.valor ?? 0), 0);
    expect(soma).toBeLessThan(ranking.total ?? 0);
    expect(soma).toBeGreaterThan(0);
  });

  it("o limite corta e diz que cortou; 'menor' inverte a ordem", () => {
    const tres = calcularRanking(
      BASE_DE_FIXTURES,
      { metrica: "headcount_fte", dimensao: "area", limite: 3 },
      QUERY_PADRAO,
    );
    expect(tres.itens).toHaveLength(3);
    expect(tres.truncado).toBe(true);

    const menores = calcularRanking(
      BASE_DE_FIXTURES,
      { metrica: "headcount_fte", dimensao: "area", limite: 3, ordem: "menor" },
      QUERY_PADRAO,
    );
    const valores = menores.itens.map((i) => i.valor ?? 0);
    expect([...valores].sort((a, b) => a - b)).toEqual(valores);

    const demais = calcularRanking(
      BASE_DE_FIXTURES,
      { metrica: "headcount_fte", dimensao: "area", limite: 999 },
      QUERY_PADRAO,
    );
    expect(demais.itens.length).toBeLessThanOrEqual(LIMITE_MAXIMO_DE_RANKING);
    expect(demais.truncado).toBe(false);
  });

  it("métrica fora do catálogo lança a recusa com sugestões", () => {
    expect(() =>
      calcularRanking(
        BASE_DE_FIXTURES,
        { metrica: "rotatividade", dimensao: "area", limite: 5 },
        QUERY_PADRAO,
      ),
    ).toThrow(MetricaDesconhecida);
  });

  it("a fixture não tem razão: por conta e por linha da DRE, nada abre", () => {
    for (const dimensao of ["conta", "linha_dre"] as const) {
      const ranking = calcularRanking(
        BASE_DE_FIXTURES,
        { metrica: "lucro_liquido", dimensao, limite: 10 },
        QUERY_PADRAO,
      );
      expect(ranking.abre, dimensao).toBe(true);
      expect(ranking.itens, dimensao).toEqual([]);
    }
  });

  it("toda dimensão declara ao menos uma métrica que abre por ela", () => {
    for (const dimensao of DIMENSOES_DE_RANKING) {
      expect(metricasQueAbremPor(dimensao).length, dimensao).toBeGreaterThan(0);
    }
  });
});

describe("a fronteira e o ranking", () => {
  it("dimensão fora da lista é recusada antes de tocar a fonte", async () => {
    let tocou = false;
    const fonte = {
      ...criarFonteDeFixtures(),
      getRanking: async () => {
        tocou = true;
        throw new Error("não deveria chegar aqui");
      },
    };
    const fronteira = criarFronteira(fonte, TUDO, dimensoesProvisorias());
    for (const pedida of ["colaborador", "cpf", "matricula", "nome", ""]) {
      await expect(
        fronteira.lerRanking(
          { metrica: "headcount_fte", dimensao: pedida, limite: 5 },
          QUERY_PADRAO,
        ),
      ).rejects.toBeInstanceOf(GraoProibido);
    }
    expect(tocou).toBe(false);
  });

  it("dimensão da lista passa, com a consulta restringida ao escopo", async () => {
    const fonte = criarFonteDeFixtures();
    const soTecnologia = escopoDaSessao({
      sujeito: "teste:area",
      perfil: "area",
      entidades: ["consolidado"],
      areas: ["tecnologia"],
    });
    const fronteira = criarFronteira(
      fonte,
      soTecnologia,
      dimensoesProvisorias(),
    );
    const ranking = await fronteira.lerRanking(
      { metrica: "headcount_fte", dimensao: "area", limite: 10 },
      { ...QUERY_PADRAO, area: "tecnologia" },
    );
    expect(ranking.itens.map((i) => i.codigo)).toEqual(["tecnologia"]);
  });
});
