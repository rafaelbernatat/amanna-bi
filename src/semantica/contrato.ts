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

import type { Dimensoes } from "@/semantica/recortes";

/* ------------------------------------------------------------------ *
 * Os domínios fechados da seção 6.2 do PRD
 *
 * Declarados como vetor `as const` e derivados em tipo, e não escritos duas
 * vezes: a contagem que o teste confere é a do mesmo vetor que a interface usa.
 * ------------------------------------------------------------------ */

export const PERIODOS = [
  "12 meses",
  "6 meses",
  "4º trimestre",
  "Dezembro",
] as const;

export const ENTIDADES = [
  "Consolidado",
  "Unidade SP",
  "Demais unidades",
] as const;

export const AREAS = [
  "Todas",
  "Operacoes",
  "Comercial",
  "Tecnologia",
  "Logistica",
  "Financeiro",
  "Marketing",
  "RH",
] as const;

export const MODALIDADES = [
  "Todas",
  "Presencial",
  "Hibrido",
  "Remoto",
] as const;

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
  periodo: "12 meses",
  ano: "2026",
  entidade: "Consolidado",
  area: "Todas",
  modalidade: "Todas",
};

/* ------------------------------------------------------------------ *
 * Unidade e agregação (seção 9.2, regras 2 e 4)
 * ------------------------------------------------------------------ */

/** Enum fechado: todo valor volta com unidade declarada (regra 2). */
export const UNIDADES = ["BRL_mi", "pct", "pp", "dias", "FTE"] as const;
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
};

/** Uma série de um painel. */
export type Serie = {
  readonly name: string;
  /** Um valor por categoria, na mesma ordem de `categories`. */
  readonly values: readonly (number | null)[];
};

/** O envelope de painel da seção 9.3. */
export type PanelResponse = {
  readonly id: string;
  readonly title: string;
  readonly unit: Unidade;
  /** Obrigatória e não configurável em painel derivado (RF-04, PR-3). */
  readonly formula: string;
  readonly categories: readonly string[];
  readonly series: readonly Serie[];
  readonly total: number | null;
  /** Leitura em prosa; nula quando não vale para o recorte (RF-09). */
  readonly note: string | null;
  readonly asOf: string;
};

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
