/**
 * A leitura de um número contra o custo do dinheiro (seção 7.1, estágio 2).
 *
 * Um número sozinho não é resposta de CFO. "ROE de 8,3%" vira leitura quando
 * está ao lado do CDI de 13,9% e do IPCA de 4,4%: rende 5,6 p.p. menos que uma
 * aplicação sem risco, e 3,7% acima da inflação. Estas funções fazem essa
 * conta — **aqui, em código nosso**, e nunca no modelo (princípio P2). O que
 * sai delas entra no envelope, e o verificador confere cada número do texto
 * contra ele (RF-15).
 *
 * ## Por que a família é declarada, e não derivada
 *
 * Unidade e sentido não bastam. `pct` com `maior_melhor` inclui margem líquida,
 * crescimento e retenção — e "a margem rendeu menos que o CDI" é o mesmo erro
 * de "a folha rendeu 15%" que o resolver já recusa. Só resultado em reais
 * continua derivado (a regra de antes); as famílias novas são nomeadas por id.
 */

import type { TaxaDeReferencia } from "@/acesso/referencias/sgs";
import type { Sentido, Unidade } from "@/semantica/contrato";

export type Familia =
  | "resultado"
  | "retorno"
  | "custo_de_capital"
  | "liquidez"
  | "alavancagem"
  | "cobertura"
  | "qualidade";

/** As famílias que não saem de unidade + sentido. */
export const FAMILIA: Readonly<Record<string, Familia>> = {
  roe: "retorno",
  roa: "retorno",
  roic: "retorno",
  custo_medio_da_divida: "custo_de_capital",
  custo_liquido_da_divida: "custo_de_capital",
  liquidez_corrente: "liquidez",
  liquidez_seca: "liquidez",
  liquidez_imediata: "liquidez",
  ncg: "liquidez",
  saldo_de_tesouraria: "liquidez",
  divida_liquida_sobre_ebitda: "alavancagem",
  divida_sobre_pl: "alavancagem",
  multiplicador_de_capital: "alavancagem",
  gao: "alavancagem",
  cobertura_de_juros: "cobertura",
  cobertura_do_servico_da_divida: "cobertura",
  lancamentos_para_revisao: "qualidade",
  completude_da_base: "qualidade",
  indicios_de_competencia: "qualidade",
  contas_com_classificacao_inconsistente: "qualidade",
  movimentacao_com_partes_relacionadas: "qualidade",
};

export function familiaDe(
  id: string,
  unidade: Unidade,
  sentido: Sentido,
): Familia | null {
  const declarada = FAMILIA[id];
  if (declarada !== undefined) return declarada;
  // A regra de antes: resultado em reais, e só resultado — não custo.
  if (unidade === "BRL_mi" && sentido === "maior_melhor") return "resultado";
  return null;
}

/**
 * A pergunta seguinte, quando o chat sabe qual é.
 *
 * É a oferta com que o documento de CFO fecha cada resposta ("Quer que eu abra
 * o ROE em três partes?"). Uma métrica do catálogo por oferta, e um teste
 * confere que cada uma é respondível pelo interpretador: a oferta é clicável.
 */
export const PROXIMO_PASSO: Readonly<Record<string, string>> = {
  roe: "Quer ver o ROA, o retorno sobre o ativo, para separar o efeito da alavancagem?",
  roa: "Quer ver o ROIC, o retorno sobre o capital investido?",
  roic: "Quer ver o custo médio da dívida, para comparar com esse retorno?",
  liquidez_corrente: "Quer ver a liquidez seca, sem contar com o estoque?",
  liquidez_seca: "Quer ver o ciclo financeiro?",
  ncg: "Quer ver o ciclo financeiro?",
  divida_liquida_sobre_ebitda: "Quer ver a cobertura de juros?",
  cobertura_de_juros: "Quer ver o custo médio da dívida?",
  custo_medio_da_divida:
    "Quer ver o ROIC, para saber se a dívida está a favor?",
  pmr: "Quer ver em quantos dias pagamos os fornecedores?",
  pmp: "Quer ver o ciclo financeiro?",
  pme: "Quer ver o ciclo financeiro?",
  ciclo_financeiro: "Quer ver a necessidade de capital de giro?",
  ebitda: "Quer ver a conversão de caixa?",
  lucro_liquido: "Quer ver o ROE, o retorno sobre o patrimônio dos sócios?",
  margem_liquida: "Quer ver a margem bruta?",
  margem_bruta: "Quer ver o EBITDA?",
  fluxo_de_caixa_livre: "Quer ver o prazo médio de recebimento?",
};

/* ------------------------------------------------------------------ *
 * As leituras
 * ------------------------------------------------------------------ */

/** Um número calculado contra uma referência, com a fórmula escrita (P3). */
export type Leitura = {
  readonly rotulo: string;
  readonly valor: number;
  readonly unidade: Unidade;
  readonly formula: string;
  /** A taxa usada, ou a derivada dela (CDI líquido de IR), com fonte explícita. */
  readonly referencia: TaxaDeReferencia;
};

/** O que o estágio 2 entrega sobre o custo do dinheiro. */
export type ComparacaoComJuros = {
  readonly familia: Familia;
  readonly leituras: readonly Leitura[];
  /** Só em `resultado`: sobre o que o retorno foi calculado. */
  readonly base: {
    readonly rotulo: string;
    readonly valor: number;
    readonly unidade: Unidade;
  } | null;
};

/** Fração convertida em porcentagem. */
const PERCENTUAL = 100;

/** IR sobre renda fixa acima de 720 dias (Lei 11.033/2004), em %. */
const ALIQUOTA_DE_IR_LONGO_PRAZO = 15;

/** O CDI que sobra depois do imposto: o que um CDB de fato entrega. */
export function cdiLiquidoDeIr(cdi: TaxaDeReferencia): TaxaDeReferencia {
  return {
    ...cdi,
    nome: "CDI líquido de IR",
    valor: (cdi.valor * (PERCENTUAL - ALIQUOTA_DE_IR_LONGO_PRAZO)) / PERCENTUAL,
    fonte: `${cdi.fonte}, líquido de IR de ${String(ALIQUOTA_DE_IR_LONGO_PRAZO)}%`,
  };
}

/**
 * Juro real pela equação de Fisher, em %.
 *
 * É a conta do documento de CFO: Selic de 14,00% com IPCA de 4,44% dá "cerca
 * de 9,1%" — (1,14 ÷ 1,0444) − 1. Por subtração daria 9,56%, e a diferença
 * aparece na tela.
 */
export function ganhoReal(nominal: number, inflacao: number): number {
  return ((PERCENTUAL + nominal) / (PERCENTUAL + inflacao) - 1) * PERCENTUAL;
}

function acharTaxa(
  referencias: readonly TaxaDeReferencia[],
  id: TaxaDeReferencia["id"],
): TaxaDeReferencia | undefined {
  return referencias.find((r) => r.id === id);
}

/** Retorno em % (ROE, ROA, ROIC) contra o CDI e o IPCA. */
export function leiturasDeRetorno(
  metrica: string,
  rotulo: string,
  valor: number,
  referencias: readonly TaxaDeReferencia[],
): readonly Leitura[] {
  const cdi = acharTaxa(referencias, "cdi");
  const ipca = acharTaxa(referencias, "ipca_12m");
  const leituras: Leitura[] = [];

  if (cdi !== undefined) {
    leituras.push({
      rotulo: "Diferença para o CDI",
      valor: valor - cdi.valor,
      unidade: "pp",
      formula: `${rotulo} − CDI`,
      referencia: cdi,
    });
  }
  if (ipca !== undefined) {
    leituras.push({
      rotulo: "Ganho real sobre o IPCA",
      valor: ganhoReal(valor, ipca.valor),
      unidade: "pct",
      formula: `(1 + ${rotulo}) ÷ (1 + IPCA 12 meses) − 1`,
      referencia: ipca,
    });
  }
  // O ROIC se compara com o que a aplicação entrega de fato: o CDI depois do IR.
  if (metrica === "roic" && cdi !== undefined) {
    const liquido = cdiLiquidoDeIr(cdi);
    leituras.push({
      rotulo: "Diferença para o CDI líquido de IR",
      valor: valor - liquido.valor,
      unidade: "pp",
      formula: `${rotulo} − CDI × (1 − IR de ${String(ALIQUOTA_DE_IR_LONGO_PRAZO)}%)`,
      referencia: liquido,
    });
  }
  return leituras;
}

/** Custo de capital em % (custo médio da dívida) contra o CDI. */
export function leiturasDeCusto(
  rotulo: string,
  valor: number,
  referencias: readonly TaxaDeReferencia[],
): readonly Leitura[] {
  const cdi = acharTaxa(referencias, "cdi");
  if (cdi === undefined) return [];
  return [
    {
      rotulo: "Spread sobre o CDI",
      valor: valor - cdi.valor,
      unidade: "pp",
      formula: `${rotulo} − CDI`,
      referencia: cdi,
    },
  ];
}

/**
 * Resultado em reais contra a Selic: o retorno sobre a receita do recorte.
 *
 * Um lucro em reais e uma taxa em % ao ano não se comparam direto. O que se
 * compara é o **retorno** sobre a base que o gerou — receita líquida de
 * R$ 1.200 mi e lucro de -R$ 8 mi dão -0,7%, e a Selic a 14% diz o resto.
 */
export function leiturasDeResultado(
  valor: number,
  receita: number,
  referencias: readonly TaxaDeReferencia[],
): readonly Leitura[] {
  const selic = acharTaxa(referencias, "selic");
  if (selic === undefined) return [];
  const retorno = (valor / receita) * PERCENTUAL;
  return [
    {
      rotulo: "Retorno sobre a receita líquida",
      valor: retorno,
      unidade: "pct",
      formula: "resultado ÷ receita líquida do mesmo recorte",
      referencia: selic,
    },
    {
      rotulo: "Diferença para a Selic",
      valor: retorno - selic.valor,
      unidade: "pp",
      formula: "retorno sobre a receita − Meta Selic",
      referencia: selic,
    },
  ];
}
