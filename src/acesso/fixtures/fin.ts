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
import { ENTIDADES_ARMAZENADAS, mesesDe } from "@/acesso/calculo/eixos";
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
import type {
  Completa,
  LinhaFinMes,
  LinhaOrcamento,
  LinhaContas,
  LinhaSaidaCategoria,
  LinhaFaturamentoCliente,
} from "@/acesso/calculo/linhas";

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

export type { LinhaFinMes } from "@/acesso/calculo/linhas";

export const VW_FATO_FIN_MES: readonly Completa<LinhaFinMes>[] = (() => {
  const saldoInicial = porEntidade(
    emReais(PONTE_DO_CAIXA.saldoInicial),
    "caixa",
  );
  const corrente = [...saldoInicial];
  const saida: Completa<LinhaFinMes>[] = [];

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

export type { LinhaOrcamento } from "@/acesso/calculo/linhas";

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

export type { LinhaContas } from "@/acesso/calculo/linhas";

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

export type { LinhaSaidaCategoria } from "@/acesso/calculo/linhas";

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

export type { LinhaFaturamentoCliente } from "@/acesso/calculo/linhas";

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
        // A fixture só carrega os dez maiores: todos são principais.
        principal: true,
        receita: receita[e] ?? 0,
        margemBase: Math.round(
          ((receita[e] ?? 0) * cliente.margem) / BASE_DA_MARGEM,
        ),
      }));
    }),
  );
