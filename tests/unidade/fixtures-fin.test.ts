/**
 * As fixtures dimensionais de Financeiro (T-111).
 *
 * O aceite: as três views existem no grão mensal e **a soma consolidada de 2026
 * reproduz** receita líquida R$ 1.200 mi, EBITDA R$ 200 mi, lucro líquido
 * -R$ 8 mi, desvio +R$ 56 mi e ciclo de 76 dias (PMR 52 + PME 75 - PMP 51).
 *
 * Os cinco números não são cinco constantes conferidas uma a uma: são o
 * resultado de somar linhas e aplicar a fórmula. É a diferença entre uma
 * fixture que reproduz o Anexo C e uma que o **copia** — a segunda passaria
 * neste arquivo e falharia no primeiro recorte.
 */

import { describe, expect, it } from "vitest";

import { FATIA_DA_UNIDADE_SP } from "@/acesso/fixtures/entidade";
import {
  AGREGADO_DE_ENTIDADE,
  AREAS_ARMAZENADAS,
  ENTIDADES_ARMAZENADAS,
  mesesDe,
} from "@/acesso/fixtures/eixos";
import {
  VW_FATO_CONTAS,
  VW_FATO_FIN_MES,
  VW_FATO_ORCAMENTO,
} from "@/acesso/fixtures/fin";
import {
  CENTROS_DE_CUSTO,
  DIAS_DO_ANO,
  FAIXAS_DE_AGING,
  PONTE_DA_DRE,
  PONTE_DO_CAIXA,
  PRAZOS_DO_ANEXO_C,
  RECEITA_LIQUIDA_ANO_ANTERIOR,
} from "@/acesso/fixtures/referencia-fin";
import { ANO_DA_FIXTURE } from "@/acesso/fixtures/rh";

const MESES = mesesDe(ANO_DA_FIXTURE);
const DEZEMBRO = MESES.at(-1) ?? "";
const MI = 1_000_000;
const DEZ = 10;

/** Arredonda para uma casa. `toFixed` é reservado ao módulo de formato (T-125). */
const umaCasa = (x: number) => Math.round(x * DEZ) / DEZ;

const soma = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
const somaPor = <T>(linhas: readonly T[], f: (l: T) => number) =>
  soma(linhas.map(f));

/** Uma medida do ano inteiro, em R$ mi. */
const doAno = (f: (l: (typeof VW_FATO_FIN_MES)[number]) => number) =>
  somaPor(VW_FATO_FIN_MES, f) / MI;

/* ------------------------------------------------------------------ *
 * O grão
 * ------------------------------------------------------------------ */

describe("as três views existem no grão da seção 10.1", () => {
  it("vw_fato_fin_mes: mês × entidade — sem área", () => {
    expect(VW_FATO_FIN_MES).toHaveLength(
      MESES.length * ENTIDADES_ARMAZENADAS.length,
    );
    // O grão da 10.1 não tem área, e é decisão do PRD: receita e resultado
    // financeiro não têm área de origem. Ratear os dois por quadro daria um
    // número que parece recorte e é arbitragem.
    const chaves = Object.keys(VW_FATO_FIN_MES[0] ?? {});
    expect(chaves).not.toContain("area");
  });

  it("vw_fato_orcamento: mês × entidade × centro de custo", () => {
    expect(VW_FATO_ORCAMENTO).toHaveLength(
      MESES.length * ENTIDADES_ARMAZENADAS.length * CENTROS_DE_CUSTO.length,
    );
  });

  it("vw_fato_contas: mês × entidade × faixa de aging", () => {
    expect(VW_FATO_CONTAS).toHaveLength(
      MESES.length * ENTIDADES_ARMAZENADAS.length * FAIXAS_DE_AGING.length,
    );
  });

  it("centro de custo não é área: são oito contra sete", () => {
    /*
     * Sete centros têm o nome de uma área e o oitavo é `Corporativo`, que não
     * tem quadro próprio. Tratar as duas dimensões como a mesma faria o
     * Corporativo sumir do orçamento ou virar uma oitava área fantasma nos
     * painéis de RH.
     */
    expect(CENTROS_DE_CUSTO).toHaveLength(8);
    expect(AREAS_ARMAZENADAS).toHaveLength(7);
    const codigos = CENTROS_DE_CUSTO.map((c) => c.codigo);
    expect(codigos).toContain("corporativo");
    expect(AREAS_ARMAZENADAS).not.toContain("corporativo");
  });

  it("nenhuma linha carrega a entidade agregada", () => {
    const todas = [...VW_FATO_FIN_MES, ...VW_FATO_ORCAMENTO, ...VW_FATO_CONTAS];
    expect(todas.filter((l) => l.entidade === AGREGADO_DE_ENTIDADE)).toEqual(
      [],
    );
  });
});

/* ------------------------------------------------------------------ *
 * Os cinco números do aceite
 * ------------------------------------------------------------------ */

describe("a soma consolidada de 2026 reproduz o Anexo C", () => {
  const receita = doAno((l) => l.receitaLiquida);
  const cmv = doAno((l) => l.cmv);
  const despesas = doAno((l) => l.despesasOperacionais);
  const ebitda = receita - cmv - despesas;

  it("receita líquida R$ 1.200 mi", () => {
    expect(receita).toBe(PONTE_DA_DRE.receitaLiquida);
    // E a bruta menos as deduções dá a líquida, e não um terceiro número.
    expect(doAno((l) => l.receitaBruta)).toBe(PONTE_DA_DRE.receitaBruta);
    expect(doAno((l) => l.receitaBruta) - doAno((l) => l.deducoes)).toBe(
      receita,
    );
  });

  it("EBITDA R$ 200 mi — calculado, não guardado", () => {
    // `receita - CMV - despesas`. Se o EBITDA estivesse armazenado, este teste
    // conferiria uma constante contra ela mesma.
    expect(ebitda).toBe(PONTE_DA_DRE.ebitda);
  });

  it("lucro líquido -R$ 8 mi, e a ponte fecha sem resíduo", () => {
    const lucro =
      ebitda -
      doAno((l) => l.depreciacaoEAmortizacao) -
      doAno((l) => l.resultadoFinanceiro) -
      doAno((l) => l.naoOperacional);
    expect(lucro).toBe(PONTE_DA_DRE.lucroLiquido);
  });

  it("e cada degrau armazenado é o degrau da ponte", () => {
    /*
     * Este caso existe porque os dois acima são mais fracos do que parecem.
     *
     * As despesas operacionais são **derivadas** de `receita - CMV - EBITDA`,
     * então a ponte fecha por construção: trocar o CMV de 720 para 700 empurra
     * os 20 para as despesas, e tanto o EBITDA quanto o lucro continuam em 200
     * e -8. Uma provocação mostrou exatamente isso — só o teste de ciclo
     * reprovava, e por acidente, porque o CMV é denominador do PME.
     *
     * O que precisa ser fixado é cada componente, um por um. É o que faz o
     * painel `fin-dre` desenhar os degraus certos, e não só o total certo.
     */
    expect(cmv).toBe(PONTE_DA_DRE.cmv);
    expect(despesas).toBe(PONTE_DA_DRE.despesasOperacionais);
    expect(doAno((l) => l.depreciacaoEAmortizacao)).toBe(
      PONTE_DA_DRE.depreciacaoEAmortizacao,
    );
    expect(doAno((l) => l.resultadoFinanceiro)).toBe(
      PONTE_DA_DRE.resultadoFinanceiro,
    );
    expect(doAno((l) => l.naoOperacional)).toBe(PONTE_DA_DRE.naoOperacional);
    expect(doAno((l) => l.deducoes)).toBe(PONTE_DA_DRE.deducoes);
  });

  it("desvio orçamentário +R$ 56 mi", () => {
    const orcado = somaPor(VW_FATO_ORCAMENTO, (l) => l.orcado) / MI;
    const realizado = somaPor(VW_FATO_ORCAMENTO, (l) => l.realizado) / MI;
    expect(orcado).toBe(1140);
    expect(realizado).toBe(1196);
    expect(realizado - orcado).toBe(56);
  });

  it("ciclo de 76 dias, dos saldos e não de uma constante", () => {
    const dezembro = <T extends { readonly mes: string }>(
      linhas: readonly T[],
    ) => linhas.filter((l) => l.mes === DEZEMBRO);

    const aReceber = somaPor(dezembro(VW_FATO_CONTAS), (l) => l.aReceber) / MI;
    const aPagar = somaPor(dezembro(VW_FATO_CONTAS), (l) => l.aPagar) / MI;
    const estoque = somaPor(dezembro(VW_FATO_FIN_MES), (l) => l.estoque) / MI;

    const pmr = (aReceber / receita) * DIAS_DO_ANO;
    const pme = (estoque / cmv) * DIAS_DO_ANO;
    const pmp = (aPagar / cmv) * DIAS_DO_ANO;

    expect(Math.round(pmr)).toBe(PRAZOS_DO_ANEXO_C.pmr);
    expect(Math.round(pme)).toBe(PRAZOS_DO_ANEXO_C.pme);
    expect(Math.round(pmp)).toBe(PRAZOS_DO_ANEXO_C.pmp);
    expect(Math.round(pmr + pme - pmp)).toBe(PRAZOS_DO_ANEXO_C.ciclo);
  });

  it("e o crescimento de +12,4% sai da mesma receita", () => {
    const anterior = soma([...RECEITA_LIQUIDA_ANO_ANTERIOR]);
    expect(anterior).toBe(1068);
    const CEM = 100;
    expect(umaCasa((receita / anterior) * CEM - CEM)).toBe(12.4);
  });
});

/* ------------------------------------------------------------------ *
 * O caixa
 * ------------------------------------------------------------------ */

describe("as duas leituras do caixa concordam", () => {
  it("a ponte fecha: 135 + 185 - 140 - 80 = 100", () => {
    expect(
      PONTE_DO_CAIXA.saldoInicial +
        PONTE_DO_CAIXA.fco +
        PONTE_DO_CAIXA.fci +
        PONTE_DO_CAIXA.fcf,
    ).toBe(PONTE_DO_CAIXA.saldoFinal);
  });

  it("e o saldo acumulado das entradas e saídas chega no mesmo lugar", () => {
    /*
     * O que este teste impede: `cx-ponte` e `cx-saldo` são dois painéis da
     * mesma tela contando a mesma história por caminhos diferentes. Se as duas
     * séries não fecharem no mesmo saldo final, a tela se contradiz sozinha —
     * e é o tipo de coisa que só se descobre na reunião.
     */
    const saldoFinal =
      somaPor(
        VW_FATO_FIN_MES.filter((l) => l.mes === DEZEMBRO),
        (l) => l.saldoDeCaixa,
      ) / MI;
    expect(saldoFinal).toBe(PONTE_DO_CAIXA.saldoFinal);

    const acumulado =
      PONTE_DO_CAIXA.saldoInicial +
      doAno((l) => l.entradasDeCaixa) -
      doAno((l) => l.saidasDeCaixa);
    expect(acumulado).toBe(saldoFinal);
  });

  it("o FCO do ano é R$ 185 mi", () => {
    expect(doAno((l) => l.fco)).toBe(PONTE_DO_CAIXA.fco);
  });

  it("o saldo de cada mês é o anterior mais entradas menos saídas", () => {
    const falhas: string[] = [];
    let anterior = PONTE_DO_CAIXA.saldoInicial * MI;
    for (const mes of MESES) {
      const doMes = VW_FATO_FIN_MES.filter((l) => l.mes === mes);
      const esperado =
        anterior +
        somaPor(doMes, (l) => l.entradasDeCaixa) -
        somaPor(doMes, (l) => l.saidasDeCaixa);
      const obtido = somaPor(doMes, (l) => l.saldoDeCaixa);
      if (obtido !== esperado) falhas.push(mes);
      anterior = obtido;
    }
    expect(falhas).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * Nada de taxa nem de prazo armazenado
 * ------------------------------------------------------------------ */

describe("nenhum percentual e nenhum prazo estão armazenados", () => {
  it("as colunas de fato são todas absolutas", () => {
    // Um campo chamado margem, taxa, percentual ou prazo seria um número que
    // não se recalcula sob recorte — o achado 5 do Anexo D em forma de coluna.
    const proibidos = /margem|taxa|percentual|pmr|pme|pmp|ciclo|prazo/i;
    const suspeitas = Object.keys(VW_FATO_FIN_MES[0] ?? {}).filter((c) =>
      proibidos.test(c),
    );
    expect(suspeitas).toEqual([]);
  });

  it("a margem de um recorte é a do recorte", () => {
    const margem = (linhas: typeof VW_FATO_FIN_MES) => {
      const r = somaPor(linhas, (l) => l.receitaLiquida);
      const c = somaPor(linhas, (l) => l.cmv);
      const d = somaPor(linhas, (l) => l.despesasOperacionais);
      return (r - c - d) / r;
    };
    const sp = VW_FATO_FIN_MES.filter((l) => l.entidade === "unidade-sp");
    expect(margem(sp)).not.toBe(margem(VW_FATO_FIN_MES));
  });

  it("o PMR de um mês não é o PMR do ano", () => {
    // Se o prazo estivesse guardado, a régua de ciclo mostraria a mesma foto
    // em todos os recortes — que é a definição de um número que ignora filtro.
    const pmrDoMes = (mes: string) => {
      const receber = somaPor(
        VW_FATO_CONTAS.filter((l) => l.mes === mes),
        (l) => l.aReceber,
      );
      const receita = somaPor(
        VW_FATO_FIN_MES.filter((l) => l.mes === mes),
        (l) => l.receitaLiquida,
      );
      return receber / receita;
    };
    expect(pmrDoMes("2026-06")).not.toBe(pmrDoMes("2026-12"));
  });
});

/* ------------------------------------------------------------------ *
 * A entidade
 * ------------------------------------------------------------------ */

describe("cada medida financeira tem a sua fatia de entidade", () => {
  it("soma das entidades é o consolidado, em toda medida", () => {
    const medidas: ReadonlyArray<
      (l: (typeof VW_FATO_FIN_MES)[number]) => number
    > = [
      (l) => l.receitaLiquida,
      (l) => l.cmv,
      (l) => l.despesasOperacionais,
      (l) => l.entradasDeCaixa,
    ];
    for (const f of medidas) {
      const porEntidade = ENTIDADES_ARMAZENADAS.map((e) =>
        somaPor(
          VW_FATO_FIN_MES.filter((l) => l.entidade === e),
          f,
        ),
      );
      expect(soma(porEntidade)).toBe(somaPor(VW_FATO_FIN_MES, f));
    }
  });

  it("e as fatias são as declaradas, medida a medida", () => {
    const UM_PONTO = 0.011;
    const fatia = (f: (l: (typeof VW_FATO_FIN_MES)[number]) => number) =>
      somaPor(
        VW_FATO_FIN_MES.filter((l) => l.entidade === "unidade-sp"),
        f,
      ) / somaPor(VW_FATO_FIN_MES, f);

    const casos: ReadonlyArray<
      [string, (l: (typeof VW_FATO_FIN_MES)[number]) => number, number]
    > = [
      ["receita", (l) => l.receitaLiquida, FATIA_DA_UNIDADE_SP["receita"] ?? 0],
      ["cmv", (l) => l.cmv, FATIA_DA_UNIDADE_SP["cmv"] ?? 0],
      [
        "despesas",
        (l) => l.despesasOperacionais,
        FATIA_DA_UNIDADE_SP["despesas"] ?? 0,
      ],
      ["caixa", (l) => l.entradasDeCaixa, FATIA_DA_UNIDADE_SP["caixa"] ?? 0],
    ];

    const fora = casos
      .map(([nome, f, alvo]) => ({ nome, obtido: fatia(f), alvo }))
      .filter((x) => Math.abs(x.obtido - x.alvo) > UM_PONTO);
    expect(fora).toEqual([]);
  });

  it("a fatia da receita não é a fatia do CMV", () => {
    // Duas fatias diferentes significam margens diferentes por entidade — que
    // é o que faz o recorte por entidade dizer alguma coisa.
    expect(FATIA_DA_UNIDADE_SP["receita"]).not.toBe(FATIA_DA_UNIDADE_SP["cmv"]);
  });
});

/* ------------------------------------------------------------------ *
 * A divergência registrada
 * ------------------------------------------------------------------ */

describe("a série de margem líquida do protótipo não fecha, e por isso saiu", () => {
  it("aplicá-la mês a mês daria -4,3 e a ponte dá -8", () => {
    /*
     * A razão de `mLiq` não estar transcrita em `referencia-fin.ts`.
     *
     * A conta está aqui, e não só na prosa, para que a decisão continue
     * verificável: se alguém reintroduzir a série achando que ela é fonte, a
     * diferença de R$ 3,7 mi volta a aparecer — e no painel, não no teste.
     */
    const receita = [88, 92, 96, 99, 104, 112, 104, 101, 98, 102, 101, 103];
    const mLiq = [
      1.2, 1.0, 0.8, 0.6, 0.4, 0.9, 0.2, -0.4, -1.4, -1.9, -2.3, -3.1,
    ];
    const CEM = 100;
    const pelaSerie = soma(receita.map((r, i) => (r * (mLiq[i] ?? 0)) / CEM));

    expect(umaCasa(pelaSerie)).toBe(-4.3);
    expect(PONTE_DA_DRE.lucroLiquido).toBe(-8);
    expect(umaCasa(pelaSerie)).not.toBe(PONTE_DA_DRE.lucroLiquido);
  });
});
