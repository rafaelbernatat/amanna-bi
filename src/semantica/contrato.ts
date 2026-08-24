/**
 * O contrato de dados: as seis formas que atravessam as três camadas (T-101).
 *
 * PRD seção 9.1 e 9.3. Este módulo é o vocabulário comum — apresentação,
 * semântica e acesso falam todas por aqui. Por isso ele **não importa React nem
 * Next**, e um teste de grafo reprova se alguém importar: no dia em que o
 * contrato depender da interface, o princípio PR-1 morre, porque "trocar dado
 * fictício por banco real é substituir um adaptador" deixa de ser verdade.
 *
 * Mora em `semantica` de propósito. A *interface* `DataSource` é contrato; a
 * *implementação* é da camada de acesso. Declarar aqui e implementar lá é o que
 * deixa a apresentação depender da forma, nunca da fonte.
 *
 * O ano não aparece como literal de tipo. Isso é a decisão **D-P8**
 * (`docs/decisoes/D-P8-filtro-ano.md`): a lista de anos vem de `getMeta`, e um
 * ano é aceito porque o dado existe, não porque alguém o digitou num union.
 */

import { codigosDe } from "@/semantica/dimensoes";
import type { PanelResponse, Serie } from "@/semantica/painel";
import type { Dimensoes } from "@/semantica/recortes";

/* ------------------------------------------------------------------ *
 * Os domínios fechados da seção 6.2 do PRD
 *
 * Declarados como vetor `as const` e derivados em tipo, e não escritos duas
 * vezes: a contagem que o teste confere é a do mesmo vetor que a interface usa.
 * ------------------------------------------------------------------ */

/**
 * Os quatro períodos, seis entidades... — os **códigos** (T-186).
 *
 * O valor de domínio é o código canônico: ASCII, minúsculo, com hífen. O rótulo
 * acentuado que a tela mostra ("4º trimestre", "Híbrido") vive em
 * `dimensoes.ts`, e é buscado por `rotuloDe`.
 *
 * Antes de T-186 estes literais eram as duas coisas, e por isso apareciam sem
 * acento — a barra de filtros mostraria "Operacoes".
 */

export const PERIODOS = codigosDe("periodo") as readonly [
  "12-meses",
  "6-meses",
  "4-trimestre",
  "dezembro",
];

export const ENTIDADES = codigosDe("entidade") as readonly [
  "consolidado",
  "unidade-sp",
  "demais-unidades",
];

export const AREAS = codigosDe("area") as readonly [
  "todas",
  "operacoes",
  "comercial",
  "tecnologia",
  "logistica",
  "financeiro",
  "marketing",
  "rh",
];

export const MODALIDADES = codigosDe("modalidade") as readonly [
  "todas",
  "presencial",
  "hibrido",
  "remoto",
];

export type Periodo = (typeof PERIODOS)[number];
export type Entidade = (typeof ENTIDADES)[number];
export type Area = (typeof AREAS)[number];
export type Modalidade = (typeof MODALIDADES)[number];

/**
 * O ano do recorte.
 *
 * `string` e não union por decisão, não por preguiça (D-P8). Quem recusa um ano
 * inválido é `anoValido()` contra o que `getMeta` declarou — assim o cliente
 * carrega 2027 na réplica e o filtro passa a oferecer 2027, sem editar tipo,
 * sem recompilar e sem imagem nova.
 */
export type Ano = string;

/** Os cinco filtros globais da seção 6.2. Toda leitura passa por aqui. */
export type Query = {
  readonly periodo: Periodo;
  readonly ano: Ano;
  readonly entidade: Entidade;
  readonly area: Area;
  readonly modalidade: Modalidade;
};

/** Os padrões da tabela 6.2 — o recorte consolidado. */
export const QUERY_PADRAO: Query = {
  periodo: "12-meses",
  ano: "2026",
  entidade: "consolidado",
  area: "todas",
  modalidade: "todas",
};

/* ------------------------------------------------------------------ *
 * Unidade e agregação (seção 9.2, regras 2 e 4)
 * ------------------------------------------------------------------ */

/**
 * Enum fechado: todo valor volta com unidade declarada (regra 2).
 *
 * Nove valores desde 2026-08-24. As quatro últimas entraram por decisão de
 * Produto ([D-H45](../../docs/decisoes/D-H45-unidades.md)): cinco painéis e
 * treze KPIs do protótipo medem horas, contagem, pontos de eNPS e anos de tempo
 * de casa, e nenhuma das cinco originais os nomeia sem afirmar algo falso.
 *
 * Fechado continua sendo o ponto: uma unidade nova entra por decisão
 * registrada, nunca por digitação.
 */
export const UNIDADES = [
  "BRL_mi",
  "pct",
  "pp",
  "dias",
  "FTE",
  "horas",
  "contagem",
  "pontos",
  "anos",
] as const;
export type Unidade = (typeof UNIDADES)[number];

/**
 * Como a medida se comporta ao longo do período (regra 4).
 *
 * `ratio` recomputa numerador e denominador; `last` pega o último mês do
 * recorte. É o que impede um recorte de 3 meses de somar percentuais.
 */
export const AGREGACOES = ["sum", "last", "ratio"] as const;
export type Agregacao = (typeof AGREGACOES)[number];

/** Para onde o número aponta quando sobe. */
export type Sentido = "maior_melhor" | "menor_melhor" | "neutro";

/* ------------------------------------------------------------------ *
 * As quatro portas de leitura (seção 9.1)
 * ------------------------------------------------------------------ */

/** Frescor do dado: o selo da seção 10.2, que a tela sempre mostra. */
export type Frescor = {
  /** Data do último fechamento carregado, em ISO. */
  readonly asOf: string;
  /** Instante do último sync bem-sucedido, em ISO. */
  readonly sincronizadoEm: string;
  /** Passou do limite acordado e o selo vira aviso (RF-10). */
  readonly defasado: boolean;
};

/** O que `getMeta()` devolve: dimensões, catálogo e frescor. */
export type Meta = {
  /** As dimensões disponíveis — inclusive quais anos existem (D-P8). */
  readonly dimensoes: Dimensoes;
  /** Ids das métricas do catálogo disponíveis nesta instalação. */
  readonly metricas: readonly string[];
  readonly frescor: Frescor;
};

/** Um cartão de KPI. O valor vem daqui e de lugar nenhum mais (RF-07). */
export type Kpi = {
  readonly id: string;
  readonly label: string;
  /** Nulo quando o recorte não tem dado — nunca zero (princípio PR-4). */
  readonly value: number | null;
  readonly unit: Unidade;
  /** Variação contra o período de comparação, na unidade `pp` ou `pct`. */
  readonly delta: number | null;
  readonly sentiment: "good" | "bad" | "neutral";
  readonly rodape: string;
  /**
   * A série do sparkline: um ponto por mês da janela do recorte.
   *
   * Faltava, e a falta era do tipo que passa despercebida porque nada quebra.
   * O protótipo desenha um sparkline em cada cartão a partir de um vetor
   * `sv` escrito à mão junto do número, e T-131 exige que ele venha de
   * `getKpis` como o valor e o delta vêm — senão é o achado 5 outra vez, só
   * que em forma de linha em vez de em forma de número.
   *
   * Cada ponto é a **mesma métrica com a mesma fórmula**, avaliada num mês só.
   * Ponto nulo é mês sem dado no recorte, e desenha lacuna: princípio PR-4
   * vale para o traço tanto quanto para o número.
   */
  readonly serie: readonly (number | null)[];
};

/**
 * O envelope de painel da seção 9.3, nas doze formas do Anexo A.1.
 *
 * Mora em `painel.ts` porque são doze variantes e o contrato ficaria ilegível
 * com elas dentro. Reexportado aqui para que a fronteira do contrato continue
 * sendo um arquivo só: quem consome importa de `contrato`, e não precisa saber
 * onde a união foi escrita (T-102).
 */
export type {
  CargaCartesiana,
  EnvelopeBase,
  Forma,
  PainelBarras,
  PainelBarrasEmpilhadas,
  PainelBarrasHorizontais,
  PainelCascata,
  PainelDaForma,
  PainelDispersao,
  PainelDivisao,
  PainelEstatisticas,
  PainelFunil,
  PainelLinha,
  PainelMosaicoGeografico,
  PainelReguaDeCiclo,
  PainelRosca,
  PanelResponse,
  PapelDeSerie,
  Parte,
  Serie,
} from "@/semantica/painel";

export { FORMAS, formaValida, QUANTIDADE_DE_FORMAS } from "@/semantica/painel";

/** Um número só, com a fórmula e a série que o sustentam (seção 9.1). */
export type MetricValue = {
  readonly id: string;
  readonly value: number | null;
  readonly unit: Unidade;
  readonly formula: string;
  readonly agg: Agregacao;
  readonly sentido: Sentido;
  /** A série mensal por trás do número, para o gráfico do chat. */
  readonly serie: Serie;
  readonly asOf: string;
};

/**
 * A única forma de ler dado no produto (seção 9.1, princípio PR-1).
 *
 * Trocar `DATA_SOURCE=fixtures` por `=warehouse` troca a implementação desta
 * interface e mais nada. Nenhuma tela muda — é isso que a suíte de contrato
 * prova ao rodar idêntica nos dois modos (RF-21).
 */
export interface DataSource {
  getMeta(): Promise<Meta>;
  getKpis(view: string, q: Query): Promise<readonly Kpi[]>;
  getPanel(id: string, q: Query): Promise<PanelResponse>;
  getMetric(id: string, q: Query): Promise<MetricValue>;
}
