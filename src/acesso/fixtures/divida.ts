/**
 * A dívida por linha de crédito, `vw_fato_divida_mes` (perguntas de CFO, D1–D4).
 *
 * "Quanto estamos pagando de juros e isso está caro?" só se responde abrindo
 * a dívida por linha: capital de giro, financiamento de longo prazo e
 * antecipação de recebíveis pagam taxas diferentes, e a linha mais cara é a
 * que se troca primeiro. O protótipo não tinha dívida nenhuma — só o resultado
 * financeiro de R$ 140 mi na ponte da DRE. Esta view é **derivada dele**: os
 * juros de cada mês são o resultado financeiro daquele mês, repartido pelas
 * linhas; a soma das linhas é a ponte, por construção.
 *
 * ## A narrativa
 *
 * Dívida bruta de R$ 900 mi em dezembro (curto prazo 300, longo 600) contra
 * EBITDA de 200 e caixa de 100: dívida líquida de 4,0 vezes o EBITDA, e juros
 * iguais ao EBIT — cobertura de 1,0 vez, que é o que o cartão de lucro líquido
 * já dizia ("juros consomem todo o EBIT"). A empresa cresce a crédito e paga
 * por isso; é a tensão que o Anexo C conta.
 *
 * Amortização de 130 e captação de 60 no ano, que com a distribuição de 10 do
 * balanço fecham o financiamento líquido de 80 da ponte do caixa.
 *
 * Dado fictício sob D-H03 (modo mockup); quando o banco real chegar, esta view
 * sai do sistema de dívida do cliente (seção 10.1).
 */

import { ENTIDADES_ARMAZENADAS, mesesDe } from "@/acesso/fixtures/eixos";
import { VW_FATO_FIN_MES, emReais, porEntidade } from "@/acesso/fixtures/fin";
import { repartir } from "@/acesso/fixtures/reparticao";
import { ANO_DA_FIXTURE } from "@/acesso/fixtures/rh";

const MESES = mesesDe(ANO_DA_FIXTURE);

export type LinhaDeCredito =
  "capital-de-giro" | "financiamento-longo-prazo" | "antecipacao-de-recebiveis";

/**
 * As três linhas, com o saldo de dezembro em R$ mi e a fatia dos juros.
 *
 * A fatia dos juros, em milésimos, é o que faz cada linha ter a sua taxa:
 * capital de giro a 18% (36 de 140), longo prazo a 13,3% (80 de 140) e
 * antecipação a 24% (24 de 140). A última linha leva o resto da repartição,
 * para que a soma seja exata em todo mês.
 */
export const LINHAS_DE_CREDITO: readonly {
  readonly codigo: LinhaDeCredito;
  readonly rotulo: string;
  readonly prazo: "curto" | "longo";
  readonly saldoDezembro: number;
  readonly jurosPorMil: number;
}[] = [
  {
    codigo: "capital-de-giro",
    rotulo: "Capital de giro",
    prazo: "curto",
    saldoDezembro: 200,
    jurosPorMil: 257,
  },
  {
    codigo: "financiamento-longo-prazo",
    rotulo: "Financiamento de longo prazo",
    prazo: "longo",
    saldoDezembro: 600,
    jurosPorMil: 572,
  },
  {
    codigo: "antecipacao-de-recebiveis",
    rotulo: "Antecipação de recebíveis",
    prazo: "curto",
    saldoDezembro: 100,
    jurosPorMil: 171,
  },
];

/** Amortização paga e captação tomada no ano, em R$ mi. */
export const AMORTIZACAO_ANUAL = 130;
export const CAPTACAO_ANUAL = 60;
/** A captação entra de uma vez, em março. */
const MES_DA_CAPTACAO = 2;

const SALDO_DEZEMBRO = LINHAS_DE_CREDITO.reduce(
  (acc, l) => acc + l.saldoDezembro,
  0,
);

export type LinhaDividaMes = {
  readonly mes: string;
  readonly entidade: string;
  readonly linha: LinhaDeCredito;
  readonly prazo: "curto" | "longo";
  /** Saldo devedor no fechamento do mês, em reais. */
  readonly saldo: number;
  /** Juros pagos no mês, em reais. A soma das linhas é o resultado financeiro. */
  readonly jurosPagos: number;
};

/** Os fluxos da dívida por mês e entidade, para o balanço reconciliar. */
export type FluxoDaDivida = {
  readonly mes: string;
  readonly entidade: string;
  readonly amortizacao: number;
  readonly captacao: number;
};

/** O resultado financeiro de um mês numa entidade, em reais, lido da DRE. */
function jurosDoMes(mes: string, entidade: string): number {
  return VW_FATO_FIN_MES.filter(
    (l) => l.mes === mes && l.entidade === entidade,
  ).reduce((acc, l) => acc + l.resultadoFinanceiro, 0);
}

/*
 * O saldo total, mês a mês: abre em 970, amortiza 130 em doze parcelas e
 * capta 60 em março, fechando em 900. As parcelas são inteiras e exatas.
 */
const AMORTIZACAO_MENSAL = repartir(
  emReais(AMORTIZACAO_ANUAL),
  MESES.map(() => 1),
);
const CAPTACAO_MENSAL = MESES.map((_, m) =>
  m === MES_DA_CAPTACAO ? emReais(CAPTACAO_ANUAL) : 0,
);
const SALDO_TOTAL_MENSAL: readonly number[] = (() => {
  let corrente =
    emReais(SALDO_DEZEMBRO) +
    emReais(AMORTIZACAO_ANUAL) -
    emReais(CAPTACAO_ANUAL);
  return MESES.map((_, m) => {
    corrente =
      corrente - (AMORTIZACAO_MENSAL[m] ?? 0) + (CAPTACAO_MENSAL[m] ?? 0);
    return corrente;
  });
})();

/*
 * As formas das repartições: o saldo de cada linha na proporção de dezembro, e
 * os juros na fatia declarada. `repartir` é exato — a soma das partes é o
 * total, sem sobra de arredondamento — e por isso dezembro fecha em 200, 600
 * e 100, e não em 199,9.
 */
const FORMA_DOS_SALDOS = LINHAS_DE_CREDITO.map((l) => l.saldoDezembro);
const FORMA_DOS_JUROS = LINHAS_DE_CREDITO.map((l) => l.jurosPorMil);

export const VW_FATO_DIVIDA_MES: readonly LinhaDividaMes[] = MESES.flatMap(
  (mes, m) => {
    const saldoPorEntidade = porEntidade(SALDO_TOTAL_MENSAL[m] ?? 0, "divida");
    return ENTIDADES_ARMAZENADAS.flatMap((entidade, e) => {
      const saldos = repartir(saldoPorEntidade[e] ?? 0, FORMA_DOS_SALDOS);
      const juros = repartir(jurosDoMes(mes, entidade), FORMA_DOS_JUROS);
      return LINHAS_DE_CREDITO.map((linha, i) => ({
        mes,
        entidade,
        linha: linha.codigo,
        prazo: linha.prazo,
        saldo: saldos[i] ?? 0,
        jurosPagos: juros[i] ?? 0,
      }));
    });
  },
);

/** Amortização e captação por mês e entidade, na mesma fatia da dívida. */
export const FLUXOS_DA_DIVIDA: readonly FluxoDaDivida[] = MESES.flatMap(
  (mes, m) => {
    const amortizacao = porEntidade(AMORTIZACAO_MENSAL[m] ?? 0, "divida");
    const captacao = porEntidade(CAPTACAO_MENSAL[m] ?? 0, "divida");
    return ENTIDADES_ARMAZENADAS.map((entidade, e) => ({
      mes,
      entidade,
      amortizacao: amortizacao[e] ?? 0,
      captacao: captacao[e] ?? 0,
    }));
  },
);
