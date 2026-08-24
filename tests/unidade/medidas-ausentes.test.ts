/**
 * As medidas que faltavam, e as origens declaradas (T-143).
 *
 * O aceite pede três coisas:
 *
 * 1. **para cada KPI do achado 5, view, coluna-medida e denominador
 *    declarados**;
 * 2. as colunas nomeadas existindo nas fixtures — custo de recrutamento em
 *    `vw_fato_vagas`, respondentes e elegíveis, soma de idade e de tempo de
 *    casa em `vw_fato_rh_mes`;
 * 3. **nenhuma das métricas fica sem coluna de origem.**
 *
 * O que dá sentido aos três: um KPI do achado 5 é um número que não responde a
 * filtro. Declarar a origem só serve se o número passar a **mudar** quando o
 * recorte muda — e é isso que o último bloco confere, um a um.
 */

import { describe, expect, it } from "vitest";

import {
  VW_FATO_FATURAMENTO_CLIENTE,
  VW_FATO_FIN_MES,
} from "@/acesso/fixtures/fin";
import { VW_FATO_RH_PERFIL } from "@/acesso/fixtures/perfil";
import {
  COMPOSICAO_DA_FOLHA,
  QUEBRAS_DO_QUADRO,
} from "@/acesso/fixtures/referencia-perfil";
import {
  VW_FATO_RH_MES,
  VW_FATO_TREINAMENTO,
  VW_FATO_VAGAS,
} from "@/acesso/fixtures/rh";
import { REGISTRO_DE_KPIS } from "@/semantica/kpis";
import { ORIGEM_DOS_KPIS_CONSTANTES } from "@/semantica/origem-de-kpi";

const MI = 1_000_000;
const MIL = 1000;
const CEM = 100;
const DEZ = 10;
const umaCasa = (x: number) => Math.round(x * DEZ) / DEZ;

const soma = <T>(xs: readonly T[], f: (l: T) => number) =>
  xs.reduce((a, l) => a + f(l), 0);
const DEZEMBRO = VW_FATO_RH_MES.filter((l) => l.mes === "2026-12");

/* ------------------------------------------------------------------ *
 * A declaração cobre todos
 * ------------------------------------------------------------------ */

describe("nenhum KPI do achado 5 fica sem origem", () => {
  const constantes = REGISTRO_DE_KPIS.filter((k) => k.constanteNoPrototipo);

  it("são 23 no registro, e não os 15 do Anexo D (H-48)", () => {
    // A diferença está com Produto em H-48. Declarar origem para os 23
    // satisfaz "nenhuma das 15 fica sem coluna" com folga; fazer pelos 15 do
    // texto é que deixaria oito de fora.
    expect(constantes).toHaveLength(23);
  });

  it("cada um dos 23 tem view, medida e leitura declaradas", () => {
    const semOrigem = constantes
      .filter((k) => !ORIGEM_DOS_KPIS_CONSTANTES.some((o) => o.kpi === k.id))
      .map((k) => k.id);
    expect(semOrigem).toEqual([]);
  });

  it("e nenhuma origem sobra apontando para KPI que não existe", () => {
    const ids = new Set(REGISTRO_DE_KPIS.map((k) => k.id));
    const orfas = ORIGEM_DOS_KPIS_CONSTANTES.filter((o) => !ids.has(o.kpi)).map(
      (o) => o.kpi,
    );
    expect(orfas).toEqual([]);
  });

  it("toda origem nomeia uma view de fato e uma medida não vazia", () => {
    const VIEWS = [
      "vw_fato_rh_mes",
      "vw_fato_vagas",
      "vw_fato_treinamento",
      "vw_fato_rh_perfil",
      "vw_fato_fin_mes",
      "vw_fato_orcamento",
      "vw_fato_contas",
      "vw_fato_faturamento_cliente",
    ];
    const fora = ORIGEM_DOS_KPIS_CONSTANTES.filter(
      (o) => !VIEWS.includes(o.view) || o.medida.trim() === "",
    ).map((o) => `${o.kpi}: ${o.view}`);
    expect(fora).toEqual([]);
  });

  it("só duas medidas são absolutas; as outras 21 declaram denominador", () => {
    // Denominador é parte da definição: `encargos / salarios` dá 37,5% e
    // `encargos / folha` dá 22,6%, e os dois são "percentual de encargos".
    const semDenominador = ORIGEM_DOS_KPIS_CONSTANTES.filter(
      (o) => o.denominador === null,
    ).map((o) => o.kpi);
    expect(semDenominador).toEqual([
      "rh-colab-estados-atendidos",
      "fin-contas-ciclo-de-conversao",
    ]);
  });
});

/* ------------------------------------------------------------------ *
 * As colunas que o aceite nomeia
 * ------------------------------------------------------------------ */

describe("as colunas nomeadas existem nas fixtures", () => {
  it("custo de recrutamento entra em vw_fato_vagas", () => {
    const custo = soma(VW_FATO_VAGAS, (l) => l.custoDeRecrutamento);
    const contratados = soma(VW_FATO_VAGAS, (l) => l.contratados);
    expect(custo).toBeGreaterThan(0);
    expect(umaCasa(custo / contratados / MIL)).toBe(8.6);
  });

  it("respondentes e elegíveis entram em vw_fato_rh_mes", () => {
    const cobertura =
      soma(DEZEMBRO, (l) => l.respondentes) /
      soma(DEZEMBRO, (l) => l.elegiveis);
    expect(Math.round(cobertura * CEM)).toBe(74);
  });

  it("soma de idade e soma de tempo de casa entram em vw_fato_rh_mes", () => {
    const quadro = soma(DEZEMBRO, (l) => l.headcountFte);
    expect(umaCasa(soma(DEZEMBRO, (l) => l.somaDeIdade) / quadro)).toBe(34.2);
    expect(umaCasa(soma(DEZEMBRO, (l) => l.somaDeTempoDeCasa) / quadro)).toBe(
      3.1,
    );
  });

  it("e a soma do tempo até a saída, com o denominador certo", () => {
    /*
     * O denominador é `desligamentos`, não `headcountFte`. Trocar os dois daria
     * um número plausível — 0,25 anos — e errado. É a distinção que o registro
     * de KPIs já anotava em `semDetalhamentoPorque`.
     */
    const anos =
      soma(VW_FATO_RH_MES, (l) => l.somaDeTempoAteASaida) /
      soma(VW_FATO_RH_MES, (l) => l.desligamentos);
    expect(umaCasa(anos)).toBe(2.1);
  });

  it("a folha é a soma das quatro parcelas, e não uma quinta coluna", () => {
    const desencontradas = VW_FATO_RH_MES.filter(
      (l) =>
        l.salarios + l.encargos + l.beneficios + l.variavel !== l.folhaReais,
    );
    expect(desencontradas).toEqual([]);

    // E cada parcela fecha no valor do protótipo.
    const esperado = Object.fromEntries(
      COMPOSICAO_DA_FOLHA.map((c) => [c.codigo, c.milhoes]),
    );
    expect(soma(VW_FATO_RH_MES, (l) => l.salarios) / MI).toBe(
      esperado["salarios"],
    );
    expect(soma(VW_FATO_RH_MES, (l) => l.encargos) / MI).toBe(
      esperado["encargos"],
    );
  });

  it("encargos é sobre salários, e a diferença importa", () => {
    const encargos = soma(VW_FATO_RH_MES, (l) => l.encargos);
    const salarios = soma(VW_FATO_RH_MES, (l) => l.salarios);
    const folha = soma(VW_FATO_RH_MES, (l) => l.folhaReais);
    expect(umaCasa((encargos / salarios) * CEM)).toBe(37.5);
    // O denominador errado dá 22,6% — os dois são "percentual de encargos".
    expect(umaCasa((encargos / folha) * CEM)).toBe(22.6);
  });

  it("notas emitidas entram em vw_fato_fin_mes", () => {
    expect(soma(VW_FATO_FIN_MES, (l) => l.notasEmitidas)).toBe(18_400);
    const ticket =
      soma(VW_FATO_FIN_MES, (l) => l.receitaLiquida) /
      soma(VW_FATO_FIN_MES, (l) => l.notasEmitidas);
    expect(umaCasa(ticket / MIL)).toBe(65.2);
  });

  it("a receita dos dez maiores clientes existe, e dá os 54,3%", () => {
    const top =
      soma(VW_FATO_FATURAMENTO_CLIENTE, (l) => l.receita) /
      soma(VW_FATO_FIN_MES, (l) => l.receitaLiquida);
    expect(umaCasa(top * CEM)).toBe(54.3);
  });
});

/* ------------------------------------------------------------------ *
 * O perfil do quadro
 * ------------------------------------------------------------------ */

describe("vw_fato_rh_perfil: cinco quebras da mesma empresa", () => {
  const dezembro = VW_FATO_RH_PERFIL.filter((l) => l.mes === "2026-12");

  it("as cinco dimensões estão presentes", () => {
    expect(new Set(dezembro.map((l) => l.dimensao))).toEqual(
      new Set(Object.keys(QUEBRAS_DO_QUADRO)),
    );
  });

  it("cada quebra soma o mesmo quadro, em todo mês", () => {
    /*
     * A invariante que segura a view inteira. São a mesma empresa vista por
     * cinco atributos: uma quebra que não fechasse com as outras seria gente
     * contada duas vezes ou nenhuma — e o painel de perfil discordaria do KPI
     * de headcount na mesma tela.
     */
    const falhas: string[] = [];
    for (const mes of new Set(VW_FATO_RH_PERFIL.map((l) => l.mes))) {
      const doMes = VW_FATO_RH_MES.filter((l) => l.mes === mes);
      const quadro = soma(doMes, (l) => l.headcountFte);
      for (const dimensao of Object.keys(QUEBRAS_DO_QUADRO)) {
        const daQuebra = soma(
          VW_FATO_RH_PERFIL.filter(
            (l) => l.mes === mes && l.dimensao === dimensao,
          ),
          (l) => l.headcountFte,
        );
        if (daQuebra !== quadro) falhas.push(`${mes}/${dimensao}`);
      }
    }
    expect(falhas).toEqual([]);
  });

  it("e fecha por área também, não só no total", () => {
    const falhas: string[] = [];
    for (const area of ["operacoes", "tecnologia", "rh"]) {
      const quadro = soma(
        DEZEMBRO.filter((l) => l.area === area),
        (l) => l.headcountFte,
      );
      for (const dimensao of Object.keys(QUEBRAS_DO_QUADRO)) {
        const daQuebra = soma(
          dezembro.filter((l) => l.area === area && l.dimensao === dimensao),
          (l) => l.headcountFte,
        );
        if (daQuebra !== quadro) falhas.push(`${area}/${dimensao}`);
      }
    }
    expect(falhas).toEqual([]);
  });

  it("dezembro reproduz os números do protótipo, valor a valor", () => {
    const falhas: string[] = [];
    for (const [dimensao, partes] of Object.entries(QUEBRAS_DO_QUADRO)) {
      for (const parte of partes) {
        const obtido = soma(
          dezembro.filter(
            (l) => l.dimensao === dimensao && l.valor === parte.codigo,
          ),
          (l) => l.headcountFte,
        );
        if (obtido !== parte.headcount) {
          falhas.push(
            `${dimensao}/${parte.codigo}: ${obtido} ≠ ${parte.headcount}`,
          );
        }
      }
    }
    expect(falhas).toEqual([]);
  });

  it("doze estados atendidos, com SP em 37,7%", () => {
    const porUf = dezembro.filter((l) => l.dimensao === "uf");
    const comGente = new Set(
      porUf.filter((l) => l.headcountFte > 0).map((l) => l.valor),
    );
    expect(comGente.size).toBe(12);
    const sp = soma(
      porUf.filter((l) => l.valor === "SP"),
      (l) => l.headcountFte,
    );
    expect(umaCasa((sp / 1240) * CEM)).toBe(37.7);
  });

  it("nenhuma linha é uma pessoa: toda contagem é agregada", () => {
    // Uma linha com `headcountFte: 1` é legítima — é uma célula pequena, não
    // uma pessoa nomeada. O que não pode existir é atributo de identificação, e
    // o esquema da view só tem chave dimensional e contagem.
    const campos = new Set(VW_FATO_RH_PERFIL.flatMap((l) => Object.keys(l)));
    expect([...campos].sort()).toEqual([
      "area",
      "dimensao",
      "entidade",
      "headcountFte",
      "mes",
      "modalidade",
      "valor",
    ]);
  });
});

/* ------------------------------------------------------------------ *
 * O que o achado 5 pedia: o número muda com o recorte
 * ------------------------------------------------------------------ */

describe("os KPIs do achado 5 deixaram de ser constantes", () => {
  /** O mesmo cálculo, no consolidado e numa área. */
  function noRecorte<T extends { area?: string }>(
    linhas: readonly T[],
    area: string,
    numerador: (l: T) => number,
    denominador: (l: T) => number,
  ): [number, number] {
    const total = soma(linhas, numerador) / soma(linhas, denominador);
    const daArea = linhas.filter((l) => l.area === area);
    return [total, soma(daArea, numerador) / soma(daArea, denominador)];
  }

  it("idade média muda entre o consolidado e Tecnologia", () => {
    const [total, area] = noRecorte(
      DEZEMBRO,
      "tecnologia",
      (l) => l.somaDeIdade,
      (l) => l.headcountFte,
    );
    expect(umaCasa(total)).toBe(34.2);
    expect(umaCasa(area)).not.toBe(umaCasa(total));
  });

  it("custo por contratação muda entre o consolidado e Tecnologia", () => {
    const [total, area] = noRecorte(
      VW_FATO_VAGAS,
      "tecnologia",
      (l) => l.custoDeRecrutamento,
      (l) => l.contratados,
    );
    // Tecnologia leva 61 dias para fechar contra 26 de Logística; custa mais.
    expect(area).toBeGreaterThan(total);
  });

  it("ticket médio muda entre o ano e um mês", () => {
    const doAno =
      soma(VW_FATO_FIN_MES, (l) => l.receitaLiquida) /
      soma(VW_FATO_FIN_MES, (l) => l.notasEmitidas);
    const deJunho = VW_FATO_FIN_MES.filter((l) => l.mes === "2026-06");
    const doMes =
      soma(deJunho, (l) => l.receitaLiquida) /
      soma(deJunho, (l) => l.notasEmitidas);
    expect(umaCasa(doMes / MIL)).not.toBe(umaCasa(doAno / MIL));
  });

  it("conclusão de treinamento muda entre modalidades de trilha", () => {
    const conclusao = (
      filtro: (l: (typeof VW_FATO_TREINAMENTO)[number]) => boolean,
    ) => {
      const linhas = VW_FATO_TREINAMENTO.filter(filtro);
      return (
        soma(linhas, (l) => l.trilhasConcluidas) /
        soma(linhas, (l) => l.trilhasIniciadas)
      );
    };
    expect(conclusao((l) => l.modalidadeDeTrilha === "online")).toBeLessThan(
      conclusao((l) => l.modalidadeDeTrilha === "presencial"),
    );
  });

  it("superior ou mais dá 51,6%, e não os 48,9% do protótipo", () => {
    /*
     * A divergência medida. O protótipo mostra 48,9%, que é
     * `(452 + 154) / 1.240` — Superior mais Pós, **sem Mestrado+**. Mas
     * mestrado é superior ou mais.
     *
     * O outro número do mesmo cartão fecha: "12,4% com pós" é `154 / 1.240`
     * exatamente, e ali a exclusão é correta, porque pós é um nível e não um
     * piso. A mesma exclusão foi aplicada nos dois lugares e só valia num.
     */
    const dezembro = VW_FATO_RH_PERFIL.filter(
      (l) => l.mes === "2026-12" && l.dimensao === "escolaridade",
    );
    const acima = ["superior", "pos-graduacao", "mestrado-mais"];
    const fracao =
      soma(
        dezembro.filter((l) => acima.includes(l.valor)),
        (l) => l.headcountFte,
      ) / soma(dezembro, (l) => l.headcountFte);
    expect(umaCasa(fracao * CEM)).toBe(51.6);

    // E a conta do protótipo, para que a diferença fique explícita.
    const semMestrado =
      soma(
        dezembro.filter((l) => ["superior", "pos-graduacao"].includes(l.valor)),
        (l) => l.headcountFte,
      ) / soma(dezembro, (l) => l.headcountFte);
    expect(umaCasa(semMestrado * CEM)).toBe(48.9);
  });
});
