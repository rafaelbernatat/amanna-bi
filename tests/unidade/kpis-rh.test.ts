/**
 * `getKpis` das 7 telas de RH (T-115).
 *
 * O aceite tem duas metades:
 *
 * 1. **as 7 telas devolvem até 6 KPIs cada, todos originados do catálogo**;
 * 2. **o teste falha se algum KPI ficar idêntico entre recortes distintos de
 *    área, período, entidade, ano ou modalidade sem constar de uma lista
 *    explícita de invariantes.**
 *
 * A segunda é o achado 5 do Anexo D virado teste. No protótipo, metade dos
 * cartões era texto cravado — o número era o mesmo em todo recorte porque não
 * havia recorte nenhum. Um KPI que não muda quando o filtro muda é
 * indistinguível daquilo, e é isso que a varredura abaixo procura.
 *
 * ## Por que a lista de invariantes é nominal
 *
 * Alguns KPIs **devem** ficar iguais, e cada um por uma razão que precisa estar
 * escrita. `vw_fato_vagas` tem grão mês × área e não conhece modalidade: filtrar
 * por Remoto não muda vaga aberta nenhuma, e isso é o contrato, não um defeito.
 *
 * Uma lista escrita é o que separa "sabemos por que este não muda" de "este não
 * muda e ninguém percebeu".
 */

import { describe, expect, it } from "vitest";

import {
  calcularKpis,
  KpiSemOrigem,
  metricasComCalculo,
} from "@/acesso/fixtures/kpis";
import type { Query } from "@/semantica/contrato";
import { QUERY_PADRAO } from "@/semantica/contrato";
import { kpisDaTela, REGISTRO_DE_KPIS } from "@/semantica/kpis";
import { origemDoKpi } from "@/semantica/origem-de-kpi";

const TELAS_DE_RH = [
  "rh/visao",
  "rh/colab",
  "rh/turnover",
  "rh/recrut",
  "rh/trein",
  "rh/engaj",
  "rh/sal",
] as const;

const MAXIMO_DE_KPIS = 6;

function com(mudanca: Partial<Query>): Query {
  return { ...QUERY_PADRAO, ...mudanca };
}

/* ------------------------------------------------------------------ *
 * Metade 1 — até 6 por tela, todos do catálogo
 * ------------------------------------------------------------------ */

describe("as 7 telas devolvem até 6 KPIs, todos do catálogo", () => {
  it.each(TELAS_DE_RH)("%s devolve no máximo 6", (tela) => {
    const kpis = calcularKpis(tela, QUERY_PADRAO);
    expect(kpis.length).toBeGreaterThan(0);
    expect(kpis.length).toBeLessThanOrEqual(MAXIMO_DE_KPIS);
  });

  it("as sete somam 42 cartões", () => {
    const total = TELAS_DE_RH.reduce(
      (a, t) => a + calcularKpis(t, QUERY_PADRAO).length,
      0,
    );
    expect(total).toBe(42);
  });

  it("todo KPI tem origem e métrica com cálculo", () => {
    // "Originado do catálogo" em três elos: o KPI aponta para uma métrica, e a
    // métrica sabe somar as linhas. Um elo faltando lança na chamada.
    const comCalculo = new Set(metricasComCalculo());
    const fora: string[] = [];
    for (const tela of TELAS_DE_RH) {
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

  it("KPI sem origem lança, em vez de devolver vazio", () => {
    /*
     * Vazio é um estado legítimo da seção 6.4 — "sem dado neste recorte". Usá-lo
     * para dizer "esqueci de declarar" misturaria as duas coisas na tela, e o
     * cartão em branco pareceria dado.
     */
    expect(() => calcularKpis("fin/visao", QUERY_PADRAO)).toThrow(KpiSemOrigem);
  });

  it("o envelope traz rótulo, unidade, delta e sentimento", () => {
    for (const kpi of calcularKpis("rh/visao", QUERY_PADRAO)) {
      expect(kpi.label.trim(), kpi.id).not.toBe("");
      expect(kpi.unit, kpi.id).toBeDefined();
      expect(["good", "bad", "neutral"], kpi.id).toContain(kpi.sentiment);
    }
  });

  it("os números do consolidado batem com o protótipo", () => {
    /*
     * A prova de que o cálculo lê o dado certo. Cinco cartões cujo valor o
     * protótipo mostra, conferidos contra o que sai das fixtures.
     */
    const porRotulo = (tela: string) =>
      Object.fromEntries(
        calcularKpis(tela, QUERY_PADRAO).map((k) => [k.label, k.value]),
      );

    const visao = porRotulo("rh/visao");
    expect(visao["Headcount"]).toBe(1240);
    expect(visao["Folha total"]).toBe(186);

    const colab = porRotulo("rh/colab");
    expect(Math.round((colab["Idade média"] ?? 0) * 10) / 10).toBe(34.2);
    expect(colab["Estados atendidos"]).toBe(12);

    const turnover = porRotulo("rh/turnover");
    expect(turnover["Desligamentos"]).toBe(145);
    expect(turnover["Custo do turnover"]).toBeCloseTo(12.4, 1);

    const recrut = porRotulo("rh/recrut");
    expect(recrut["Vagas abertas"]).toBe(48);
    expect(recrut["Fechadas (12m)"]).toBe(96);

    const trein = porRotulo("rh/trein");
    expect(trein["Horas de treinamento"]).toBe(21400);
    // 78% do quadro com ao menos uma trilha — o número do protótipo.
    expect(Math.round(trein["Participação"] ?? 0)).toBe(78);

    const sal = porRotulo("rh/sal");
    expect(Math.round((sal["Encargos"] ?? 0) * 10) / 10).toBe(37.5);
  });
});

/* ------------------------------------------------------------------ *
 * Metade 2 — nenhum KPI ignora o recorte
 * ------------------------------------------------------------------ */

/**
 * Os KPIs que **devem** ficar iguais sob uma dimensão, e por quê.
 *
 * Cada entrada é uma afirmação sobre o contrato, não uma dispensa. Se uma
 * dessas deixar de valer, o teste avisa pelo outro lado: a lista tem um caso
 * que confere que toda invariante declarada **de fato** é invariante.
 */
const INVARIANTES: ReadonlyArray<{
  readonly dimensao: "area" | "entidade" | "modalidade" | "periodo";
  readonly kpis: readonly string[];
  readonly porque: string;
}> = [
  {
    dimensao: "modalidade",
    kpis: [
      "rh-recrut-vagas-abertas",
      "rh-recrut-em-andamento",
      "rh-recrut-fechadas-12m",
      "rh-recrut-canceladas",
      "rh-recrut-tempo-de-fechamento",
      "rh-recrut-custo-por-contratacao",
    ],
    porque:
      "vw_fato_vagas tem grão mês × área e não conhece modalidade de trabalho: " +
      "uma vaga aberta não é presencial nem remota até alguém ser contratado",
  },
  {
    dimensao: "modalidade",
    kpis: [
      "rh-trein-horas-de-treinamento",
      "rh-trein-investimento",
      "rh-trein-conclusao-media",
      "rh-trein-custo-por-hora",
    ],
    porque:
      "vw_fato_treinamento tem modalidade **da trilha** — online, presencial, " +
      "híbrido — que é outra dimensão com nome parecido, e não a do trabalho",
  },
  {
    dimensao: "modalidade",
    kpis: ["rh-colab-trabalho-flexivel"],
    porque:
      "o denominador ignora o filtro de propósito: sob recorte de Remoto a " +
      "fração seria 100% e o cartão não diria nada",
  },
  {
    dimensao: "entidade",
    kpis: [
      "rh-recrut-vagas-abertas",
      "rh-recrut-em-andamento",
      "rh-recrut-fechadas-12m",
      "rh-recrut-canceladas",
      "rh-recrut-tempo-de-fechamento",
      "rh-recrut-custo-por-contratacao",
      "rh-trein-horas-de-treinamento",
      "rh-trein-investimento",
      "rh-trein-conclusao-media",
      "rh-trein-custo-por-hora",
    ],
    porque:
      "vagas e treinamento não têm entidade no grão da seção 10.1 — a vaga é " +
      "da área, e a trilha é da área e da trilha",
  },
  {
    dimensao: "periodo",
    kpis: [
      "rh-visao-headcount",
      "rh-colab-colaboradores",
      "rh-colab-idade-media",
      "rh-colab-tempo-medio-de-casa",
      "rh-colab-trabalho-flexivel",
      "rh-colab-estados-atendidos",
      "rh-colab-superior-ou-mais",
      "rh-trein-participacao",
    ],
    porque:
      "são medidas de estoque, lidas no último mês da janela (agg: last). Os " +
      "quatro períodos da tabela 6.2 terminam todos em dezembro, então o " +
      "último mês é o mesmo — e o quadro de dezembro não muda porque alguém " +
      "olhou três meses em vez de doze. Quem muda com o período é o fluxo",
  },
  {
    dimensao: "area",
    kpis: ["rh-colab-estados-atendidos"],
    porque:
      "a fixture distribui todas as áreas pelos doze estados, então a contagem " +
      "dá 12 em qualquer recorte. Fazê-la variar exige um perfil geográfico " +
      "esparso por área — RH em três estados, Operações em doze — que é " +
      "refinamento de fixture com decisão própria, e não sai de graça: a " +
      "repartição hoje fecha as duas margens, e zerar pares área × UF quebra a " +
      "margem por estado",
  },
  {
    dimensao: "entidade",
    kpis: ["rh-colab-estados-atendidos"],
    porque:
      "mesma razão do recorte por área: o perfil geográfico da fixture é " +
      "proporcional, e as duas entidades aparecem nos doze estados",
  },
  {
    dimensao: "modalidade",
    kpis: ["rh-colab-estados-atendidos"],
    porque:
      "mesma razão: presencial, híbrido e remoto aparecem nos doze estados. " +
      "É o caso em que a fixture proporcional mais destoa do mundo — trabalho " +
      "remoto se espalha e presencial se concentra onde há escritório",
  },
];

function ehInvariante(kpi: string, dimensao: string): boolean {
  return INVARIANTES.some(
    (i) => i.dimensao === dimensao && i.kpis.includes(kpi),
  );
}

/** Dois recortes distintos por dimensão, para comparar. */
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
    for (const tela of TELAS_DE_RH) {
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
    /*
     * O outro lado da lista. Sem este caso, a lista viraria um lugar onde
     * alguém põe um KPI que passou a mudar — e a dispensa continuaria valendo
     * sem que ninguém percebesse.
     */
    const enganadas: string[] = [];
    for (const { dimensao, kpis } of INVARIANTES) {
      const par = PARES.find((p) => p.dimensao === dimensao);
      if (par === undefined) continue;
      for (const id of kpis) {
        const registro = REGISTRO_DE_KPIS.find((k) => k.id === id);
        if (registro === undefined) {
          enganadas.push(`${id}: não existe no registro`);
          continue;
        }
        const emA = calcularKpis(registro.tela, par.a).find((k) => k.id === id);
        const emB = calcularKpis(registro.tela, par.b).find((k) => k.id === id);
        if (emA?.value !== emB?.value) {
          enganadas.push(`${id} muda com ${dimensao} — saia da lista`);
        }
      }
    }
    expect(enganadas).toEqual([]);
  });

  it("toda invariante traz o porquê escrito", () => {
    const semRazao = INVARIANTES.filter((i) => i.porque.trim().length < 40);
    expect(semRazao).toEqual([]);
  });

  it("o ano de 2025 devolve vazio, e não zero (PR-4)", () => {
    // A fixture carrega 2026; 2025 entra com T-152. Ausência é estado, e zero
    // afirmaria que a empresa não teve ninguém.
    const kpis = calcularKpis("rh/visao", com({ ano: "2025" }));
    expect(kpis.every((k) => k.value === null)).toBe(true);
  });
});

/* ------------------------------------------------------------------ *
 * O delta
 * ------------------------------------------------------------------ */

describe("o delta compara com a janela anterior", () => {
  it("dezembro tem delta; doze meses não", () => {
    /*
     * Dezembro compara com novembro. Para o recorte de 12 meses não há doze
     * meses anteriores dentro do ano, e o delta é `null` até 2025 entrar com
     * T-152 — `null`, e não zero: zero afirmaria que o número não mudou.
     */
    const dezembro = calcularKpis("rh/visao", com({ periodo: "dezembro" }));
    expect(dezembro.some((k) => k.delta !== null)).toBe(true);

    const ano = calcularKpis("rh/visao", QUERY_PADRAO);
    expect(ano.every((k) => k.delta === null)).toBe(true);
  });

  it("sem delta, o sentimento é neutro", () => {
    // Cor sem variação seria cor sem informação — e a seção 13 exige que cor
    // nunca seja o único sinal.
    const ano = calcularKpis("rh/visao", QUERY_PADRAO);
    expect(ano.every((k) => k.sentiment === "neutral")).toBe(true);
  });

  it("turnover subindo é ruim; retenção subindo é bom", () => {
    // O par que mais expõe um sentido trocado: são o mesmo número visto do
    // avesso.
    const kpis = calcularKpis("rh/turnover", com({ periodo: "dezembro" }));
    const tov = kpis.find((k) => k.id === "rh-turnover-turnover-12m");
    const ret = kpis.find((k) => k.id === "rh-turnover-retencao-12m");
    expect(tov?.delta).not.toBeNull();
    expect(Math.sign(tov?.delta ?? 0)).toBe(-Math.sign(ret?.delta ?? 0));

    /*
     * E o sentimento afirmado, nao so comparado.
     *
     * A primeira versao deste caso conferia apenas que os dois tinham o MESMO
     * sentimento -- e passava com a regra invertida, porque invertida os dois
     * viravam "good" juntos. Uma provocacao mostrou exatamente isso.
     */
    const esperado = (tov?.delta ?? 0) > 0 ? "bad" : "good";
    expect(tov?.sentiment, "turnover subindo e ruim").toBe(esperado);
    expect(ret?.sentiment, "retencao caindo e ruim").toBe(esperado);
  });
});
