/**
 * As três views de fato de Financeiro, no grão da seção 10.1 (T-111).
 *
 * | View | Grão | Medidas |
 * |---|---|---|
 * | `vw_fato_fin_mes` | mês × entidade | receita bruta e líquida, CMV, despesas, D&A, resultado financeiro, FCO, capex, saldo de caixa |
 * | `vw_fato_orcamento` | mês × entidade × centro de custo | orçado, realizado |
 * | `vw_fato_contas` | mês × entidade × faixa de aging | a receber, a pagar |
 *
 * ## Sem área, e isso é decisão
 *
 * A seção 10.1 dá a `vw_fato_fin_mes` o grão **mês × entidade** — sem área. Não
 * é esquecimento do PRD: receita e resultado financeiro não têm área de origem,
 * e ratear os dois por quadro produziria um número que parece recorte e é
 * arbitragem. O que tem centro de custo é o orçamento, e centro de custo é uma
 * dimensão própria — ver `CENTROS_DE_CUSTO`, que tem oito valores contra sete
 * áreas.
 *
 * O que isso significa na tela: filtrar por Área numa tela de Financeiro não é
 * "todas as áreas somadas", é **"este filtro não se aplica a este painel"** —
 * e é exatamente o que T-162 vai implementar. A semântica final está em H-04,
 * com T-144.
 *
 * ## Nenhum percentual e nenhum prazo estão armazenados
 *
 * Margem bruta, margem EBITDA, margem líquida, PMR, PME, PMP e ciclo saem todos
 * de componentes. O protótipo guarda `mLiq` como série pronta e ela **não soma
 * o lucro do ano** — dá -R$ 4,3 mi contra os -R$ 8 mi da ponte da DRE. Uma taxa
 * guardada pronta é uma taxa que ninguém consegue recalcular, e é a receita do
 * achado 5 do Anexo D.
 *
 * ## Tudo em reais inteiros
 *
 * As séries do protótipo estão em R$ mi; aqui viram reais. Inteiro é o que faz
 * a soma das partes ser exatamente o todo — e `BRL_mi` é unidade de
 * apresentação, que pela regra 2 do contrato só aparece na formatação.
 */

import {
  CLIENTES_A_RECEBER,
  FORNECEDORES_A_PAGAR,
  NATUREZAS_DE_SAIDA,
} from "@/acesso/fixtures/contraparte";
import { fatiaDaEntidade } from "@/acesso/fixtures/entidade";
import { ENTIDADES_ARMAZENADAS, mesesDe } from "@/acesso/fixtures/eixos";
import {
  CENTROS_DE_CUSTO,
  EBITDA_MENSAL,
  ENTRADAS_MENSAL,
  ESTOQUE_DEZEMBRO,
  FAIXAS_DE_AGING,
  FCO_MENSAL,
  MARGEM_BRUTA_MENSAL,
  ORCADO_MENSAL,
  PONTE_DA_DRE,
  PONTE_DO_CAIXA,
  REALIZADO_MENSAL,
  RECEITA_LIQUIDA_ANO_ANTERIOR,
  RECEITA_LIQUIDA_MENSAL,
  SAIDAS_MENSAL,
} from "@/acesso/fixtures/referencia-fin";
import {
  NOTAS_EMITIDAS,
  TOP_CLIENTES,
} from "@/acesso/fixtures/referencia-perfil";
import { repartir, repartirMatriz } from "@/acesso/fixtures/reparticao";
import { ANO_DA_FIXTURE } from "@/acesso/fixtures/rh";

const MESES = mesesDe(ANO_DA_FIXTURE);
const UM_MILHAO = 1_000_000;
const CEM_PORCENTO = 100;

/** R$ mi da referência para reais inteiros. */
export function emReais(milhoes: number): number {
  return Math.round(milhoes * UM_MILHAO);
}

/**
 * Divide um valor entre as duas entidades, na ordem do vocabulário.
 *
 * A primeira leva o arredondamento da fatia; a segunda leva o resto. Assim a
 * soma das duas é **exatamente** o valor de entrada, e não a soma de dois
 * arredondamentos independentes.
 *
 * Exportada para as views derivadas — balanço e dívida — repartirem do mesmo
 * jeito, e não de um jeito parecido.
 */
export function porEntidade(valor: number, medida: string): readonly number[] {
  const primeira = ENTIDADES_ARMAZENADAS[0] ?? "";
  const naPrimeira = Math.round(valor * fatiaDaEntidade(primeira, medida));
  return [naPrimeira, valor - naPrimeira];
}

/* ------------------------------------------------------------------ *
 * O resultado, mês a mês
 * ------------------------------------------------------------------ */

const RECEITA_LIQUIDA = RECEITA_LIQUIDA_MENSAL.map(emReais);

/**
 * O CMV mensal, obtido da margem bruta e depois ajustado ao total do ano.
 *
 * A margem bruta do protótipo dá a **forma** — o CMV do mês é a receita menos o
 * lucro bruto daquele mês. A soma dessas doze parcelas fica perto de 720, mas
 * não em cima; `repartir` usa a forma como peso e entrega o total exato, que é
 * o que a ponte da DRE precisa para fechar.
 */
const CMV = repartir(
  emReais(PONTE_DA_DRE.cmv),
  RECEITA_LIQUIDA_MENSAL.map(
    (r, m) => r * (1 - (MARGEM_BRUTA_MENSAL[m] ?? 0) / CEM_PORCENTO),
  ),
);

/** Deduções: da receita bruta para a líquida. */
const DEDUCOES = repartir(
  emReais(PONTE_DA_DRE.deducoes),
  RECEITA_LIQUIDA_MENSAL,
);

/**
 * Despesas operacionais — **derivadas**, não repartidas.
 *
 * `despesas = receita líquida - CMV - EBITDA`. Como as três somam os valores da
 * ponte, a soma das despesas dá 280 sozinha. Repartir 280 por um peso qualquer
 * daria o mesmo total e um EBITDA mensal diferente do que o protótipo mostra —
 * e o EBITDA mensal é um painel (`fin-ebitda`).
 */
const EBITDA = EBITDA_MENSAL.map(emReais);
const DESPESAS = MESES.map(
  (_, m) => (RECEITA_LIQUIDA[m] ?? 0) - (CMV[m] ?? 0) - (EBITDA[m] ?? 0),
);

/** D&A, resultado financeiro e não operacional, repartidos pela receita. */
const DEPRECIACAO = repartir(
  emReais(PONTE_DA_DRE.depreciacaoEAmortizacao),
  RECEITA_LIQUIDA_MENSAL,
);
const RESULTADO_FINANCEIRO = repartir(
  emReais(PONTE_DA_DRE.resultadoFinanceiro),
  RECEITA_LIQUIDA_MENSAL,
);
const NAO_OPERACIONAL = repartir(
  emReais(PONTE_DA_DRE.naoOperacional),
  RECEITA_LIQUIDA_MENSAL,
);

/* ------------------------------------------------------------------ *
 * O caixa
 * ------------------------------------------------------------------ */

const FCO = repartir(emReais(PONTE_DO_CAIXA.fco), FCO_MENSAL);
const CAPEX = repartir(
  emReais(Math.abs(PONTE_DO_CAIXA.fci)),
  RECEITA_LIQUIDA_MENSAL,
);
const FINANCIAMENTO = repartir(
  emReais(Math.abs(PONTE_DO_CAIXA.fcf)),
  RECEITA_LIQUIDA_MENSAL,
);
const ENTRADAS = ENTRADAS_MENSAL.map(emReais);
const SAIDAS = SAIDAS_MENSAL.map(emReais);

/**
 * Notas emitidas por mês.
 *
 * Repartidas pela receita, mas **não proporcionais a ela**: o peso leva a raiz
 * da receita, o que faz o ticket médio subir em mês forte. Nota proporcional à
 * receita daria ticket constante, e o KPI voltaria a ignorar o recorte.
 */
const NOTAS = repartir(
  NOTAS_EMITIDAS,
  RECEITA_LIQUIDA_MENSAL.map((r) => Math.sqrt(r)),
);

/** Estoque mensal: acompanha o CMV, e dezembro reproduz o valor derivado do PME. */
const ESTOQUE = MESES.map((_, m) =>
  Math.round(emReais(ESTOQUE_DEZEMBRO) * ((CMV[m] ?? 0) / (CMV.at(-1) ?? 1))),
);

/* ------------------------------------------------------------------ *
 * vw_fato_fin_mes
 * ------------------------------------------------------------------ */

export type LinhaFinMes = {
  readonly mes: string;
  readonly entidade: string;
  /** Todos os valores em reais. `BRL_mi` é unidade de apresentação. */
  readonly receitaBruta: number;
  readonly deducoes: number;
  readonly receitaLiquida: number;
  readonly cmv: number;
  readonly despesasOperacionais: number;
  readonly depreciacaoEAmortizacao: number;
  /** Positivo é despesa: entra na ponte como dedução. */
  readonly resultadoFinanceiro: number;
  readonly naoOperacional: number;
  readonly fco: number;
  /** Investimento do mês. Positivo é saída de caixa. */
  readonly capex: number;
  /** Financiamento líquido. Positivo é saída de caixa. */
  readonly financiamento: number;
  readonly entradasDeCaixa: number;
  readonly saidasDeCaixa: number;
  /** Estoque no fechamento. Denominador do PME. */
  readonly estoque: number;
  /**
   * Receita líquida do mesmo mês do ano anterior (T-116).
   *
   * É a série de comparação, e **não** um recorte de 2025 — a distinção é o
   * achado 6 do Anexo D, que aponta que o protótipo tem `receitaLY` e não tem
   * ano. Serve ao KPI de crescimento enquanto 2025 não entra na fixture com
   * T-152; quando entrar, quem decide se esta coluna some é T-185.
   *
   * Somar 1.068 mi no ano é o que faz `1.200 / 1.068 - 1` dar os +12,4% do
   * Anexo C.
   */
  readonly receitaLiquidaAnoAnterior: number;
  /**
   * Notas fiscais emitidas no mês (T-143).
   *
   * O ticket médio é `receita_liquida / notas_emitidas`. Sem esta coluna ele
   * seria os R$ 65,2 mil cravados do protótipo, iguais em todo recorte — o
   * achado 5. Com ela, o ticket de um mês difere do ticket do ano.
   */
  readonly notasEmitidas: number;
  /** Saldo no fechamento do mês: o inicial mais o acumulado de entradas e saídas. */
  readonly saldoDeCaixa: number;
};

export const VW_FATO_FIN_MES: readonly LinhaFinMes[] = (() => {
  const saldoInicial = porEntidade(
    emReais(PONTE_DO_CAIXA.saldoInicial),
    "caixa",
  );
  const corrente = [...saldoInicial];
  const saida: LinhaFinMes[] = [];

  MESES.forEach((mes, m) => {
    const receita = porEntidade(RECEITA_LIQUIDA[m] ?? 0, "receita");
    const deducoes = porEntidade(DEDUCOES[m] ?? 0, "receita");
    const cmv = porEntidade(CMV[m] ?? 0, "cmv");
    const despesas = porEntidade(DESPESAS[m] ?? 0, "despesas");
    const da = porEntidade(DEPRECIACAO[m] ?? 0, "despesas");
    const financeiro = porEntidade(RESULTADO_FINANCEIRO[m] ?? 0, "despesas");
    const naoOperacional = porEntidade(NAO_OPERACIONAL[m] ?? 0, "despesas");
    const fco = porEntidade(FCO[m] ?? 0, "caixa");
    const capex = porEntidade(CAPEX[m] ?? 0, "caixa");
    const financiamento = porEntidade(FINANCIAMENTO[m] ?? 0, "caixa");
    const entradas = porEntidade(ENTRADAS[m] ?? 0, "caixa");
    const saidas = porEntidade(SAIDAS[m] ?? 0, "caixa");
    const estoque = porEntidade(ESTOQUE[m] ?? 0, "cmv");
    const notas = porEntidade(NOTAS[m] ?? 0, "receita");
    const receitaAnterior = porEntidade(
      emReais(RECEITA_LIQUIDA_ANO_ANTERIOR[m] ?? 0),
      "receita",
    );

    ENTIDADES_ARMAZENADAS.forEach((entidade, e) => {
      corrente[e] = (corrente[e] ?? 0) + (entradas[e] ?? 0) - (saidas[e] ?? 0);
      saida.push({
        mes,
        entidade,
        receitaBruta: (receita[e] ?? 0) + (deducoes[e] ?? 0),
        deducoes: deducoes[e] ?? 0,
        receitaLiquida: receita[e] ?? 0,
        cmv: cmv[e] ?? 0,
        despesasOperacionais: despesas[e] ?? 0,
        depreciacaoEAmortizacao: da[e] ?? 0,
        resultadoFinanceiro: financeiro[e] ?? 0,
        naoOperacional: naoOperacional[e] ?? 0,
        fco: fco[e] ?? 0,
        capex: capex[e] ?? 0,
        financiamento: financiamento[e] ?? 0,
        entradasDeCaixa: entradas[e] ?? 0,
        saidasDeCaixa: saidas[e] ?? 0,
        estoque: estoque[e] ?? 0,
        notasEmitidas: notas[e] ?? 0,
        receitaLiquidaAnoAnterior: receitaAnterior[e] ?? 0,
        saldoDeCaixa: corrente[e] ?? 0,
      });
    });
  });
  return saida;
})();

/* ------------------------------------------------------------------ *
 * vw_fato_orcamento
 * ------------------------------------------------------------------ */

/** Reparte um total anual por mês e por centro de custo, margens exatas. */
function porMesECentro(
  totalPorMes: readonly number[],
  pesoPorCentro: readonly number[],
): readonly (readonly number[])[] {
  const total = totalPorMes.reduce((a, b) => a + b, 0);
  return repartirMatriz(totalPorMes, repartir(total, pesoPorCentro));
}

const ORCADO = porMesECentro(
  ORCADO_MENSAL.map(emReais),
  CENTROS_DE_CUSTO.map((c) => c.orcado),
);
const REALIZADO = porMesECentro(
  REALIZADO_MENSAL.map(emReais),
  CENTROS_DE_CUSTO.map((c) => c.realizado),
);

export type LinhaOrcamento = {
  readonly mes: string;
  readonly entidade: string;
  readonly centroDeCusto: string;
  readonly orcado: number;
  readonly realizado: number;
};

export const VW_FATO_ORCAMENTO: readonly LinhaOrcamento[] = MESES.flatMap(
  (mes, m) =>
    CENTROS_DE_CUSTO.flatMap((centro, c) => {
      const orcado = porEntidade(ORCADO[m]?.[c] ?? 0, "orcamento");
      const realizado = porEntidade(REALIZADO[m]?.[c] ?? 0, "orcamento");
      return ENTIDADES_ARMAZENADAS.map((entidade, e) => ({
        mes,
        entidade,
        centroDeCusto: centro.codigo,
        orcado: orcado[e] ?? 0,
        realizado: realizado[e] ?? 0,
      }));
    }),
);

/* ------------------------------------------------------------------ *
 * vw_fato_contas
 * ------------------------------------------------------------------ */

/**
 * O saldo a receber acompanha a receita; o a pagar acompanha o CMV.
 *
 * Dezembro reproduz exatamente os saldos do protótipo — R$ 171 mi a receber e
 * R$ 101 mi a pagar — e os demais meses variam com o volume do mês. Sem essa
 * variação o PMR seria o mesmo em todos os meses, e o painel de ciclo mostraria
 * uma reta que não existe em empresa nenhuma.
 */
export function saldoDoMes(
  totalDeDezembro: number,
  serie: readonly number[],
  m: number,
): number {
  const dezembro = serie.at(-1) ?? 1;
  return Math.round(totalDeDezembro * ((serie[m] ?? 0) / dezembro));
}

export type LinhaContas = {
  readonly mes: string;
  readonly entidade: string;
  readonly faixaDeAging: string;
  /**
   * Quem deve ou a quem se deve (T-118.1).
   *
   * Uma linha é de um cliente **ou** de um fornecedor, nunca dos dois: a
   * contraparte de quem se recebe não é a mesma de quem se paga. Por isso a
   * linha de cliente tem `aPagar` zero e a de fornecedor tem `aReceber` zero —
   * zero de verdade, e não ausência: não há saldo a pagar com um cliente.
   */
  readonly contraparte: string;
  readonly aReceber: number;
  readonly aPagar: number;
};

/**
 * Reparte um saldo entre contrapartes, com a soma exata.
 *
 * Sem repartição exata o painel mostraria uma carteira diferente da que o
 * cartão de inadimplência calcula — dois números para a mesma dívida.
 */
function porContraparte(
  saldo: number,
  lista: readonly { readonly codigo: string; readonly peso: number }[],
): readonly number[] {
  return repartir(
    saldo,
    lista.map((c) => c.peso),
  );
}

export const VW_FATO_CONTAS: readonly LinhaContas[] = MESES.flatMap((mes, m) =>
  FAIXAS_DE_AGING.flatMap((faixa) => {
    const receber = porEntidade(
      saldoDoMes(emReais(faixa.aReceber), RECEITA_LIQUIDA, m),
      "contas",
    );
    const pagar = porEntidade(
      saldoDoMes(emReais(faixa.aPagar), CMV, m),
      "contas",
    );
    return ENTIDADES_ARMAZENADAS.flatMap((entidade, e) => {
      const doCliente = porContraparte(receber[e] ?? 0, CLIENTES_A_RECEBER);
      const doFornecedor = porContraparte(pagar[e] ?? 0, FORNECEDORES_A_PAGAR);
      return [
        ...CLIENTES_A_RECEBER.map((c, i) => ({
          mes,
          entidade,
          faixaDeAging: faixa.codigo,
          contraparte: c.codigo,
          aReceber: doCliente[i] ?? 0,
          aPagar: 0,
        })),
        ...FORNECEDORES_A_PAGAR.map((c, i) => ({
          mes,
          entidade,
          faixaDeAging: faixa.codigo,
          contraparte: c.codigo,
          aReceber: 0,
          aPagar: doFornecedor[i] ?? 0,
        })),
      ];
    });
  }),
);

/* ------------------------------------------------------------------ *
 * vw_fato_saida_categoria
 * ------------------------------------------------------------------ */

export type LinhaSaidaCategoria = {
  readonly mes: string;
  readonly entidade: string;
  readonly categoria: string;
  /** Desembolso do mês naquela natureza, em reais. */
  readonly valor: number;
};

/**
 * A saída de caixa aberta por natureza.
 *
 * A soma das naturezas de um mês é **exatamente** a coluna `saidasDeCaixa` de
 * `vw_fato_fin_mes`. Não é uma segunda contabilidade: é a mesma saída, dita com
 * mais detalhe. O mapeamento conta a conta é H-56.
 */
export const VW_FATO_SAIDA_CATEGORIA: readonly LinhaSaidaCategoria[] =
  VW_FATO_FIN_MES.flatMap((linha) => {
    const partes = repartir(
      linha.saidasDeCaixa,
      NATUREZAS_DE_SAIDA.map((n) => n.peso),
    );
    /*
     * Percorre as partes, e não os índices delas.
     *
     * `partes[i] ?? 0` transformaria natureza sem parcela em "desembolso zero",
     * que é afirmação sobre o negócio e não sobre a estrutura de dados — e a
     * regra de T-141 reprova, com razão. Iterando o vetor, o valor existe por
     * construção.
     */
    return partes.map((valor, i) => ({
      mes: linha.mes,
      entidade: linha.entidade,
      categoria: NATUREZAS_DE_SAIDA[i]?.codigo ?? "",
      valor,
    }));
  });

/* ------------------------------------------------------------------ *
 * vw_fato_faturamento_cliente
 * ------------------------------------------------------------------ */

/**
 * Receita e margem dos dez maiores clientes (T-143).
 *
 * A concentração top 10 é `soma(receita destes) / receita_liquida`, e dá os
 * 54,3% que o protótipo mostra. Guardar 54,3% pronto seria o achado 5: um
 * número que não muda quando o recorte muda.
 *
 * Cliente é pessoa jurídica e vem anonimizado desde o protótipo (`c1`..`c10`).
 * A seção 11 fala de dado de **pessoa**, e nada aqui desce a esse grão.
 */
export type LinhaFaturamentoCliente = {
  readonly mes: string;
  readonly entidade: string;
  readonly cliente: string;
  /**
   * Faixa de rating interno do cliente (T-117.2).
   *
   * Qualificação do cliente, e não fato novo — por isso entra como chave aqui
   * em vez de virar view própria. Quem preenche esta coluna com dado real, e
   * com que critério, é **H-53**: pode vir do cadastro do ERP, de análise de
   * crédito própria ou de birô externo, e as três dão escalas diferentes.
   */
  readonly rating: string;
  /**
   * Segmento comercial do cliente (T-118.1).
   *
   * Mesma natureza do rating: qualificação de quem já está na view, e não fato
   * novo. Quem classifica e com que critério é **H-57**.
   */
  readonly segmento: string;
  /** Receita do mês, em reais. */
  readonly receita: number;
  /** Margem de contribuição em pontos-base, para somar sem perder casa. */
  readonly margemBase: number;
};

const BASE_DA_MARGEM = 100;

const RECEITA_POR_CLIENTE = repartirMatriz(
  RECEITA_LIQUIDA_MENSAL.map(emReais),
  repartir(
    emReais(TOP_CLIENTES.reduce((a, c) => a + c.receita, 0)),
    TOP_CLIENTES.map((c) => c.receita),
  ).concat(
    // A parcela que não é dos dez maiores fecha a receita do mês. Sem ela, a
    // soma das colunas não daria a receita e a matriz não teria como fechar.
    emReais(
      RECEITA_LIQUIDA_MENSAL.reduce((a, b) => a + b, 0) -
        TOP_CLIENTES.reduce((a, c) => a + c.receita, 0),
    ),
  ),
);

export const VW_FATO_FATURAMENTO_CLIENTE: readonly LinhaFaturamentoCliente[] =
  MESES.flatMap((mes, m) =>
    TOP_CLIENTES.flatMap((cliente, c) => {
      const receita = porEntidade(RECEITA_POR_CLIENTE[m]?.[c] ?? 0, "receita");
      return ENTIDADES_ARMAZENADAS.map((entidade, e) => ({
        mes,
        entidade,
        cliente: cliente.codigo,
        rating: cliente.rating,
        segmento: cliente.segmento,
        receita: receita[e] ?? 0,
        margemBase: Math.round(
          ((receita[e] ?? 0) * cliente.margem) / BASE_DA_MARGEM,
        ),
      }));
    }),
  );
