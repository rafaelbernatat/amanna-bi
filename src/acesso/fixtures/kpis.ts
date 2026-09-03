/**
 * `getKpis` sobre as fixtures (T-115).
 *
 * Todo número de cartão sai daqui, e daqui sai de uma métrica do catálogo. É o
 * que RF-07 pede — *"nenhum literal de valor no código de KPI; todos vêm de
 * `getKpis`"* — e o caminho que faz o achado 5 do Anexo D deixar de existir: no
 * protótipo, metade dos cartões era texto cravado.
 *
 * ## O caminho de um número
 *
 * ```
 * registro de KPIs  →  origem  →  métrica do catálogo  →  cálculo  →  Kpi
 *   (qual cartão)     (qual        (fórmula, unidade,     (soma as     (o que
 *    e em que tela)    coluna)      agg, sentido)          linhas)      a tela recebe)
 * ```
 *
 * Nenhum elo é opcional. Um KPI sem origem, ou com origem apontando para
 * métrica sem cálculo, **lança** — e lança na chamada, não devolve vazio. Vazio
 * é um estado legítimo da seção 6.4 ("sem dado neste recorte"), e usá-lo para
 * dizer "esqueci de declarar" misturaria as duas coisas na tela.
 *
 * ## Recorte é filtro **mais** janela de meses
 *
 * As duas coisas viajam separadas neste arquivo, e a razão é o delta. Os quatro
 * períodos da tabela 6.2 são janelas que terminam em dezembro, então "o período
 * anterior" não é expressável como `Query` — não existe `periodo` que signifique
 * "os três meses antes do 4º trimestre".
 *
 * Separando, a comparação fica trivial: mesmos filtros, outra janela.
 */

import { VIEWS, type NomeDeView } from "@/acesso/fixtures/adaptador";
import {
  AGREGADO_DE_AREA,
  AGREGADO_DE_ENTIDADE,
  AGREGADO_DE_MODALIDADE,
  AREAS_ARMAZENADAS,
  mesesDe,
} from "@/acesso/fixtures/eixos";
import { VW_DIM_FAIXA_SALARIAL } from "@/acesso/fixtures/dim";
import { CUSTO_DO_TURNOVER } from "@/acesso/fixtures/referencia-perfil";
import { VW_FATO_RH_PERFIL } from "@/acesso/fixtures/perfil";
import {
  MESES_DO_PERIODO,
  mesesDoRecorte,
  somar,
} from "@/acesso/fixtures/recorte";
import type { Kpi, Query, Sentido } from "@/semantica/contrato";
import { kpisDaTela, type RegistroDeKpi } from "@/semantica/kpis";
import { origemDoKpi } from "@/semantica/origem-de-kpi";

const CEM = 100;

/** O divisor da mediana: a metade do quadro. */
const DOIS = 2;

/** Os componentes que contam como custo de reposição, e não de rescisão. */
const COMPONENTES_DE_REPOSICAO = new Set(
  CUSTO_DO_TURNOVER.filter((c) => c.ehReposicao).map((c) => c.codigo),
);
const UM_MILHAO = 1_000_000;

/* ------------------------------------------------------------------ *
 * Erros que são bug, e por isso lançam
 * ------------------------------------------------------------------ */

export class KpiSemOrigem extends Error {
  constructor(kpi: string) {
    super(
      `O KPI '${kpi}' não tem origem declarada em origem-de-kpi.ts. ` +
        "Devolver vazio diria 'sem dado no recorte' para o que é 'sem declaração'.",
    );
    this.name = "KpiSemOrigem";
  }
}

export class MetricaSemCalculo extends Error {
  constructor(metrica: string, kpi: string) {
    super(
      `A métrica '${metrica}', que o KPI '${kpi}' usa, não tem cálculo. ` +
        "Toda métrica do catálogo que vira cartão precisa saber somar as linhas.",
    );
    this.name = "MetricaSemCalculo";
  }
}

/* ------------------------------------------------------------------ *
 * O recorte: os filtros e a janela
 * ------------------------------------------------------------------ */

/** Filtros dimensionais mais a janela de meses. Ver o cabeçalho. */
export type Recorte = {
  readonly q: Query;
  readonly meses: readonly string[];
};

/** O recorte que uma `Query` descreve. */
export function recorteDe(q: Query): Recorte {
  return { q, meses: mesesDoRecorte(q) };
}

/** Uma linha pertence ao recorte? Sem multiplicação: escolha de linha. */
export function pertence(
  linha: { mes: string; entidade?: string; area?: string; modalidade?: string },
  r: Recorte,
): boolean {
  if (!r.meses.includes(linha.mes)) return false;
  if (r.q.entidade !== AGREGADO_DE_ENTIDADE && linha.entidade !== undefined) {
    if (linha.entidade !== r.q.entidade) return false;
  }
  if (r.q.area !== AGREGADO_DE_AREA && linha.area !== undefined) {
    if (linha.area !== r.q.area) return false;
  }
  if (
    r.q.modalidade !== AGREGADO_DE_MODALIDADE &&
    linha.modalidade !== undefined
  ) {
    if (linha.modalidade !== r.q.modalidade) return false;
  }
  return true;
}

/* ------------------------------------------------------------------ *
 * As auxiliares de medida, compartilhadas com os painéis
 * ------------------------------------------------------------------ *
 *
 * `export` aqui não é conveniência: é o princípio PR-1 aplicado ao código.
 *
 * O painel `rh-turnover` e o cartão `rh-visao-turnover-12m` mostram a mesma
 * medida na mesma tela. Se cada um a somasse por conta própria, bastaria uma
 * divergência de arredondamento — ou de denominador — para a tela exibir dois
 * números para a mesma coisa, e quem os visse não teria como saber qual está
 * certo. Compartilhando estas funções, e o `CALCULO` que elas alimentam, a
 * divergência deixa de ser possível.
 *
 * O que fica privado continua privado: `delta`, `sentimento` e `montar` são do
 * cartão e não têm equivalente no painel.
 */

/** As linhas de uma view no recorte. */
export function linhas<N extends NomeDeView>(
  view: N,
  r: Recorte,
): readonly (typeof VIEWS)[N][number][] {
  const todas = VIEWS[view] as readonly (typeof VIEWS)[N][number][];
  return todas.filter((l) => pertence(l, r));
}

/** A soma de uma medida no recorte. `null` quando não há linha (PR-4). */
export function soma<N extends NomeDeView>(
  view: N,
  r: Recorte,
  medida: (l: (typeof VIEWS)[N][number]) => number,
): number | null {
  const escolhidas = linhas(view, r);
  return escolhidas.length === 0 ? null : somar(escolhidas, medida);
}

/** A soma no **último mês** da janela — o que `agg: last` significa. */
export function noFim<N extends NomeDeView>(
  view: N,
  r: Recorte,
  medida: (l: (typeof VIEWS)[N][number]) => number,
): number | null {
  const ultimo = r.meses.at(-1);
  return soma(
    view,
    { ...r, meses: ultimo === undefined ? [] : [ultimo] },
    medida,
  );
}

/**
 * A média mensal de um estoque — o denominador do turnover.
 *
 * Soma o estoque de cada mês e divide pelo número de meses. Não é a soma dos
 * meses: somar o quadro de doze meses daria doze vezes a empresa.
 */
export function mediaMensal(
  r: Recorte,
  medida: (l: (typeof VIEWS)["vw_fato_rh_mes"][number]) => number,
): number | null {
  if (r.meses.length === 0) return null;
  const doRecorte = linhas("vw_fato_rh_mes", r);
  if (doRecorte.length === 0) return null;
  const total = r.meses.reduce(
    (acc, mes) =>
      acc +
      somar(
        doRecorte.filter((l) => l.mes === mes),
        medida,
      ),
    0,
  );
  return total / r.meses.length;
}

/** Uma divisão que devolve `null` em vez de `Infinity` ou `NaN`. */
export function razao(numerador: number | null, denominador: number | null) {
  if (numerador === null || denominador === null || denominador === 0) {
    return null;
  }
  return numerador / denominador;
}

/** Multiplica por 100, preservando a ausência. */
export function emPorcento(fracao: number | null): number | null {
  return fracao === null ? null : fracao * CEM;
}

/** O quadro por atributo de perfil, no fim da janela. */
export function perfil(
  r: Recorte,
  dimensao: string,
  valores?: readonly string[],
): number | null {
  const ultimo = r.meses.at(-1);
  const escolhidas = VW_FATO_RH_PERFIL.filter(
    (l) =>
      l.mes === ultimo &&
      l.dimensao === dimensao &&
      pertence(l, { ...r, meses: [l.mes] }) &&
      (valores === undefined || valores.includes(l.valor)),
  );
  return escolhidas.length === 0
    ? null
    : somar(escolhidas, (l) => l.headcountFte);
}

/**
 * A faixa salarial que contém a pessoa do meio, interpolada.
 *
 * Devolve `null` quando não há quadro — e não zero, que seria "a mediana é zero
 * real" (princípio PR-4).
 */
function medianaSalarial(r: Recorte): number | null {
  const faixas = VW_DIM_FAIXA_SALARIAL;
  const contagens = faixas.map((f) => perfil(r, "faixa_salarial", [f.codigo]));
  const total = contagens.reduce<number>((a, v) => a + (v ?? 0), 0);
  if (total === 0) return null;

  const meio = total / DOIS;
  let acumulado = 0;

  for (const [i, faixa] of faixas.entries()) {
    const quantos = contagens[i] ?? 0;
    if (acumulado + quantos < meio) {
      acumulado += quantos;
      continue;
    }
    if (quantos === 0) continue;

    /*
     * O teto da última faixa é aberto ("acima de 30k"). Interpolar dentro de
     * uma faixa sem teto exigiria inventar um; em vez disso, a mediana ali é o
     * piso — que é o que se sabe.
     */
    const piso = faixa.de;
    const teto = faixa.ate;
    if (teto === null) return emMilhoes(piso);

    const posicao = (meio - acumulado) / quantos;
    return emMilhoes(piso + (teto - piso) * posicao);
  }

  return null;
}

/* ------------------------------------------------------------------ *
 * O cálculo de cada métrica
 * ------------------------------------------------------------------ */

function turnover(r: Recorte): number | null {
  return emPorcento(
    razao(
      soma("vw_fato_rh_mes", r, (l) => l.desligamentos),
      mediaMensal(r, (l) => l.headcountFte),
    ),
  );
}

function engajamento(r: Recorte): number | null {
  return razao(
    soma("vw_fato_rh_mes", r, (l) => l.pontosDeEngajamento),
    soma("vw_fato_rh_mes", r, (l) => l.respondentes),
  );
}

/** Reais para `BRL_mi`, preservando a ausência. */
export function emMilhoes(reais: number | null): number | null {
  return reais === null ? null : reais / UM_MILHAO;
}

/** A receita líquida do recorte, em reais. Denominador de meia dúzia de KPIs. */
function receita(r: Recorte): number | null {
  return soma("vw_fato_fin_mes", r, (l) => l.receitaLiquida);
}

/** O CMV do recorte, em reais. Denominador de PME e PMP. */
function custoDasVendas(r: Recorte): number | null {
  return soma("vw_fato_fin_mes", r, (l) => l.cmv);
}

/**
 * O EBITDA em reais, por diferença.
 *
 * Não existe coluna de EBITDA na fixture, e é decisão: se existisse, seria
 * possível ela discordar das três parcelas que a formam. Aqui a única forma de
 * o EBITDA estar errado é uma das três estar.
 */
function ebitdaEmReais(r: Recorte): number | null {
  const rec = receita(r);
  if (rec === null) return null;
  return (
    rec -
    (custoDasVendas(r) ?? 0) -
    (soma("vw_fato_fin_mes", r, (l) => l.despesasOperacionais) ?? 0)
  );
}

/**
 * Um prazo médio em dias: saldo sobre fluxo, vezes os dias do ano.
 *
 * O `* 365` anualiza. Sob recorte de um mês, isso projeta o mês inteiro sobre
 * um ano e exagera a sazonalidade — está anotado na `decisao` de `pmr` no
 * catálogo, e é uma das perguntas de H-08.
 */
const DIAS_DO_ANO = 365;

function prazo(saldo: number | null, fluxo: number | null): number | null {
  const fracao = razao(saldo, fluxo);
  return fracao === null ? null : fracao * DIAS_DO_ANO;
}

/* ------------------------------------------------------------------ *
 * Balanço e dívida (perguntas de CFO, 2026-09-03)
 * ------------------------------------------------------------------ */

const MESES_NO_ANO = 12;
const DIAS_NO_MES = 30;
/** IR e CSLL do lucro real, em %: o benefício fiscal da dívida. */
const ALIQUOTA_DE_IR_E_CSLL = 34;

/** O lucro líquido do recorte em reais, o último degrau da ponte. */
function lucroLiquidoEmReais(r: Recorte): number | null {
  const operacional = ebitdaEmReais(r);
  if (operacional === null) return null;
  return (
    operacional -
    (soma("vw_fato_fin_mes", r, (l) => l.depreciacaoEAmortizacao) ?? 0) -
    (soma("vw_fato_fin_mes", r, (l) => l.resultadoFinanceiro) ?? 0) -
    (soma("vw_fato_fin_mes", r, (l) => l.naoOperacional) ?? 0)
  );
}

/** O EBIT do recorte em reais: EBITDA menos depreciação. */
function ebitEmReais(r: Recorte): number | null {
  const operacional = ebitdaEmReais(r);
  if (operacional === null) return null;
  return (
    operacional -
    (soma("vw_fato_fin_mes", r, (l) => l.depreciacaoEAmortizacao) ?? 0)
  );
}

/** Um fluxo do recorte projetado para doze meses, para múltiplos sob um mês. */
function anualizado(fluxo: number | null, r: Recorte): number | null {
  if (fluxo === null || r.meses.length === 0) return null;
  return (fluxo * MESES_NO_ANO) / r.meses.length;
}

/** A média dos saldos de fim de mês de uma medida do balanço, no recorte. */
function mediaDoBalanco(
  r: Recorte,
  medida: (l: (typeof VIEWS)["vw_fato_balanco_mes"][number]) => number,
): number | null {
  const total = soma("vw_fato_balanco_mes", r, medida);
  if (total === null || r.meses.length === 0) return null;
  return total / r.meses.length;
}

function dividaBrutaEmReais(r: Recorte): number | null {
  return noFim(
    "vw_fato_balanco_mes",
    r,
    (l) => l.dividaCurtoPrazo + l.dividaLongoPrazo,
  );
}

function saldoDeCaixaEmReais(r: Recorte): number | null {
  return noFim("vw_fato_fin_mes", r, (l) => l.saldoDeCaixa);
}

/** Juros do recorte, anualizados, sobre a dívida média: a taxa efetiva. */
function custoMedioDaDividaEmFracao(r: Recorte): number | null {
  return razao(
    anualizado(
      soma("vw_fato_balanco_mes", r, (l) => l.jurosPagos),
      r,
    ),
    mediaDoBalanco(r, (l) => l.dividaCurtoPrazo + l.dividaLongoPrazo),
  );
}

function ncgEmReais(r: Recorte): number | null {
  const aReceber = noFim("vw_fato_contas", r, (l) => l.aReceber);
  const estoque = noFim("vw_fato_fin_mes", r, (l) => l.estoque);
  const aPagar = noFim("vw_fato_contas", r, (l) => l.aPagar);
  if (aReceber === null || estoque === null || aPagar === null) return null;
  return aReceber + estoque - aPagar;
}

/** Custo mensal de carregar um saldo ao custo médio da dívida. */
function custoMensalDeCarregar(
  saldo: number | null,
  r: Recorte,
): number | null {
  const custo = custoMedioDaDividaEmFracao(r);
  if (saldo === null || custo === null) return null;
  return emMilhoes((saldo * custo) / MESES_NO_ANO);
}

/* ------------------------------------------------------------------ *
 * Natureza das contas e qualidade do razão (perguntas de CFO, etapa 2)
 * ------------------------------------------------------------------ */

/** O retorno mínimo dos sócios, em % ao ano, para o ponto de equilíbrio econômico. */
const TAXA_MINIMA_DOS_SOCIOS = 12;
/** A queda de receita simulada pelo documento de CFO, em %. */
const QUEDA_SIMULADA = 10;

/** Receita menos custos variáveis, em reais. */
function margemDeContribuicaoEmReais(r: Recorte): number | null {
  const rec = receita(r);
  const variaveis = soma("vw_fato_natureza_mes", r, (l) => l.custosVariaveis);
  if (rec === null || variaveis === null) return null;
  return rec - variaveis;
}

/**
 * O ponto de equilíbrio mensal, em reais: o custo a cobrir sobre a fração de
 * contribuição, dividido pelos meses do recorte para ficar por mês.
 */
function pontoDeEquilibrioMensal(
  custoACobrir: number | null,
  r: Recorte,
): number | null {
  const fracao = razao(margemDeContribuicaoEmReais(r), receita(r));
  if (custoACobrir === null || fracao === null || fracao === 0) return null;
  if (r.meses.length === 0) return null;
  return custoACobrir / fracao / r.meses.length;
}

function custosFixosEmReais(r: Recorte): number | null {
  return soma("vw_fato_natureza_mes", r, (l) => l.custosFixos);
}

function depreciacaoEmReais(r: Recorte): number | null {
  return soma("vw_fato_fin_mes", r, (l) => l.depreciacaoEAmortizacao);
}

/** Fixos mais depreciação: o que o ponto de equilíbrio contábil cobre. */
function custoContabilACobrir(r: Recorte): number | null {
  const fixos = custosFixosEmReais(r);
  const depreciacao = depreciacaoEmReais(r);
  if (fixos === null || depreciacao === null) return null;
  return fixos + depreciacao;
}

/** O ponto de equilíbrio contábil, em reais por mês. */
function pontoDeEquilibrioContabil(r: Recorte): number | null {
  return pontoDeEquilibrioMensal(custoContabilACobrir(r), r);
}

type Calculo = (r: Recorte) => number | null;

/**
 * De métrica do catálogo para número.
 *
 * Uma entrada por **métrica**, e não por KPI: "Turnover 12m" aparece em duas
 * telas e é o mesmo cálculo. Duas cópias divergiriam, e a que divergisse seria
 * a que ninguém compara.
 */
const CALCULO: Readonly<Record<string, Calculo>> = {
  /* ---------------------------------------------------------------- *
   * As seis que só o chat pede (T-120)
   * ---------------------------------------------------------------- *
   *
   * Nenhuma delas vira cartão, e é por isso que faltavam: `CALCULO` cresceu
   * junto com os KPIs de T-115 e T-116. `getMetric` responde ao catálogo
   * inteiro, e catálogo com métrica que não sabe se calcular é catálogo que
   * promete o que não entrega.
   */

  /**
   * A margem EBITDA.
   *
   * Estava calculada dentro de `paineis.ts`, para a linha de `fin-margens`.
   * Uma métrica do catálogo definida fora do catálogo é a divergência de PR-1
   * esperando acontecer: bastaria alguém corrigir uma das duas.
   */
  margem_ebitda: (r) => emPorcento(razao(ebitdaEmReais(r), receita(r))),

  /** Vagas movimentadas: os quatro status somados. */
  vagas_status: (r) =>
    soma(
      "vw_fato_vagas",
      r,
      (l) => l.abertas + l.emAndamento + l.fechadas + l.canceladas,
    ),

  /*
   * As três distribuições devolvem **o quadro**, e não uma quebra.
   *
   * `getMetric` responde um número; a quebra é o que o painel desenha. A
   * fórmula do catálogo diz exatamente isso — "headcount_fte quebrado por
   * faixa etária" —, então o valor da métrica é o headcount e a quebra é a
   * apresentação dele. Devolver a maior faixa, ou a contagem de faixas, seria
   * responder outra pergunta.
   *
   * As três coincidirem em valor não é descuido: são três intenções diferentes
   * sobre o mesmo agregado, e é o `rotulo` e a `formula` que as separam.
   */
  distribuicao_etaria: (r) => noFim("vw_fato_rh_mes", r, (l) => l.headcountFte),
  distribuicao_uf: (r) => noFim("vw_fato_rh_mes", r, (l) => l.headcountFte),
  perfil_quadro: (r) => noFim("vw_fato_rh_mes", r, (l) => l.headcountFte),

  /**
   * A mediana salarial, por interpolação dentro da faixa que contém o meio.
   *
   * Não é a média, e a diferença é o motivo de a métrica existir: uma folha com
   * poucos salários muito altos tem média bem acima da mediana, e é a mediana
   * que responde "quanto ganha quem está no meio".
   *
   * Como o quadro é conhecido por faixa e não por pessoa, a posição dentro da
   * faixa é interpolada linearmente — o que assume distribuição uniforme dentro
   * dela. É aproximação declarada, e está escrita na fórmula do catálogo.
   */
  mediana_salarial: (r) => medianaSalarial(r),

  headcount_fte: (r) => noFim("vw_fato_rh_mes", r, (l) => l.headcountFte),

  turnover_12m: turnover,

  retencao_12m: (r) => {
    const t = turnover(r);
    return t === null ? null : CEM - t;
  },

  enps: (r) =>
    emPorcento(
      razao(
        (soma("vw_fato_rh_mes", r, (l) => l.promotores) ?? 0) -
          (soma("vw_fato_rh_mes", r, (l) => l.detratores) ?? 0),
        soma("vw_fato_rh_mes", r, (l) => l.respondentes),
      ),
    ),

  custo_por_fte: (r) =>
    emMilhoes(
      razao(
        soma("vw_fato_rh_mes", r, (l) => l.folhaReais),
        noFim("vw_fato_rh_mes", r, (l) => l.headcountFte),
      ),
    ),

  folha_total: (r) => emMilhoes(soma("vw_fato_rh_mes", r, (l) => l.folhaReais)),

  idade_media: (r) =>
    razao(
      noFim("vw_fato_rh_mes", r, (l) => l.somaDeIdade),
      noFim("vw_fato_rh_mes", r, (l) => l.headcountFte),
    ),

  tempo_medio_de_casa: (r) =>
    razao(
      noFim("vw_fato_rh_mes", r, (l) => l.somaDeTempoDeCasa),
      noFim("vw_fato_rh_mes", r, (l) => l.headcountFte),
    ),

  tempo_ate_a_saida: (r) =>
    razao(
      soma("vw_fato_rh_mes", r, (l) => l.somaDeTempoAteASaida),
      soma("vw_fato_rh_mes", r, (l) => l.desligamentos),
    ),

  /**
   * Híbrido e remoto sobre o quadro inteiro.
   *
   * O denominador ignora o filtro de modalidade de propósito: sob recorte de
   * "Remoto", a fração seria 100% e o cartão não diria nada.
   */
  trabalho_flexivel: (r) => {
    const semFiltro: Recorte = {
      ...r,
      q: { ...r.q, modalidade: AGREGADO_DE_MODALIDADE },
    };
    const ultimo = r.meses.at(-1);
    const flexivel = linhas("vw_fato_rh_mes", semFiltro).filter(
      (l) =>
        l.mes === ultimo &&
        (l.modalidade === "hibrido" || l.modalidade === "remoto"),
    );
    return emPorcento(
      razao(
        flexivel.length === 0 ? null : somar(flexivel, (l) => l.headcountFte),
        noFim("vw_fato_rh_mes", semFiltro, (l) => l.headcountFte),
      ),
    );
  },

  estados_atendidos: (r) => {
    const ultimo = r.meses.at(-1);
    const comGente = new Set(
      VW_FATO_RH_PERFIL.filter(
        (l) =>
          l.mes === ultimo &&
          l.dimensao === "uf" &&
          l.headcountFte > 0 &&
          pertence(l, { ...r, meses: [l.mes] }),
      ).map((l) => l.valor),
    );
    return comGente.size === 0 ? null : comGente.size;
  },

  escolaridade_superior: (r) =>
    emPorcento(
      razao(
        perfil(r, "escolaridade", [
          "superior",
          "pos-graduacao",
          "mestrado-mais",
        ]),
        perfil(r, "escolaridade"),
      ),
    ),

  desligamentos: (r) => soma("vw_fato_rh_mes", r, (l) => l.desligamentos),

  /*
   * O custo do turnover sai de `vw_fato_turnover_custo`, e não mais de duas
   * colunas de `vw_fato_rh_mes`.
   *
   * A suíte da regra 1 pegou: o cartão dizia 6,04 mi sob recorte de presencial
   * e o painel da mesma tela dizia 12,4 mi. Duas fontes para a mesma medida —
   * o cartão lia colunas do fato mensal, o painel lia a view que T-118.1
   * declarou —, e o cartão reagia a modalidade porque o fato mensal a tem,
   * enquanto a view não.
   *
   * As colunas que o cartão lia **não estavam na seção 10.1**: eram anteriores
   * à view e sobreviveram sem declaração. Ler da view alinha os dois por
   * construção e faz o número obedecer ao grão que o PRD publica.
   */
  custo_do_turnover: (r) =>
    emMilhoes(soma("vw_fato_turnover_custo", r, (l) => l.valor)),

  /**
   * Reposição: os componentes que a decomposição marca como tal.
   *
   * Rescisão é verba paga a quem sai; reposição é o que custa colocar outra
   * pessoa no lugar. A separação vem de `CUSTO_DO_TURNOVER`, onde cada
   * componente traz a marca — e é ela, não uma lista repetida aqui, que decide.
   */
  custo_de_reposicao: (r) =>
    emMilhoes(
      soma("vw_fato_turnover_custo", r, (l) =>
        COMPONENTES_DE_REPOSICAO.has(l.componente) ? l.valor : 0,
      ),
    ),

  vagas_abertas: (r) => soma("vw_fato_vagas", r, (l) => l.abertas),
  vagas_em_andamento: (r) => soma("vw_fato_vagas", r, (l) => l.emAndamento),
  vagas_fechadas: (r) => soma("vw_fato_vagas", r, (l) => l.fechadas),
  vagas_canceladas: (r) => soma("vw_fato_vagas", r, (l) => l.canceladas),

  tempo_fechamento: (r) =>
    razao(
      soma("vw_fato_vagas", r, (l) => l.diasSomados),
      soma("vw_fato_vagas", r, (l) => l.fechadas),
    ),

  custo_por_contratacao: (r) =>
    emMilhoes(
      razao(
        soma("vw_fato_vagas", r, (l) => l.custoDeRecrutamento),
        soma("vw_fato_vagas", r, (l) => l.contratados),
      ),
    ),

  horas_treinamento: (r) => soma("vw_fato_treinamento", r, (l) => l.horas),

  investimento_treinamento: (r) =>
    emMilhoes(soma("vw_fato_treinamento", r, (l) => l.investimentoReais)),

  horas_por_fte: (r) =>
    razao(
      soma("vw_fato_treinamento", r, (l) => l.horas),
      noFim("vw_fato_rh_mes", r, (l) => l.headcountFte),
    ),

  /**
   * Participação: gente que treinou sobre gente que podia treinar.
   *
   * Lida no **último mês** da janela, e não somada nela. Somar contaria a mesma
   * pessoa uma vez por mês: no recorte de 12 meses a participação passava de
   * 100%, medida em 108,9%. Pessoa não soma ao longo do tempo — é estoque.
   */
  participacao_treinamento: (r) =>
    emPorcento(
      razao(
        noFim("vw_fato_rh_mes", r, (l) => l.participantesDeTreinamento),
        noFim("vw_fato_rh_mes", r, (l) => l.elegiveis),
      ),
    ),

  conclusao_treinamento: (r) =>
    emPorcento(
      razao(
        soma("vw_fato_treinamento", r, (l) => l.trilhasConcluidas),
        soma("vw_fato_treinamento", r, (l) => l.trilhasIniciadas),
      ),
    ),

  custo_por_hora_treinamento: (r) =>
    emMilhoes(
      razao(
        soma("vw_fato_treinamento", r, (l) => l.investimentoReais),
        soma("vw_fato_treinamento", r, (l) => l.horas),
      ),
    ),

  engajamento_area: engajamento,

  absenteismo: (r) =>
    emPorcento(
      razao(
        soma("vw_fato_rh_mes", r, (l) => l.horasAusentes),
        soma("vw_fato_rh_mes", r, (l) => l.horasPrevistas),
      ),
    ),

  promotores: (r) =>
    emPorcento(
      razao(
        soma("vw_fato_rh_mes", r, (l) => l.promotores),
        soma("vw_fato_rh_mes", r, (l) => l.respondentes),
      ),
    ),

  cobertura_da_pesquisa: (r) =>
    emPorcento(
      razao(
        soma("vw_fato_rh_mes", r, (l) => l.respondentes),
        soma("vw_fato_rh_mes", r, (l) => l.elegiveis),
      ),
    ),

  /**
   * O menor engajamento entre as áreas do recorte.
   *
   * Sob recorte de uma área só, o mínimo é a própria área — e isso é correto:
   * "qual a área mais crítica", perguntado sob recorte de Tecnologia, é
   * Tecnologia.
   */
  engajamento_minimo_por_area: (r) => {
    const areas =
      r.q.area === AGREGADO_DE_AREA ? AREAS_ARMAZENADAS : [r.q.area];
    const valores = areas
      .map((area) =>
        engajamento({ ...r, q: { ...r.q, area: area as Query["area"] } }),
      )
      .filter((v): v is number => v !== null);
    return valores.length === 0 ? null : Math.min(...valores);
  },

  salario_medio: (r) =>
    emMilhoes(
      razao(
        soma("vw_fato_rh_mes", r, (l) => l.salarios),
        (noFim("vw_fato_rh_mes", r, (l) => l.headcountFte) ?? 0) *
          r.meses.length,
      ),
    ),

  encargos_sobre_salarios: (r) =>
    emPorcento(
      razao(
        soma("vw_fato_rh_mes", r, (l) => l.encargos),
        soma("vw_fato_rh_mes", r, (l) => l.salarios),
      ),
    ),

  beneficios: (r) => emMilhoes(soma("vw_fato_rh_mes", r, (l) => l.beneficios)),

  remuneracao_variavel: (r) =>
    emMilhoes(soma("vw_fato_rh_mes", r, (l) => l.variavel)),

  /* ---------------- Financeiro (T-116) ---------------- */

  receita_bruta: (r) =>
    emMilhoes(soma("vw_fato_fin_mes", r, (l) => l.receitaBruta)),

  receita_liquida: (r) =>
    emMilhoes(soma("vw_fato_fin_mes", r, (l) => l.receitaLiquida)),

  ebitda: (r) => emMilhoes(ebitdaEmReais(r)),

  lucro_liquido: (r) => {
    const operacional = ebitdaEmReais(r);
    if (operacional === null) return null;
    return emMilhoes(
      operacional -
        (soma("vw_fato_fin_mes", r, (l) => l.depreciacaoEAmortizacao) ?? 0) -
        (soma("vw_fato_fin_mes", r, (l) => l.resultadoFinanceiro) ?? 0) -
        (soma("vw_fato_fin_mes", r, (l) => l.naoOperacional) ?? 0),
    );
  },

  margem_bruta: (r) =>
    emPorcento(
      razao(
        (soma("vw_fato_fin_mes", r, (l) => l.receitaLiquida) ?? 0) -
          (soma("vw_fato_fin_mes", r, (l) => l.cmv) ?? 0),
        soma("vw_fato_fin_mes", r, (l) => l.receitaLiquida),
      ),
    ),

  margem_liquida: (r) => {
    const operacional = ebitdaEmReais(r);
    if (operacional === null) return null;
    const lucro =
      operacional -
      (soma("vw_fato_fin_mes", r, (l) => l.depreciacaoEAmortizacao) ?? 0) -
      (soma("vw_fato_fin_mes", r, (l) => l.resultadoFinanceiro) ?? 0) -
      (soma("vw_fato_fin_mes", r, (l) => l.naoOperacional) ?? 0);
    return emPorcento(
      razao(
        lucro,
        soma("vw_fato_fin_mes", r, (l) => l.receitaLiquida),
      ),
    );
  },

  saldo_caixa: (r) =>
    emMilhoes(noFim("vw_fato_fin_mes", r, (l) => l.saldoDeCaixa)),

  fco: (r) => emMilhoes(soma("vw_fato_fin_mes", r, (l) => l.fco)),
  capex: (r) => emMilhoes(soma("vw_fato_fin_mes", r, (l) => l.capex)),
  financiamento: (r) =>
    emMilhoes(soma("vw_fato_fin_mes", r, (l) => l.financiamento)),

  conversao_de_caixa: (r) =>
    emPorcento(
      razao(
        soma("vw_fato_fin_mes", r, (l) => l.fco),
        ebitdaEmReais(r),
      ),
    ),

  orcado: (r) => emMilhoes(soma("vw_fato_orcamento", r, (l) => l.orcado)),
  realizado: (r) => emMilhoes(soma("vw_fato_orcamento", r, (l) => l.realizado)),

  desvio_orcamentario: (r) =>
    emMilhoes(soma("vw_fato_orcamento", r, (l) => l.realizado - l.orcado)),

  /**
   * A economia conta **só** os centros que gastaram menos.
   *
   * Por isso não é o desvio com o sinal trocado: os que estouraram ficam de
   * fora. Somar os dois lados daria o desvio, e o cartão perderia o que ele
   * existe para mostrar — que houve economia em algum lugar, mesmo com estouro
   * no total.
   */
  economia_orcamentaria: (r) => {
    const porCentro = new Map<string, number>();
    for (const l of linhas("vw_fato_orcamento", r)) {
      porCentro.set(
        l.centroDeCusto,
        (porCentro.get(l.centroDeCusto) ?? 0) + (l.orcado - l.realizado),
      );
    }
    if (porCentro.size === 0) return null;
    const economia = [...porCentro.values()]
      .filter((v) => v > 0)
      .reduce((a, b) => a + b, 0);
    return emMilhoes(economia);
  },

  crescimento_yoy: (r) =>
    emPorcento(
      razao(
        (soma("vw_fato_fin_mes", r, (l) => l.receitaLiquida) ?? 0) -
          (soma("vw_fato_fin_mes", r, (l) => l.receitaLiquidaAnoAnterior) ?? 0),
        soma("vw_fato_fin_mes", r, (l) => l.receitaLiquidaAnoAnterior),
      ),
    ),

  /**
   * Inadimplência: o que já venceu, sobre o que há a receber.
   *
   * "Já venceu" é **acima de 90 dias**, e não tudo fora do "a vencer". A
   * diferença não é pequena: contando 1–30 dias junto, a taxa vai de 4,1% para
   * 31%. O rodapé do cartão no protótipo diz "R$ 7 mi sobre R$ 171 mi", que é
   * exatamente a faixa de mais de 90 dias — e foi ele que decidiu isto aqui.
   *
   * Continua sendo escolha de negócio, e está anotada como tal na `decisao` da
   * métrica: parte das empresas conta a partir de 30 dias.
   */
  inadimplencia: (r) =>
    emPorcento(
      razao(
        noFim("vw_fato_contas", r, (l) =>
          l.faixaDeAging === "mais-90d" ? l.aReceber : 0,
        ),
        noFim("vw_fato_contas", r, (l) => l.aReceber),
      ),
    ),

  /*
   * Os três prazos leem **estoque no fim da janela** sobre **fluxo do período**.
   *
   * Somar o estoque ao longo dos meses dava PMR de 606 dias — doze vezes o
   * saldo, dividido pela receita de um ano. O saldo a receber de janeiro e o de
   * fevereiro não são duas dívidas: são a mesma conta, medida duas vezes.
   */
  pmr: (r) =>
    prazo(
      noFim("vw_fato_contas", r, (l) => l.aReceber),
      receita(r),
    ),
  pme: (r) =>
    prazo(
      noFim("vw_fato_fin_mes", r, (l) => l.estoque),
      custoDasVendas(r),
    ),
  pmp: (r) =>
    prazo(
      noFim("vw_fato_contas", r, (l) => l.aPagar),
      custoDasVendas(r),
    ),

  ciclo_financeiro: (r) => {
    const dePrazo = (n: number | null, d: number | null) => prazo(n, d) ?? 0;
    if (receita(r) === null) return null;
    return (
      dePrazo(
        noFim("vw_fato_contas", r, (l) => l.aReceber),
        receita(r),
      ) +
      dePrazo(
        noFim("vw_fato_fin_mes", r, (l) => l.estoque),
        custoDasVendas(r),
      ) -
      dePrazo(
        noFim("vw_fato_contas", r, (l) => l.aPagar),
        custoDasVendas(r),
      )
    );
  },

  ticket_medio: (r) =>
    emMilhoes(
      razao(
        soma("vw_fato_fin_mes", r, (l) => l.receitaLiquida),
        soma("vw_fato_fin_mes", r, (l) => l.notasEmitidas),
      ),
    ),

  concentracao_top_10: (r) =>
    emPorcento(
      razao(
        soma("vw_fato_faturamento_cliente", r, (l) => l.receita),
        soma("vw_fato_fin_mes", r, (l) => l.receitaLiquida),
      ),
    ),

  /* ---------------- Balanço e dívida (perguntas de CFO) ---------------- */

  patrimonio_liquido: (r) =>
    emMilhoes(noFim("vw_fato_balanco_mes", r, (l) => l.patrimonioLiquido)),
  ativo_total: (r) =>
    emMilhoes(noFim("vw_fato_balanco_mes", r, (l) => l.ativoTotal)),
  ativo_circulante: (r) =>
    emMilhoes(noFim("vw_fato_balanco_mes", r, (l) => l.ativoCirculante)),
  passivo_circulante: (r) =>
    emMilhoes(noFim("vw_fato_balanco_mes", r, (l) => l.passivoCirculante)),
  imobilizado: (r) =>
    emMilhoes(noFim("vw_fato_balanco_mes", r, (l) => l.imobilizado)),
  aplicacoes_financeiras: (r) =>
    emMilhoes(noFim("vw_fato_balanco_mes", r, (l) => l.aplicacoesFinanceiras)),
  divida_curto_prazo: (r) =>
    emMilhoes(noFim("vw_fato_balanco_mes", r, (l) => l.dividaCurtoPrazo)),
  divida_longo_prazo: (r) =>
    emMilhoes(noFim("vw_fato_balanco_mes", r, (l) => l.dividaLongoPrazo)),
  divida_bruta: (r) => emMilhoes(dividaBrutaEmReais(r)),
  divida_liquida: (r) => {
    const bruta = dividaBrutaEmReais(r);
    const caixa = saldoDeCaixaEmReais(r);
    return bruta === null || caixa === null ? null : emMilhoes(bruta - caixa);
  },
  capital_investido: (r) =>
    emMilhoes(
      noFim(
        "vw_fato_balanco_mes",
        r,
        (l) =>
          l.patrimonioLiquido +
          l.dividaCurtoPrazo +
          l.dividaLongoPrazo -
          l.aplicacoesFinanceiras,
      ),
    ),
  estoque_sem_giro: (r) =>
    emMilhoes(noFim("vw_fato_balanco_mes", r, (l) => l.estoqueSemGiro)),
  a_receber_vencido: (r) =>
    emMilhoes(noFim("vw_fato_balanco_mes", r, (l) => l.aReceberVencido)),
  a_pagar_vencido: (r) =>
    emMilhoes(noFim("vw_fato_balanco_mes", r, (l) => l.aPagarVencido)),
  contas_a_receber: (r) =>
    emMilhoes(noFim("vw_fato_contas", r, (l) => l.aReceber)),
  contas_a_pagar: (r) => emMilhoes(noFim("vw_fato_contas", r, (l) => l.aPagar)),
  juros_pagos: (r) =>
    emMilhoes(soma("vw_fato_balanco_mes", r, (l) => l.jurosPagos)),
  impostos_sobre_lucro: (r) =>
    emMilhoes(soma("vw_fato_balanco_mes", r, (l) => l.impostosSobreLucro)),
  amortizacao_de_divida: (r) =>
    emMilhoes(soma("vw_fato_balanco_mes", r, (l) => l.amortizacaoDeDivida)),
  distribuicao_a_socios: (r) =>
    emMilhoes(soma("vw_fato_balanco_mes", r, (l) => l.distribuicaoASocios)),

  roe: (r) =>
    emPorcento(
      razao(
        lucroLiquidoEmReais(r),
        noFim("vw_fato_balanco_mes", r, (l) => l.patrimonioLiquido),
      ),
    ),
  roa: (r) =>
    emPorcento(
      razao(
        lucroLiquidoEmReais(r),
        noFim("vw_fato_balanco_mes", r, (l) => l.ativoTotal),
      ),
    ),
  resultado_operacional_liquido: (r) => {
    const ebit = ebitEmReais(r);
    if (ebit === null) return null;
    return emMilhoes(
      ebit - (soma("vw_fato_balanco_mes", r, (l) => l.impostosSobreLucro) ?? 0),
    );
  },
  roic: (r) => {
    const ebit = ebitEmReais(r);
    if (ebit === null) return null;
    return emPorcento(
      razao(
        ebit -
          (soma("vw_fato_balanco_mes", r, (l) => l.impostosSobreLucro) ?? 0),
        noFim(
          "vw_fato_balanco_mes",
          r,
          (l) =>
            l.patrimonioLiquido +
            l.dividaCurtoPrazo +
            l.dividaLongoPrazo -
            l.aplicacoesFinanceiras,
        ),
      ),
    );
  },
  giro_do_ativo: (r) =>
    razao(
      receita(r),
      noFim("vw_fato_balanco_mes", r, (l) => l.ativoTotal),
    ),
  multiplicador_de_capital: (r) =>
    razao(
      noFim("vw_fato_balanco_mes", r, (l) => l.ativoTotal),
      noFim("vw_fato_balanco_mes", r, (l) => l.patrimonioLiquido),
    ),

  liquidez_corrente: (r) =>
    razao(
      noFim("vw_fato_balanco_mes", r, (l) => l.ativoCirculante),
      noFim("vw_fato_balanco_mes", r, (l) => l.passivoCirculante),
    ),
  liquidez_seca: (r) => {
    const circulante = noFim(
      "vw_fato_balanco_mes",
      r,
      (l) => l.ativoCirculante,
    );
    const estoque = noFim("vw_fato_fin_mes", r, (l) => l.estoque);
    if (circulante === null || estoque === null) return null;
    return razao(
      circulante - estoque,
      noFim("vw_fato_balanco_mes", r, (l) => l.passivoCirculante),
    );
  },
  liquidez_imediata: (r) =>
    razao(
      saldoDeCaixaEmReais(r),
      noFim("vw_fato_balanco_mes", r, (l) => l.passivoCirculante),
    ),
  dias_de_caixa: (r) => {
    const saidas = soma("vw_fato_fin_mes", r, (l) => l.saidasDeCaixa);
    if (saidas === null || r.meses.length === 0) return null;
    const porDia = saidas / (r.meses.length * DIAS_NO_MES);
    return razao(saldoDeCaixaEmReais(r), porDia);
  },
  ncg: (r) => emMilhoes(ncgEmReais(r)),
  saldo_de_tesouraria: (r) => {
    const caixa = saldoDeCaixaEmReais(r);
    const curto = noFim("vw_fato_balanco_mes", r, (l) => l.dividaCurtoPrazo);
    return caixa === null || curto === null ? null : emMilhoes(caixa - curto);
  },
  caixa_excedente: (r) => {
    const caixa = saldoDeCaixaEmReais(r);
    const ncg = ncgEmReais(r);
    return caixa === null || ncg === null ? null : emMilhoes(caixa - ncg);
  },

  divida_liquida_sobre_ebitda: (r) => {
    const bruta = dividaBrutaEmReais(r);
    const caixa = saldoDeCaixaEmReais(r);
    if (bruta === null || caixa === null) return null;
    return razao(bruta - caixa, anualizado(ebitdaEmReais(r), r));
  },
  divida_sobre_pl: (r) =>
    razao(
      dividaBrutaEmReais(r),
      noFim("vw_fato_balanco_mes", r, (l) => l.patrimonioLiquido),
    ),
  cobertura_de_juros: (r) =>
    razao(
      ebitEmReais(r),
      soma("vw_fato_balanco_mes", r, (l) => l.jurosPagos),
    ),
  cobertura_do_servico_da_divida: (r) =>
    razao(
      ebitEmReais(r),
      soma(
        "vw_fato_balanco_mes",
        r,
        (l) => l.jurosPagos + l.amortizacaoDeDivida,
      ),
    ),
  custo_medio_da_divida: (r) => emPorcento(custoMedioDaDividaEmFracao(r)),
  custo_liquido_da_divida: (r) => {
    const custo = custoMedioDaDividaEmFracao(r);
    if (custo === null) return null;
    return emPorcento((custo * (CEM - ALIQUOTA_DE_IR_E_CSLL)) / CEM);
  },
  custo_do_prazo_de_recebimento: (r) =>
    custoMensalDeCarregar(
      noFim("vw_fato_contas", r, (l) => l.aReceber),
      r,
    ),
  custo_de_carregar_estoque: (r) =>
    custoMensalDeCarregar(
      noFim("vw_fato_fin_mes", r, (l) => l.estoque),
      r,
    ),
  fluxo_de_caixa_livre: (r) => {
    const fco = soma("vw_fato_fin_mes", r, (l) => l.fco);
    if (fco === null) return null;
    return emMilhoes(fco - (soma("vw_fato_fin_mes", r, (l) => l.capex) ?? 0));
  },
  variacao_de_capital_de_giro: (r) => {
    const operacional = ebitdaEmReais(r);
    if (operacional === null) return null;
    return emMilhoes(
      operacional -
        (soma("vw_fato_balanco_mes", r, (l) => l.jurosPagos) ?? 0) -
        (soma("vw_fato_balanco_mes", r, (l) => l.impostosSobreLucro) ?? 0) -
        (soma("vw_fato_fin_mes", r, (l) => l.fco) ?? 0),
    );
  },

  divida_capital_de_giro: (r) =>
    emMilhoes(
      noFim("vw_fato_divida_mes", r, (l) =>
        l.linha === "capital-de-giro" ? l.saldo : 0,
      ),
    ),
  divida_financiamento_longo_prazo: (r) =>
    emMilhoes(
      noFim("vw_fato_divida_mes", r, (l) =>
        l.linha === "financiamento-longo-prazo" ? l.saldo : 0,
      ),
    ),
  divida_antecipacao_de_recebiveis: (r) =>
    emMilhoes(
      noFim("vw_fato_divida_mes", r, (l) =>
        l.linha === "antecipacao-de-recebiveis" ? l.saldo : 0,
      ),
    ),

  /* ---------------- Natureza das contas (perguntas de CFO, etapa 2) ---------------- */

  custos_fixos: (r) => emMilhoes(custosFixosEmReais(r)),
  custos_variaveis: (r) =>
    emMilhoes(soma("vw_fato_natureza_mes", r, (l) => l.custosVariaveis)),
  margem_de_contribuicao: (r) =>
    emPorcento(razao(margemDeContribuicaoEmReais(r), receita(r))),
  margem_de_contribuicao_valor: (r) =>
    emMilhoes(margemDeContribuicaoEmReais(r)),
  ponto_de_equilibrio: (r) => emMilhoes(pontoDeEquilibrioContabil(r)),
  ponto_de_equilibrio_caixa: (r) =>
    emMilhoes(pontoDeEquilibrioMensal(custosFixosEmReais(r), r)),
  ponto_de_equilibrio_economico: (r) => {
    const contabil = custoContabilACobrir(r);
    const capital = noFim(
      "vw_fato_balanco_mes",
      r,
      (l) =>
        l.patrimonioLiquido +
        l.dividaCurtoPrazo +
        l.dividaLongoPrazo -
        l.aplicacoesFinanceiras,
    );
    if (contabil === null || capital === null) return null;
    // O retorno mínimo do recorte: a taxa anual, na proporção dos meses.
    const retornoMinimo =
      (capital * TAXA_MINIMA_DOS_SOCIOS * r.meses.length) /
      (CEM * MESES_NO_ANO);
    return emMilhoes(pontoDeEquilibrioMensal(contabil + retornoMinimo, r));
  },
  margem_de_seguranca: (r) => {
    const rec = receita(r);
    const equilibrio = pontoDeEquilibrioContabil(r);
    if (rec === null || equilibrio === null || r.meses.length === 0) {
      return null;
    }
    const receitaMensal = rec / r.meses.length;
    return emPorcento(razao(receitaMensal - equilibrio, receitaMensal));
  },
  gao: (r) => razao(margemDeContribuicaoEmReais(r), ebitEmReais(r)),
  resultado_com_receita_10_menor: (r) => {
    const ebit = ebitEmReais(r);
    const contribuicao = margemDeContribuicaoEmReais(r);
    if (ebit === null || contribuicao === null) return null;
    return emMilhoes(ebit - (contribuicao * QUEDA_SIMULADA) / CEM);
  },

  /* ---------------- Qualidade do razão (perguntas de CFO, etapa 2) ---------------- */

  lancamentos_do_mes: (r) =>
    soma("vw_fato_qualidade_mes", r, (l) => l.lancamentos),
  lancamentos_para_revisao: (r) =>
    soma(
      "vw_fato_qualidade_mes",
      r,
      (l) =>
        l.lancamentosForaDoPadrao +
        l.lancamentosEmContaParada +
        l.paresDeEstorno +
        l.lancamentosDeCompetenciaAnterior,
    ),
  valor_para_revisao: (r) =>
    emMilhoes(
      soma(
        "vw_fato_qualidade_mes",
        r,
        (l) =>
          l.valorForaDoPadrao +
          l.valorDeEstornos +
          l.valorDeCompetenciaAnterior,
      ),
    ),
  lancamentos_fora_do_padrao: (r) =>
    soma("vw_fato_qualidade_mes", r, (l) => l.lancamentosForaDoPadrao),
  lancamentos_em_conta_parada: (r) =>
    soma("vw_fato_qualidade_mes", r, (l) => l.lancamentosEmContaParada),
  pares_de_estorno: (r) =>
    soma("vw_fato_qualidade_mes", r, (l) => l.paresDeEstorno),
  lancamentos_de_competencia_anterior: (r) =>
    soma("vw_fato_qualidade_mes", r, (l) => l.lancamentosDeCompetenciaAnterior),
  completude_da_base: (r) => {
    const lacuna = soma(
      "vw_fato_qualidade_mes",
      r,
      (l) =>
        l.valorSemCentroDeCusto + l.valorEmContaGenerica + l.valorSemNatureza,
    );
    const fracao = razao(
      lacuna,
      soma("vw_fato_qualidade_mes", r, (l) => l.valorTotal),
    );
    return fracao === null ? null : emPorcento(1 - fracao);
  },
  valor_sem_centro_de_custo: (r) =>
    emMilhoes(soma("vw_fato_qualidade_mes", r, (l) => l.valorSemCentroDeCusto)),
  valor_em_conta_generica: (r) =>
    emMilhoes(soma("vw_fato_qualidade_mes", r, (l) => l.valorEmContaGenerica)),
  valor_sem_natureza: (r) =>
    emMilhoes(soma("vw_fato_qualidade_mes", r, (l) => l.valorSemNatureza)),
  indicios_de_competencia: (r) =>
    soma(
      "vw_fato_qualidade_mes",
      r,
      (l) =>
        l.contasRecorrentesSemLancamento +
        l.lancamentosDuplicados +
        l.lancamentosDeCompetenciaAnterior,
    ),
  efeito_no_resultado_da_competencia: (r) =>
    emMilhoes(
      soma(
        "vw_fato_qualidade_mes",
        r,
        (l) => l.valorDeCompetenciaAnterior + l.valorDuplicado,
      ),
    ),
  contas_recorrentes_sem_lancamento: (r) =>
    soma("vw_fato_qualidade_mes", r, (l) => l.contasRecorrentesSemLancamento),
  lancamentos_duplicados: (r) =>
    soma("vw_fato_qualidade_mes", r, (l) => l.lancamentosDuplicados),
  contas_com_classificacao_inconsistente: (r) =>
    soma(
      "vw_fato_qualidade_mes",
      r,
      (l) => l.contasComClassificacaoInconsistente,
    ),
  valor_em_classificacao_inconsistente: (r) =>
    emMilhoes(
      soma(
        "vw_fato_qualidade_mes",
        r,
        (l) => l.valorEmClassificacaoInconsistente,
      ),
    ),
  movimentacao_com_partes_relacionadas: (r) =>
    emMilhoes(
      soma(
        "vw_fato_qualidade_mes",
        r,
        (l) => l.movimentacaoComPartesRelacionadas,
      ),
    ),
  roe_sem_partes_relacionadas: (r) =>
    emPorcento(
      razao(
        lucroLiquidoEmReais(r),
        noFim(
          "vw_fato_balanco_mes",
          r,
          (l) => l.patrimonioLiquido - l.mutuoComSocios,
        ),
      ),
    ),
  mutuo_com_socios: (r) =>
    emMilhoes(noFim("vw_fato_balanco_mes", r, (l) => l.mutuoComSocios)),
  receita_dos_principais_clientes: (r) =>
    emMilhoes(soma("vw_fato_faturamento_cliente", r, (l) => l.receita)),

  /* ---------------- Integração (T-116) ---------------- */

  receita_por_fte: (r) =>
    emMilhoes(
      razao(
        soma("vw_fato_fin_mes", r, (l) => l.receitaLiquida),
        noFim("vw_fato_rh_mes", r, (l) => l.headcountFte),
      ),
    ),

  ebitda_por_fte: (r) =>
    emMilhoes(
      razao(
        ebitdaEmReais(r),
        noFim("vw_fato_rh_mes", r, (l) => l.headcountFte),
      ),
    ),

  folha_sobre_receita: (r) =>
    emPorcento(
      razao(
        soma("vw_fato_rh_mes", r, (l) => l.folhaReais),
        receita(r),
      ),
    ),
};

/* ------------------------------------------------------------------ *
 * O delta
 * ------------------------------------------------------------------ */

/**
 * A janela imediatamente anterior, do mesmo tamanho, dentro do ano.
 *
 * Dezembro compara com novembro; o 4º trimestre com o 3º; os últimos 6 meses
 * com os 6 primeiros. Para o recorte de 12 meses não há doze meses anteriores
 * dentro do ano, e a comparação natural — o mesmo período do ano passado —
 * espera 2025 entrar na fixture com T-152.
 *
 * Devolve `null` nesse caso, e `null` não é zero: zero afirmaria que o número
 * não mudou.
 */
export function janelaAnterior(q: Query): readonly string[] | null {
  const quantos = MESES_DO_PERIODO[q.periodo];
  if (quantos === undefined) return null;
  const ano = mesesDe(q.ano);
  const inicio = ano.length - quantos * 2;
  if (inicio < 0) return null;
  return ano.slice(inicio, ano.length - quantos);
}

/**
 * A variação contra a janela anterior, na unidade do próprio número.
 *
 * Taxa varia em **pontos percentuais** — diferença — e não em percentual da
 * taxa. Dizer que o turnover "subiu 30%" quando foi de 14% para 18,4% é errado:
 * subiu 4,4 p.p. É a mesma distinção que `variacao` em `agregacao.ts` faz, e a
 * razão de o delta ser sempre uma subtração aqui.
 */
function delta(metrica: string, r: Recorte, atual: number | null) {
  if (atual === null) return null;
  const meses = janelaAnterior(r.q);
  if (meses === null || meses.length === 0) return null;

  const calculo = CALCULO[metrica];
  if (calculo === undefined) return null;

  const anterior = calculo({ ...r, meses });
  return anterior === null ? null : atual - anterior;
}

/* ------------------------------------------------------------------ *
 * O envelope
 * ------------------------------------------------------------------ */

/** O sentimento, do sentido declarado da métrica e do sinal da variação. */
function sentimento(
  sentido: Sentido,
  variacao: number | null,
): Kpi["sentiment"] {
  if (variacao === null || variacao === 0 || sentido === "neutro") {
    return "neutral";
  }
  const bom = sentido === "maior_melhor" ? variacao > 0 : variacao < 0;
  return bom ? "good" : "bad";
}

/**
 * O envelope de **um** KPI. Exportado para que o guarda de origem continue
 * testável: agora que as 13 telas têm origem declarada, não há mais tela que
 * sirva de exemplo de falta, e o caso precisa de um registro sintético.
 */
export function calcularKpi(registro: RegistroDeKpi, q: Query): Kpi {
  return montar(registro, recorteDe(q));
}

function montar(registro: RegistroDeKpi, r: Recorte): Kpi {
  const origem = origemDoKpi(registro.id);
  if (origem === undefined) throw new KpiSemOrigem(registro.id);

  const calculo = CALCULO[origem.metrica];
  if (calculo === undefined) {
    throw new MetricaSemCalculo(origem.metrica, registro.id);
  }

  const valor = calculo(r);
  const variacao = delta(origem.metrica, r, valor);

  return {
    id: registro.id,
    label: registro.rotulo,
    value: valor,
    unit: registro.unidade ?? "contagem",
    delta: variacao,
    sentiment: sentimento(registro.sentido, variacao),
    rodape: registro.rodape ?? "",
    serie: serieDoKpi(calculo, r),
  };
}

/**
 * A série do sparkline: a métrica avaliada mês a mês, com o mesmo cálculo.
 *
 * Não há tabela de séries nem fórmula paralela. Cada ponto é `calculo`
 * rodando num recorte de um mês só, com os mesmos filtros dimensionais — o que
 * garante, por construção, que a linha e o número não podem divergir de
 * definição. Se alguém corrigir a fórmula do turnover, o traço corrige junto.
 *
 * ## O que a série NÃO é
 *
 * Ela é o valor **de cada mês**, e não a janela do KPI deslizando mês a mês.
 * Para métrica de fluxo acumulada na janela — turnover de 12 meses, por
 * exemplo — o último ponto vale menos que o número grande do cartão, porque um
 * mês acumula menos que doze. As duas leituras são defensáveis e a escolha é
 * de Produto, não minha: está registrada como H-51 em INSTRUCOES.md. Enquanto
 * não houver resposta, vale a leitura mensal, que é a que o protótipo desenha
 * (doze pontos ao longo do ano) e a que não inventa janela que ninguém pediu.
 */
function serieDoKpi(
  calculo: (r: Recorte) => number | null,
  r: Recorte,
): readonly (number | null)[] {
  return r.meses.map((mes) => calculo({ ...r, meses: [mes] }));
}

/**
 * Os KPIs de uma tela, no recorte pedido. Serve as 13.
 *
 * A ordem é a do registro, que é a do protótipo. A seção 5 do PRD limita a seis
 * por tela e o registro já obedece — aqui não há corte, porque cortar em
 * silêncio esconderia um registro que cresceu demais.
 */
export function calcularKpis(tela: string, q: Query): readonly Kpi[] {
  const r = recorteDe(q);
  return kpisDaTela(tela).map((registro) => montar(registro, r));
}

/** As métricas que sabem se calcular. Serve à conferência de cobertura. */
export function metricasComCalculo(): readonly string[] {
  return Object.keys(CALCULO);
}

/**
 * O cálculo de uma métrica do catálogo, para quem não é cartão.
 *
 * O painel que mostra a mesma medida do cartão usa **esta** função, e não uma
 * cópia da fórmula. Corrigir o turnover num lugar corrige nos dois, e nenhuma
 * tela pode passar a exibir dois números para a mesma coisa.
 */
export function calculoDaMetrica(metrica: string): Calculo | undefined {
  return CALCULO[metrica];
}
