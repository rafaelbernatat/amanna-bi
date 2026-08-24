/**
 * `getKpis` das 5 telas de Financeiro e da de Integração (T-116).
 *
 * Mesma forma do aceite de T-115, e a mesma varredura: cada cartão comparado
 * entre dois recortes distintos, e quem não muda precisa constar de uma lista
 * nominal com o porquê.
 *
 * ## O que este arquivo mostra e o de RH não mostrava
 *
 * **Financeiro não tem área.** A seção 10.1 dá a `vw_fato_fin_mes` o grão mês ×
 * entidade, porque receita não tem área de origem. Então quase todo cartão
 * financeiro fica idêntico sob recorte de área — e isso não é defeito, é o
 * contrato.
 *
 * Mas também não é o que a tela deve mostrar. Hoje o cartão exibe o consolidado
 * sob o recorte de Operações, e RF-01 chama isso de "valor remanescente". O
 * estado certo é **"este filtro não se aplica a este painel"**, que é o
 * entregável de T-162 e depende da semântica que H-04 decide.
 *
 * A lista de invariantes abaixo é, portanto, uma lista de dívida declarada — e
 * não uma lista de dispensas.
 */

import { describe, expect, it } from "vitest";

import { calcularKpis, metricasComCalculo } from "@/acesso/fixtures/kpis";
import type { Query } from "@/semantica/contrato";
import { QUERY_PADRAO } from "@/semantica/contrato";
import { kpisDaTela } from "@/semantica/kpis";
import { origemDoKpi } from "@/semantica/origem-de-kpi";

const TELAS = [
  "fin/visao",
  "fin/caixa",
  "fin/orc",
  "fin/contas",
  "fin/fat",
  "int/cruz",
] as const;

const MAXIMO_DE_KPIS = 6;

function com(mudanca: Partial<Query>): Query {
  return { ...QUERY_PADRAO, ...mudanca };
}

/* ------------------------------------------------------------------ *
 * Até 6 por tela, todos do catálogo
 * ------------------------------------------------------------------ */

describe("as 6 telas devolvem até 6 KPIs, todos do catálogo", () => {
  it.each(TELAS)("%s devolve no máximo 6", (tela) => {
    const kpis = calcularKpis(tela, QUERY_PADRAO);
    expect(kpis.length).toBeGreaterThan(0);
    expect(kpis.length).toBeLessThanOrEqual(MAXIMO_DE_KPIS);
  });

  it("as seis somam 28 cartões, e com RH fecham os 70 do registro", () => {
    const daqui = TELAS.reduce(
      (a, t) => a + calcularKpis(t, QUERY_PADRAO).length,
      0,
    );
    expect(daqui).toBe(28);
    expect(daqui + 42).toBe(70);
  });

  it("todo KPI tem origem e métrica com cálculo", () => {
    const comCalculo = new Set(metricasComCalculo());
    const fora: string[] = [];
    for (const tela of TELAS) {
      for (const registro of kpisDaTela(tela)) {
        const origem = origemDoKpi(registro.id);
        if (origem === undefined) fora.push(`${registro.id}: sem origem`);
        else if (!comCalculo.has(origem.metrica)) {
          fora.push(`${registro.id}: ${origem.metrica} sem cálculo`);
        }
      }
    }
    expect(fora).toEqual([]);
  });

  it("os números do consolidado batem com o Anexo C", () => {
    const porRotulo = (tela: string) =>
      Object.fromEntries(
        calcularKpis(tela, QUERY_PADRAO).map((k) => [k.label, k.value]),
      );

    const visao = porRotulo("fin/visao");
    expect(visao["Receita bruta"]).toBe(1412);
    expect(visao["Receita líquida"]).toBe(1200);
    expect(visao["EBITDA"]).toBe(200);
    expect(visao["Lucro líquido"]).toBe(-8);

    const caixa = porRotulo("fin/caixa");
    expect(caixa["Saldo de caixa"]).toBe(100);
    expect(caixa["Geração operacional"]).toBe(185);

    const orc = porRotulo("fin/orc");
    expect(orc["Orçado"]).toBe(1140);
    expect(orc["Realizado"]).toBe(1196);
    expect(orc["Desvio"]).toBe(56);

    const contas = porRotulo("fin/contas");
    expect(Math.round(contas["PMR"] ?? 0)).toBe(52);
    expect(Math.round(contas["PME"] ?? 0)).toBe(75);
    expect(Math.round(contas["PMP"] ?? 0)).toBe(51);
    expect(Math.round(contas["Ciclo de conversão"] ?? 0)).toBe(76);
    /*
     * 4,1% é `R$ 7 mi sobre R$ 171 mi` — a faixa acima de 90 dias, que é o que
     * o rodápé do cartão no protótipo declara.
     *
     * Este caso faltava, e uma provocação mostrou: trocar a definição para
     * "tudo fora do a vencer" leva a taxa de 4,1% para 31% e **nenhum teste
     * reprovava**. Conferir a existencia do cálculo não é conferir a escolha.
     */
    expect(Math.round((contas["Inadimplência"] ?? 0) * 10) / 10).toBe(4.1);

    const fat = porRotulo("fin/fat");
    expect(Math.round((fat["Crescimento YoY"] ?? 0) * 10) / 10).toBe(12.4);
    expect(Math.round((fat["Concentração top 10"] ?? 0) * 10) / 10).toBe(54.3);

    const cruz = porRotulo("int/cruz");
    expect(Math.round((cruz["Despesa de pessoal"] ?? 0) * 10) / 10).toBe(15.5);
    expect(cruz["Headcount"]).toBe(1240);
  });

  it("o EBITDA é calculado, e a ponte fecha no lucro", () => {
    /*
     * Não existe coluna de EBITDA na fixture, e é decisão: se existisse, seria
     * possível ela discordar das três parcelas que a formam. Aqui a única forma
     * de o EBITDA estar errado é uma das três estar.
     */
    const v = Object.fromEntries(
      calcularKpis("fin/visao", QUERY_PADRAO).map((k) => [k.label, k.value]),
    );
    const receita = v["Receita líquida"] ?? 0;
    expect(v["EBITDA"]).toBe(200);
    expect(Math.round(((v["EBITDA"] ?? 0) / receita) * 1000) / 10).toBe(16.7);
    expect(Math.round(((v["Lucro líquido"] ?? 0) / receita) * 1000) / 10).toBe(
      Math.round((v["Margem líquida"] ?? 0) * 10) / 10,
    );
  });

  it("a economia orçamentária não é o desvio com o sinal trocado", () => {
    // Conta só os centros que gastaram menos. Somar os dois lados daria o
    // desvio, e o cartão perderia o que existe para mostrar: houve economia em
    // algum lugar, mesmo com estouro no total.
    const orc = Object.fromEntries(
      calcularKpis("fin/orc", QUERY_PADRAO).map((k) => [k.label, k.value]),
    );
    expect(orc["Economia obtida"]).toBeGreaterThan(0);
    expect(orc["Economia obtida"]).not.toBe(-(orc["Desvio"] ?? 0));
  });
});

/* ------------------------------------------------------------------ *
 * A dívida declarada: Financeiro não tem área
 * ------------------------------------------------------------------ */

const INVARIANTES: ReadonlyArray<{
  readonly dimensao: "area" | "entidade" | "modalidade" | "periodo";
  readonly kpis: readonly string[];
  readonly porque: string;
}> = [
  {
    dimensao: "area",
    kpis: [
      "fin-visao-receita-bruta",
      "fin-visao-receita-liquida",
      "fin-visao-ebitda",
      "fin-visao-margem-bruta",
      "fin-visao-margem-liquida",
      "fin-visao-lucro-liquido",
      "fin-caixa-saldo-de-caixa",
      "fin-caixa-geracao-operacional",
      "fin-caixa-investimento-fci",
      "fin-caixa-financiamento-fcf",
      "fin-caixa-conversao-de-dez",
      "fin-orc-orcado",
      "fin-orc-realizado",
      "fin-orc-desvio",
      "fin-orc-economia-obtida",
      "fin-contas-pmr",
      "fin-contas-pme",
      "fin-contas-pmp",
      "fin-contas-ciclo-de-conversao",
      "fin-contas-inadimplencia",
      "fin-fat-faturamento",
      "fin-fat-crescimento-yoy",
      "fin-fat-ticket-medio",
      "fin-fat-concentracao-top-10",
    ],
    porque:
      "as views de Financeiro têm grão mês × entidade na seção 10.1 — receita " +
      "não tem área de origem. Hoje o cartão mostra o consolidado sob recorte " +
      "de área, e RF-01 chama isso de valor remanescente: o estado certo é " +
      "'filtro não se aplica', que é T-162 e depende da semântica de H-04",
  },
  {
    dimensao: "modalidade",
    kpis: [
      "fin-visao-receita-bruta",
      "fin-visao-receita-liquida",
      "fin-visao-ebitda",
      "fin-visao-margem-bruta",
      "fin-visao-margem-liquida",
      "fin-visao-lucro-liquido",
      "fin-caixa-saldo-de-caixa",
      "fin-caixa-geracao-operacional",
      "fin-caixa-investimento-fci",
      "fin-caixa-financiamento-fcf",
      "fin-caixa-conversao-de-dez",
      "fin-orc-orcado",
      "fin-orc-realizado",
      "fin-orc-desvio",
      "fin-orc-economia-obtida",
      "fin-contas-pmr",
      "fin-contas-pme",
      "fin-contas-pmp",
      "fin-contas-ciclo-de-conversao",
      "fin-contas-inadimplencia",
      "fin-fat-faturamento",
      "fin-fat-crescimento-yoy",
      "fin-fat-ticket-medio",
      "fin-fat-concentracao-top-10",
    ],
    porque:
      "mesma razão da área: modalidade de trabalho é dimensão de pessoa, e a " +
      "receita não a tem. Um contrato não é presencial nem remoto",
  },
  {
    dimensao: "periodo",
    kpis: [
      "int-cruz-headcount",
      "fin-caixa-saldo-de-caixa",
      "fin-contas-inadimplencia",
    ],
    porque:
      "são medidas de estoque lidas no último mês da janela, e os quatro " +
      "períodos da tabela 6.2 terminam todos em dezembro. O saldo de caixa de " +
      "31 de dezembro não muda porque alguém olhou três meses em vez de doze",
  },
  {
    dimensao: "entidade",
    kpis: [
      "fin-contas-inadimplencia",
      "fin-fat-crescimento-yoy",
      "fin-fat-concentracao-top-10",
    ],
    porque:
      "são proporções cujo numerador e denominador a fixture divide pela MESMA " +
      "fatia de entidade, e uma razão não muda quando os dois lados escalam " +
      "junto. É limitação da fixture, não do contrato: com dado real a " +
      "inadimplência de SP difere da das demais unidades, e é justamente por " +
      "isso que se olha o recorte. Corrigir exige fatias por faixa de aging e " +
      "por cliente, que é refinamento com decisão própria",
  },
];

function ehInvariante(kpi: string, dimensao: string): boolean {
  return INVARIANTES.some(
    (i) => i.dimensao === dimensao && i.kpis.includes(kpi),
  );
}

const PARES: ReadonlyArray<{
  readonly dimensao: string;
  readonly a: Query;
  readonly b: Query;
}> = [
  {
    dimensao: "area",
    a: com({ area: "operacoes" }),
    b: com({ area: "tecnologia" }),
  },
  {
    dimensao: "entidade",
    a: com({ entidade: "unidade-sp" }),
    b: com({ entidade: "demais-unidades" }),
  },
  {
    dimensao: "modalidade",
    a: com({ modalidade: "presencial" }),
    b: com({ modalidade: "remoto" }),
  },
  {
    dimensao: "periodo",
    a: com({ periodo: "12-meses" }),
    b: com({ periodo: "dezembro" }),
  },
  { dimensao: "ano", a: com({ ano: "2026" }), b: com({ ano: "2025" }) },
];

describe("nenhum KPI fica idêntico entre recortes distintos", () => {
  it.each(PARES)("$dimensao: os valores mudam", ({ dimensao, a, b }) => {
    const iguais: string[] = [];
    for (const tela of TELAS) {
      const emA = calcularKpis(tela, a);
      const emB = calcularKpis(tela, b);
      emA.forEach((kpi, i) => {
        const outro = emB[i];
        if (outro === undefined) return;
        if (kpi.value === outro.value && !ehInvariante(kpi.id, dimensao)) {
          iguais.push(`${kpi.id}: ${String(kpi.value)}`);
        }
      });
    }
    expect(iguais).toEqual([]);
  });

  it("e toda invariante declarada é mesmo invariante", () => {
    const enganadas: string[] = [];
    for (const { dimensao, kpis } of INVARIANTES) {
      const par = PARES.find((p) => p.dimensao === dimensao);
      if (par === undefined) continue;
      for (const id of kpis) {
        const tela = TELAS.find((t) => kpisDaTela(t).some((k) => k.id === id));
        if (tela === undefined) {
          enganadas.push(`${id}: não está em nenhuma das 6 telas`);
          continue;
        }
        const emA = calcularKpis(tela, par.a).find((k) => k.id === id);
        const emB = calcularKpis(tela, par.b).find((k) => k.id === id);
        if (emA?.value !== emB?.value) {
          enganadas.push(`${id} muda com ${dimensao} — saia da lista`);
        }
      }
    }
    expect(enganadas).toEqual([]);
  });

  it("por entidade, tudo muda — Financeiro tem entidade", () => {
    /*
     * O contraste que dá sentido à lista acima. Sob recorte de entidade os
     * mesmos cartões mudam, porque `vw_fato_fin_mes` **tem** entidade no grão.
     * Não é que Financeiro ignore filtro; é que ignora um filtro específico,
     * e por uma razão declarada na seção 10.1.
     */
    const sp = calcularKpis("fin/visao", com({ entidade: "unidade-sp" }));
    const demais = calcularKpis(
      "fin/visao",
      com({ entidade: "demais-unidades" }),
    );
    sp.forEach((kpi, i) => {
      expect(kpi.value, kpi.id).not.toBe(demais[i]?.value);
    });

    // E o contraste do contraste: sob área, os mesmos seis não mudam.
    const operacoes = calcularKpis("fin/visao", com({ area: "operacoes" }));
    const tecnologia = calcularKpis("fin/visao", com({ area: "tecnologia" }));
    operacoes.forEach((kpi, i) => {
      expect(kpi.value, kpi.id).toBe(tecnologia[i]?.value);
    });
  });

  it("os cartões de Integração mudam com a área, e isso merece atenção", () => {
    /*
     * `folha_sobre_receita` cruza duas views: a folha tem área e a receita não.
     * Sob recorte de Tecnologia, o cartão mostra a folha de Tecnologia sobre a
     * receita **da empresa inteira** — um número que não significa nada, e que
     * parece significar.
     *
     * Está aqui como registro, e não como aprovação: é exatamente a pergunta
     * que H-04 e T-144 vão responder ao decidir a semântica de Área no módulo
     * Financeiro.
     */
    const noRecorte = (id: string, q: Query) =>
      calcularKpis("int/cruz", q)?.find((k) => k.id === id)?.value;

    /*
     * Os três cartões de Integração que cruzam views mudam com a área, e todos
     * pela mesma razão torta: um lado da razão tem área e o outro não.
     *
     * `despesa de pessoal` cai, porque a folha de Tecnologia é uma fração da
     * receita inteira. `receita por colaborador` e `EBITDA per capita` sobem,
     * porque a receita inteira é dividida pelo quadro de uma área só.
     */
    const tec = com({ area: "tecnologia" });
    expect(noRecorte("int-cruz-despesa-de-pessoal", tec)).toBeLessThan(
      noRecorte("int-cruz-despesa-de-pessoal", QUERY_PADRAO) ?? 0,
    );
    expect(noRecorte("int-cruz-receita-por-colaborador", tec)).toBeGreaterThan(
      noRecorte("int-cruz-receita-por-colaborador", QUERY_PADRAO) ?? 0,
    );
    expect(noRecorte("int-cruz-ebitda-per-capita", tec)).toBeGreaterThan(
      noRecorte("int-cruz-ebitda-per-capita", QUERY_PADRAO) ?? 0,
    );
  });

  it("toda invariante traz o porquê escrito", () => {
    const semRazao = INVARIANTES.filter((i) => i.porque.trim().length < 40);
    expect(semRazao).toEqual([]);
  });

  it("o ano de 2025 devolve vazio, e não zero (PR-4)", () => {
    for (const tela of TELAS) {
      const kpis = calcularKpis(tela, com({ ano: "2025" }));
      expect(
        kpis.every((k) => k.value === null),
        tela,
      ).toBe(true);
    }
  });
});
