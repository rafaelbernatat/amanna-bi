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
function pertence(
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

/** As linhas de uma view no recorte. */
function linhas<N extends NomeDeView>(
  view: N,
  r: Recorte,
): readonly (typeof VIEWS)[N][number][] {
  const todas = VIEWS[view] as readonly (typeof VIEWS)[N][number][];
  return todas.filter((l) => pertence(l, r));
}

/** A soma de uma medida no recorte. `null` quando não há linha (PR-4). */
function soma<N extends NomeDeView>(
  view: N,
  r: Recorte,
  medida: (l: (typeof VIEWS)[N][number]) => number,
): number | null {
  const escolhidas = linhas(view, r);
  return escolhidas.length === 0 ? null : somar(escolhidas, medida);
}

/** A soma no **último mês** da janela — o que `agg: last` significa. */
function noFim<N extends NomeDeView>(
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
function mediaMensal(
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
function razao(numerador: number | null, denominador: number | null) {
  if (numerador === null || denominador === null || denominador === 0) {
    return null;
  }
  return numerador / denominador;
}

/** Multiplica por 100, preservando a ausência. */
function emPorcento(fracao: number | null): number | null {
  return fracao === null ? null : fracao * CEM;
}

/** O quadro por atributo de perfil, no fim da janela. */
function perfil(
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
function emMilhoes(reais: number | null): number | null {
  return reais === null ? null : reais / UM_MILHAO;
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

  custo_do_turnover: (r) =>
    emMilhoes(
      soma(
        "vw_fato_rh_mes",
        r,
        (l) => l.custoDeReposicao + l.custoDeDesligamento,
      ),
    ),

  custo_de_reposicao: (r) =>
    emMilhoes(soma("vw_fato_rh_mes", r, (l) => l.custoDeReposicao)),

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
  };
}

/**
 * Os KPIs de uma tela, no recorte pedido.
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
