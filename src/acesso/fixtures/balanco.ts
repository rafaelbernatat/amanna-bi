/**
 * O balanço patrimonial mensal, `vw_fato_balanco_mes` (perguntas de CFO).
 *
 * ROE, ROA, ROIC, liquidez corrente, necessidade de capital de giro, dívida
 * líquida: nenhuma sai da DRE nem do caixa sozinhos — todas precisam de um
 * saldo patrimonial. O protótipo não tinha balanço. Esta view o constrói
 * **a partir do que já existe**, para reconciliar por construção:
 *
 * - o caixa é o `saldoDeCaixa` de `vw_fato_fin_mes`; o estoque também;
 * - a receber e a pagar vêm de `vw_fato_contas`, com os vencidos por faixa;
 * - o imobilizado abre em 760 e anda com capex menos depreciação da DRE,
 *   fechando em 840 (= 760 + 140 − 60);
 * - o patrimônio abre em 368 e anda com o lucro de cada mês menos a
 *   distribuição aos sócios, fechando em 350 (= 368 − 8 − 10);
 * - a dívida vem de `vw_fato_divida_mes`, por prazo;
 * - o ativo total é a identidade contábil: passivo circulante + dívida de
 *   longo prazo + patrimônio. O que sobra entre ele e a soma de circulante e
 *   imobilizado são os outros ativos não circulantes, e um teste fixa que
 *   nunca ficam negativos.
 *
 * O que não se guarda: nenhuma taxa, nenhum múltiplo. Liquidez, ROE e NCG
 * são calculados sob recorte, no `CALCULO` — guardar a razão pronta é o
 * achado 5 do Anexo D.
 *
 * ## Os números de dezembro (R$ mi)
 *
 * Ativo circulante 450 (caixa 100 + a receber 171 + estoque 148 + outros 31);
 * passivo circulante 461 (a pagar 101 + dívida de curto prazo 300 +
 * acréscimos 60); imobilizado 840 e outros ativos não circulantes 121, que
 * fecham o ativo total em 1.411; patrimônio 350; dívida bruta 900;
 * aplicações 60 dentro do caixa. Daí liquidez corrente de 0,98, dívida
 * líquida de 4,0 vezes o EBITDA e ROE de −2,3%: a empresa que cresce em
 * receita e perde no resultado, com pressão de capital — a narrativa do
 * Anexo C, agora com balanço.
 *
 * Dado fictício sob D-H03 (modo mockup); quando o banco real chegar, esta view
 * sai da contabilidade do cliente (seção 10.1).
 */

import { FLUXOS_DA_DIVIDA, VW_FATO_DIVIDA_MES } from "@/acesso/fixtures/divida";
import { ENTIDADES_ARMAZENADAS, mesesDe } from "@/acesso/fixtures/eixos";
import {
  VW_FATO_CONTAS,
  VW_FATO_FIN_MES,
  emReais,
  porEntidade,
  saldoDoMes,
} from "@/acesso/fixtures/fin";
import { ANO_DA_FIXTURE } from "@/acesso/fixtures/rh";

const MESES = mesesDe(ANO_DA_FIXTURE);
const POR_MIL = 1000;

/** Os saldos de abertura e as âncoras, em R$ mi. */
export const PATRIMONIO_DE_ABERTURA = 368;
export const IMOBILIZADO_DE_ABERTURA = 760;
export const DISTRIBUICAO_ANUAL = 10;
/** A distribuição aos sócios acontece de uma vez, em abril. */
const MES_DA_DISTRIBUICAO = 3;
/** Outros ativos circulantes (adiantamentos, impostos a recuperar), dezembro. */
const OUTROS_CIRCULANTES_DEZEMBRO = 31;
/** Salários, encargos e impostos a pagar, dezembro. */
const ACRESCIMOS_DEZEMBRO = 60;
/** Mútuo com sócios, saldo constante — a pergunta D8. */
const MUTUO_COM_SOCIOS = 25;
/** A parte do caixa que está aplicada, em milésimos. */
const APLICADO_POR_MIL = 600;
/** A parte do estoque sem movimentação há mais de 90 dias, em milésimos. */
const SEM_GIRO_POR_MIL = 180;

export type LinhaBalancoMes = {
  readonly mes: string;
  readonly entidade: string;
  /** Saldos no fechamento do mês, em reais. */
  readonly patrimonioLiquido: number;
  readonly ativoTotal: number;
  readonly ativoCirculante: number;
  readonly passivoCirculante: number;
  readonly imobilizado: number;
  /** A parte do caixa que está aplicada: entra no capital investido pelo sinal negativo. */
  readonly aplicacoesFinanceiras: number;
  readonly dividaCurtoPrazo: number;
  readonly dividaLongoPrazo: number;
  readonly estoqueSemGiro: number;
  readonly aReceberVencido: number;
  readonly aPagarVencido: number;
  readonly mutuoComSocios: number;
  /** Fluxos do mês, em reais. */
  readonly jurosPagos: number;
  readonly impostosSobreLucro: number;
  readonly amortizacaoDeDivida: number;
  readonly captacao: number;
  readonly distribuicaoASocios: number;
};

/** A receita líquida consolidada de cada mês, em reais: a forma dos saldos. */
const RECEITA_MENSAL: readonly number[] = MESES.map((mes) =>
  VW_FATO_FIN_MES.filter((l) => l.mes === mes).reduce(
    (acc, l) => acc + l.receitaLiquida,
    0,
  ),
);

const FAIXA_A_VENCER = "a-vencer";

function contasDoMes(mes: string, entidade: string) {
  const linhas = VW_FATO_CONTAS.filter(
    (l) => l.mes === mes && l.entidade === entidade,
  );
  const somar = (
    escolha: (l: (typeof VW_FATO_CONTAS)[number]) => boolean,
    medida: (l: (typeof VW_FATO_CONTAS)[number]) => number,
  ) => linhas.filter(escolha).reduce((acc, l) => acc + medida(l), 0);
  return {
    aReceber: somar(
      () => true,
      (l) => l.aReceber,
    ),
    aPagar: somar(
      () => true,
      (l) => l.aPagar,
    ),
    aReceberVencido: somar(
      (l) => l.faixaDeAging !== FAIXA_A_VENCER,
      (l) => l.aReceber,
    ),
    aPagarVencido: somar(
      (l) => l.faixaDeAging !== FAIXA_A_VENCER,
      (l) => l.aPagar,
    ),
  };
}

function dividaDoMes(mes: string, entidade: string) {
  const linhas = VW_FATO_DIVIDA_MES.filter(
    (l) => l.mes === mes && l.entidade === entidade,
  );
  const somar = (prazo: "curto" | "longo") =>
    linhas
      .filter((l) => l.prazo === prazo)
      .reduce((acc, l) => acc + l.saldo, 0);
  const fluxo = FLUXOS_DA_DIVIDA.find(
    (f) => f.mes === mes && f.entidade === entidade,
  );
  return {
    curto: somar("curto"),
    longo: somar("longo"),
    amortizacao: fluxo?.amortizacao ?? 0,
    captacao: fluxo?.captacao ?? 0,
  };
}

export const VW_FATO_BALANCO_MES: readonly LinhaBalancoMes[] = (() => {
  const patrimonio = [
    ...porEntidade(emReais(PATRIMONIO_DE_ABERTURA), "balanco"),
  ];
  const imobilizado = [
    ...porEntidade(emReais(IMOBILIZADO_DE_ABERTURA), "balanco"),
  ];
  const mutuo = porEntidade(emReais(MUTUO_COM_SOCIOS), "balanco");
  const saida: LinhaBalancoMes[] = [];

  MESES.forEach((mes, m) => {
    const outrosCirculantes = porEntidade(
      saldoDoMes(emReais(OUTROS_CIRCULANTES_DEZEMBRO), RECEITA_MENSAL, m),
      "balanco",
    );
    const acrescimos = porEntidade(
      saldoDoMes(emReais(ACRESCIMOS_DEZEMBRO), RECEITA_MENSAL, m),
      "balanco",
    );
    const distribuicao = porEntidade(
      m === MES_DA_DISTRIBUICAO ? emReais(DISTRIBUICAO_ANUAL) : 0,
      "balanco",
    );

    ENTIDADES_ARMAZENADAS.forEach((entidade, e) => {
      const dre = VW_FATO_FIN_MES.find(
        (l) => l.mes === mes && l.entidade === entidade,
      );
      if (dre === undefined) return;

      const lucro =
        dre.receitaLiquida -
        dre.cmv -
        dre.despesasOperacionais -
        dre.depreciacaoEAmortizacao -
        dre.resultadoFinanceiro -
        dre.naoOperacional;
      patrimonio[e] = (patrimonio[e] ?? 0) + lucro - (distribuicao[e] ?? 0);
      imobilizado[e] =
        (imobilizado[e] ?? 0) + dre.capex - dre.depreciacaoEAmortizacao;

      const contas = contasDoMes(mes, entidade);
      const divida = dividaDoMes(mes, entidade);

      const ativoCirculante =
        dre.saldoDeCaixa +
        contas.aReceber +
        dre.estoque +
        (outrosCirculantes[e] ?? 0);
      const passivoCirculante =
        contas.aPagar + divida.curto + (acrescimos[e] ?? 0);
      const patrimonioLiquido = patrimonio[e] ?? 0;

      saida.push({
        mes,
        entidade,
        patrimonioLiquido,
        // A identidade contábil: o que sobra além do circulante e do
        // imobilizado são os outros ativos não circulantes.
        ativoTotal: passivoCirculante + divida.longo + patrimonioLiquido,
        ativoCirculante,
        passivoCirculante,
        imobilizado: imobilizado[e] ?? 0,
        aplicacoesFinanceiras: Math.round(
          (dre.saldoDeCaixa * APLICADO_POR_MIL) / POR_MIL,
        ),
        dividaCurtoPrazo: divida.curto,
        dividaLongoPrazo: divida.longo,
        estoqueSemGiro: Math.round((dre.estoque * SEM_GIRO_POR_MIL) / POR_MIL),
        aReceberVencido: contas.aReceberVencido,
        aPagarVencido: contas.aPagarVencido,
        mutuoComSocios: mutuo[e] ?? 0,
        jurosPagos: dre.resultadoFinanceiro,
        impostosSobreLucro: dre.naoOperacional,
        amortizacaoDeDivida: divida.amortizacao,
        captacao: divida.captacao,
        distribuicaoASocios: distribuicao[e] ?? 0,
      });
    });
  });
  return saida;
})();
