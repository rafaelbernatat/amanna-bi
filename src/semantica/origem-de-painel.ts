/**
 * De onde cada painel tira número, e o que ele desenha (T-117.2, T-117).
 *
 * ## Por que este arquivo existe
 *
 * O registro de T-107 diz o que cada painel **é** — tela, forma, span, unidade.
 * Não diz de onde ele tira número. Enquanto essa ligação não estava escrita em
 * lugar nenhum, era impossível responder mecanicamente à pergunta que importa:
 * *existe algum painel que ninguém sabe alimentar?*
 *
 * A resposta era sim, e eram dois. `tov-custo` decompõe o custo do turnover em
 * quatro componentes que não existiam em view nenhuma, e `fat-risco` reparte a
 * carteira por um rating que não era atributo de cliente nenhum. Os dois
 * passaram despercebidos porque o levantamento de T-143 percorreu as medidas
 * dos **KPIs** do achado 5 — e nenhum dos dois é KPI.
 *
 * Com o mapa escrito, a pergunta vira um teste, e o próximo painel que entrar
 * sem fonte reprova o CI em vez de aparecer vazio numa demonstração.
 *
 * ## Nomes de view são texto aqui, de propósito
 *
 * `src/semantica` não importa de `src/acesso` — a camada de contrato não pode
 * depender de quem implementa. Então os nomes são `string`, e um teste confere
 * que cada um existe de fato no adaptador. É a checagem mais forte das duas
 * possíveis: um tipo garantiria que o nome está bem escrito, o teste garante
 * que a view **existe**.
 *
 * ## A fórmula mora aqui, e não no componente
 *
 * Todo painel declara a sua, obrigatória e não vazia (T-109, princípio PR-3).
 * Ela é do painel, não do desenho: quem trocar a forma de barras para linha não
 * muda como o número foi obtido, e não deveria ter como mudar o texto que o diz.
 */

import type { Unidade } from "@/semantica/contrato";
import { formula, type Formula, type PapelDeSerie } from "@/semantica/painel";

/**
 * O que as categorias de um painel enumeram.
 *
 * `mes` é a maioria e é o único eixo que responde ao recorte de período — os
 * demais enumeram um conjunto que não depende da janela. Essa distinção é o que
 * o teste de "categorias respeitam o recorte" precisa saber para não exigir de
 * um aging que ele encolha quando alguém escolhe três meses.
 */
export type EixoDePainel =
  | "mes"
  | "dia-util"
  | "ano"
  | "area"
  | "cargo"
  | "categoria-de-enps"
  | "centro-de-custo"
  | "componente"
  | "componente-da-folha"
  | "contraparte"
  | "corte-de-turnover"
  | "escolaridade"
  | "estatistica"
  | "faixa-de-aging"
  | "faixa-de-rating"
  | "faixa-de-tempo-de-casa"
  | "faixa-etaria"
  | "faixa-salarial"
  | "fonte-de-candidato"
  | "genero"
  | "grupo-de-perfil"
  | "modalidade-de-trilha"
  | "natureza-de-saida"
  | "passo-do-funil"
  | "segmento"
  | "status-de-vaga"
  | "tipo-de-saida"
  | "uf";

/** Os eixos cujas categorias são a janela de tempo do recorte. */
export const EIXOS_TEMPORAIS: readonly EixoDePainel[] = ["mes", "dia-util"];

/** Uma série declarada do painel: o que ela mede e em que unidade. */
export type SerieDeclarada = {
  readonly nome: string;
  /**
   * A unidade **desta** série.
   *
   * Não é redundante com `EnvelopeBase.unit`. Sete dos 31 painéis põem duas
   * medidas no mesmo desenho — folha em R$ e quadro em FTE, horas e
   * participação em % — e o envelope só declara a unidade do eixo principal.
   * Sem unidade por série, a apresentação formataria FTE como reais.
   */
  readonly unidade: Unidade;
  readonly papel: PapelDeSerie;
  /**
   * A fórmula **deste** número, quando ele tem uma própria.
   *
   * Só os painéis de `estatisticas` usam: ali cada número é de uma medida
   * diferente, e o princípio PR-3 vale por número e não por painel. Nas demais
   * formas a fórmula do painel serve a todas as séries, e este campo é nulo.
   */
  readonly formulaPropria: Formula | null;
};

export type OrigemDePainel = {
  readonly painel: string;
  readonly views: readonly string[];
  /** Por que este painel precisa de mais de uma view, quando precisa. */
  readonly cruzamento: string | null;
  readonly eixo: EixoDePainel;
  readonly formula: Formula;
  readonly series: readonly SerieDeclarada[];
};

/** Atalho: uma série de valor. */
function valor(nome: string, unidade: Unidade): SerieDeclarada {
  return { nome, unidade, papel: "valor", formulaPropria: null };
}

/** Atalho: uma linha de referência — meta, zona, média. */
function referencia(nome: string, unidade: Unidade): SerieDeclarada {
  return { nome, unidade, papel: "referencia", formulaPropria: null };
}

/** Atalho: um número de painel de estatísticas, com fórmula própria. */
function estatistica(
  nome: string,
  unidade: Unidade,
  texto: string,
): SerieDeclarada {
  return {
    nome,
    unidade,
    papel: "valor",
    formulaPropria: formula(texto, nome),
  };
}

/**
 * Os 31 painéis de barras, linha e barras empilhadas.
 *
 * As outras formas — barras horizontais, rosca, funil, divisão, estatísticas,
 * cascata, dispersão, régua e mosaico — entram com T-118 e T-119, e o teste de
 * cobertura cresce junto.
 */
export const ORIGEM_DOS_PAINEIS: readonly OrigemDePainel[] = [
  /* ---------------------------------------------------------------- *
   * rh/visao
   * ---------------------------------------------------------------- */
  {
    painel: "rh-headcount",
    views: ["vw_fato_rh_mes"],
    cruzamento: null,
    eixo: "mes",
    formula: formula(
      "barras = admissões e desligamentos do mês; linha = headcount FTE no fim do mês",
      "rh-headcount",
    ),
    series: [
      valor("Admissões", "contagem"),
      valor("Desligamentos", "contagem"),
      valor("Headcount (FTE)", "FTE"),
    ],
  },
  {
    painel: "rh-turnover",
    views: ["vw_fato_rh_mes"],
    cruzamento: null,
    eixo: "mes",
    formula: formula(
      "turnover = desligamentos do mês ÷ headcount médio do mês",
      "rh-turnover",
    ),
    series: [valor("Turnover", "pct"), referencia("Meta anual", "pct")],
  },
  {
    painel: "rh-retencao",
    views: ["vw_fato_rh_mes"],
    cruzamento: null,
    eixo: "mes",
    formula: formula(
      "saldo = admissões − desligamentos do mês; retenção = 100% − turnover",
      "rh-retencao",
    ),
    series: [valor("Saldo líquido", "contagem"), valor("Retenção", "pct")],
  },
  {
    painel: "rh-folha",
    views: ["vw_fato_rh_mes"],
    cruzamento: null,
    eixo: "mes",
    formula: formula(
      "folha do mês; custo por colaborador = folha × 12 ÷ headcount FTE",
      "rh-folha",
    ),
    series: [
      valor("Folha mensal", "BRL_mi"),
      valor("Custo por FTE (ano)", "BRL_mi"),
    ],
  },

  /* ---------------------------------------------------------------- *
   * rh/colab
   * ---------------------------------------------------------------- */
  {
    painel: "col-tempo",
    views: ["vw_fato_rh_perfil"],
    cruzamento: null,
    eixo: "faixa-de-tempo-de-casa",
    formula: formula(
      "headcount FTE por faixa de tempo de casa, no último mês do recorte",
      "col-tempo",
    ),
    series: [valor("FTE", "FTE")],
  },

  /* ---------------------------------------------------------------- *
   * rh/turnover
   * ---------------------------------------------------------------- */
  {
    painel: "tov-12m",
    views: ["vw_fato_rh_mes"],
    cruzamento: null,
    eixo: "mes",
    formula: formula(
      "turnover = desligamentos do mês ÷ headcount médio do mês",
      "tov-12m",
    ),
    series: [valor("Turnover", "pct"), referencia("Meta anual", "pct")],
  },
  {
    painel: "tov-custo",
    views: ["vw_fato_turnover_custo"],
    cruzamento: null,
    eixo: "componente",
    formula: formula(
      "custo do turnover = rescisão + recrutamento + ramp-up + produtividade perdida",
      "tov-custo",
    ),
    series: [valor("Custo", "BRL_mi")],
  },

  /* ---------------------------------------------------------------- *
   * rh/recrut
   * ---------------------------------------------------------------- */
  {
    painel: "rec-dias",
    views: ["vw_fato_vagas"],
    cruzamento: null,
    eixo: "mes",
    formula: formula(
      "dias médios = dias somados até o aceite ÷ vagas fechadas no mês",
      "rec-dias",
    ),
    series: [valor("Dias", "dias"), referencia("Meta", "dias")],
  },
  {
    painel: "rec-vagas",
    views: ["vw_fato_vagas"],
    cruzamento: null,
    eixo: "area",
    formula: formula(
      "vagas por status, somadas no recorte e quebradas por área",
      "rec-vagas",
    ),
    series: [
      valor("Abertas", "contagem"),
      valor("Em andamento", "contagem"),
      valor("Fechadas", "contagem"),
    ],
  },

  /* ---------------------------------------------------------------- *
   * rh/trein
   * ---------------------------------------------------------------- */
  {
    painel: "tre-horas",
    views: ["vw_fato_treinamento", "vw_fato_rh_mes"],
    cruzamento:
      "as horas vêm do LMS e a participação precisa do quadro como denominador; " +
      "contar participantes dentro do LMS contaria a mesma pessoa uma vez por trilha",
    eixo: "mes",
    formula: formula(
      "horas realizadas no mês; participação = participantes ÷ headcount FTE",
      "tre-horas",
    ),
    series: [valor("Horas", "horas"), valor("Participação", "pct")],
  },

  /* ---------------------------------------------------------------- *
   * rh/engaj
   * ---------------------------------------------------------------- */
  {
    painel: "eng-enps",
    views: ["vw_fato_rh_mes"],
    cruzamento: null,
    eixo: "mes",
    formula: formula(
      "eNPS = (promotores − detratores) ÷ respondentes × 100",
      "eng-enps",
    ),
    series: [valor("eNPS", "pontos"), referencia("Zona favorável", "pontos")],
  },
  {
    painel: "eng-eng",
    views: ["vw_fato_rh_mes"],
    cruzamento: null,
    eixo: "mes",
    formula: formula(
      "engajamento = pontos da pesquisa ÷ respondentes",
      "eng-eng",
    ),
    series: [valor("Engajamento", "pct")],
  },
  {
    painel: "eng-abs",
    views: ["vw_fato_rh_mes"],
    cruzamento: null,
    eixo: "mes",
    formula: formula(
      "absenteísmo = horas ausentes ÷ horas previstas × 100",
      "eng-abs",
    ),
    series: [valor("Absenteísmo", "pct")],
  },

  /* ---------------------------------------------------------------- *
   * rh/sal
   * ---------------------------------------------------------------- */
  {
    painel: "sal-faixas",
    views: ["vw_fato_rh_perfil"],
    cruzamento: null,
    eixo: "faixa-salarial",
    formula: formula(
      "headcount FTE por faixa salarial, no último mês do recorte",
      "sal-faixas",
    ),
    series: [valor("FTE", "FTE")],
  },

  /* ---------------------------------------------------------------- *
   * fin/visao
   * ---------------------------------------------------------------- */
  {
    painel: "fin-receita",
    views: ["vw_fato_fin_mes"],
    cruzamento: null,
    eixo: "mes",
    formula: formula(
      "receita líquida do mês, contra o mesmo mês do ano anterior",
      "fin-receita",
    ),
    series: [valor("Ano atual", "BRL_mi"), valor("Ano anterior", "BRL_mi")],
  },
  {
    painel: "fin-margens",
    views: ["vw_fato_fin_mes"],
    cruzamento: null,
    eixo: "mes",
    formula: formula(
      "margens do mês sobre a receita líquida: bruta, EBITDA e líquida",
      "fin-margens",
    ),
    series: [
      valor("Bruta", "pct"),
      valor("EBITDA", "pct"),
      valor("Líquida", "pct"),
    ],
  },
  {
    painel: "fin-ebitda",
    views: ["vw_fato_fin_mes"],
    cruzamento: null,
    eixo: "mes",
    formula: formula("EBITDA do mês contra o FCO do mês", "fin-ebitda"),
    series: [valor("EBITDA", "BRL_mi"), valor("FCO", "BRL_mi")],
  },

  /* ---------------------------------------------------------------- *
   * fin/caixa
   * ---------------------------------------------------------------- */
  {
    painel: "cx-diario",
    views: ["vw_fato_caixa_diario"],
    cruzamento: null,
    eixo: "dia-util",
    formula: formula(
      "fluxo líquido do dia = entradas − saídas, por dia útil",
      "cx-diario",
    ),
    series: [valor("Fluxo líquido do dia", "BRL_mi")],
  },
  {
    painel: "cx-saldo",
    views: ["vw_fato_fin_mes"],
    cruzamento: null,
    eixo: "mes",
    formula: formula("saldo de caixa no fechamento de cada mês", "cx-saldo"),
    series: [valor("Saldo", "BRL_mi")],
  },
  {
    painel: "cx-fluxo",
    views: ["vw_fato_fin_mes"],
    cruzamento: null,
    eixo: "mes",
    formula: formula(
      "entradas e saídas do mês; linha = saldo acumulado no fechamento",
      "cx-fluxo",
    ),
    series: [
      valor("Entradas", "BRL_mi"),
      valor("Saídas", "BRL_mi"),
      valor("Saldo acumulado", "BRL_mi"),
    ],
  },

  /* ---------------------------------------------------------------- *
   * fin/orc
   * ---------------------------------------------------------------- */
  {
    painel: "orc-vs",
    views: ["vw_fato_orcamento"],
    cruzamento: null,
    eixo: "mes",
    formula: formula("orçado e realizado do mês, lado a lado", "orc-vs"),
    series: [valor("Orçado", "BRL_mi"), valor("Realizado", "BRL_mi")],
  },
  {
    painel: "orc-desvio",
    views: ["vw_fato_orcamento"],
    cruzamento: null,
    eixo: "centro-de-custo",
    formula: formula(
      "desvio = realizado − orçado no recorte, por centro de custo",
      "orc-desvio",
    ),
    series: [valor("Desvio", "BRL_mi")],
  },
  {
    painel: "orc-acum",
    views: ["vw_fato_orcamento"],
    cruzamento: null,
    eixo: "mes",
    formula: formula(
      "orçado e realizado acumulados do início do recorte até cada mês",
      "orc-acum",
    ),
    series: [
      valor("Orçado acumulado", "BRL_mi"),
      valor("Realizado acumulado", "BRL_mi"),
    ],
  },

  /* ---------------------------------------------------------------- *
   * fin/contas
   * ---------------------------------------------------------------- */
  {
    painel: "cr-aging",
    views: ["vw_fato_contas"],
    cruzamento: null,
    eixo: "faixa-de-aging",
    formula: formula(
      "saldo a receber por faixa de vencimento, no último mês do recorte",
      "cr-aging",
    ),
    series: [valor("A receber", "BRL_mi")],
  },
  {
    painel: "cp-aging",
    views: ["vw_fato_contas"],
    cruzamento: null,
    eixo: "faixa-de-aging",
    formula: formula(
      "saldo a pagar por faixa de vencimento, no último mês do recorte",
      "cp-aging",
    ),
    series: [valor("A pagar", "BRL_mi")],
  },

  /* ---------------------------------------------------------------- *
   * fin/fat
   * ---------------------------------------------------------------- */
  {
    painel: "fat-evolucao",
    views: ["vw_fato_fin_mes"],
    cruzamento: null,
    eixo: "mes",
    formula: formula(
      "faturamento do mês, contra o mesmo mês do ano anterior",
      "fat-evolucao",
    ),
    series: [valor("Ano atual", "BRL_mi"), valor("Ano anterior", "BRL_mi")],
  },
  {
    painel: "fat-risco",
    views: ["vw_fato_faturamento_cliente"],
    cruzamento: null,
    eixo: "ano",
    formula: formula(
      "participação de cada faixa de rating na receita da carteira",
      "fat-risco",
    ),
    series: [
      valor("AAA-A", "pct"),
      valor("BBB", "pct"),
      valor("BB", "pct"),
      valor("B ou inferior", "pct"),
    ],
  },

  /* ---------------------------------------------------------------- *
   * int/cruz — os quatro cruzam RH com Financeiro, que é o que a tela é
   * ---------------------------------------------------------------- */
  {
    painel: "int-rpc",
    views: ["vw_fato_fin_mes", "vw_fato_rh_mes"],
    cruzamento: "receita sobre quadro: numerador financeiro, denominador de RH",
    eixo: "mes",
    formula: formula(
      "receita por colaborador = receita do mês × 12 ÷ headcount FTE",
      "int-rpc",
    ),
    series: [valor("Receita por FTE", "BRL_mi")],
  },
  {
    painel: "int-ebitda-pc",
    views: ["vw_fato_fin_mes", "vw_fato_rh_mes"],
    cruzamento: "EBITDA sobre quadro: numerador financeiro, denominador de RH",
    eixo: "mes",
    formula: formula(
      "EBITDA per capita = EBITDA do mês × 12 ÷ headcount FTE",
      "int-ebitda-pc",
    ),
    series: [valor("EBITDA por FTE", "BRL_mi")],
  },
  {
    painel: "int-hc-desp",
    views: ["vw_fato_fin_mes", "vw_fato_rh_mes"],
    cruzamento:
      "põe folha e receita no mesmo eixo e o quadro no outro — a leitura é " +
      "justamente a divergência entre as três curvas",
    eixo: "mes",
    formula: formula(
      "folha e receita do mês em reais; headcount FTE no fim do mês",
      "int-hc-desp",
    ),
    series: [
      valor("Folha mensal", "BRL_mi"),
      valor("Receita mensal", "BRL_mi"),
      valor("Headcount (FTE)", "FTE"),
    ],
  },
  {
    painel: "int-pct",
    views: ["vw_fato_fin_mes", "vw_fato_rh_mes"],
    cruzamento: "folha sobre receita: numerador de RH, denominador financeiro",
    eixo: "mes",
    formula: formula(
      "despesa de pessoal sobre a receita = folha ÷ receita líquida × 100",
      "int-pct",
    ),
    series: [
      valor("Folha ÷ receita", "pct"),
      referencia("Média do período", "pct"),
    ],
  },

  /* ================================================================ *
   * T-118 — as formas categóricas
   * ================================================================ */

  /* ---------------- rh/visao ---------------- */
  {
    painel: "rh-flash",
    views: ["vw_fato_rh_mes"],
    cruzamento: null,
    eixo: "estatistica",
    formula: formula(
      "três leituras do período, cada uma com a fórmula do próprio número",
      "rh-flash",
    ),
    series: [
      estatistica(
        "Saldo do período",
        "contagem",
        "admissões menos desligamentos no recorte",
      ),
      estatistica(
        "Melhor retenção",
        "pct",
        "a área com a menor taxa de saída do recorte",
      ),
      estatistica(
        "Maior risco",
        "pct",
        "a área com a maior taxa de saída do recorte",
      ),
    ],
  },
  {
    painel: "rh-areas",
    views: ["vw_fato_rh_mes"],
    cruzamento: null,
    eixo: "area",
    formula: formula(
      "headcount FTE por área, no último mês do recorte",
      "rh-areas",
    ),
    series: [valor("FTE", "FTE")],
  },

  /* ---------------- rh/colab ---------------- */
  {
    painel: "col-area",
    views: ["vw_fato_rh_mes"],
    cruzamento: null,
    eixo: "area",
    formula: formula(
      "headcount FTE por área, no último mês do recorte",
      "col-area",
    ),
    series: [valor("FTE", "FTE")],
  },
  {
    painel: "col-perfil",
    views: ["vw_fato_rh_perfil", "vw_fato_rh_mes"],
    cruzamento:
      "gênero é dimensão do perfil e modalidade é chave do fato mensal — os " +
      "dois cortes vivem em views diferentes e o painel os põe lado a lado",
    eixo: "grupo-de-perfil",
    formula: formula(
      "repartição de 100% do quadro dentro de cada corte, no fim do recorte",
      "col-perfil",
    ),
    series: [valor("Gênero", "pct"), valor("Modalidade", "pct")],
  },
  {
    painel: "col-idade",
    views: ["vw_fato_rh_perfil"],
    cruzamento: null,
    eixo: "faixa-etaria",
    formula: formula(
      "headcount FTE por faixa etária, no último mês do recorte",
      "col-idade",
    ),
    series: [valor("FTE", "FTE")],
  },
  {
    painel: "col-escol",
    views: ["vw_fato_rh_perfil"],
    cruzamento: null,
    eixo: "escolaridade",
    formula: formula(
      "headcount FTE por escolaridade, no último mês do recorte",
      "col-escol",
    ),
    series: [valor("FTE", "FTE")],
  },
  {
    painel: "col-geo",
    views: ["vw_fato_rh_perfil"],
    cruzamento: null,
    eixo: "estatistica",
    formula: formula(
      "leituras da distribuição do quadro por UF, no fim do recorte",
      "col-geo",
    ),
    series: [
      estatistica(
        "Estados com presença",
        "contagem",
        "UFs com ao menos uma pessoa no recorte",
      ),
      estatistica(
        "São Paulo",
        "pct",
        "quadro em SP dividido pelo quadro do recorte",
      ),
      estatistica(
        "Top 4 estados",
        "pct",
        "soma das quatro maiores UFs dividida pelo quadro do recorte",
      ),
    ],
  },

  /* ---------------- rh/turnover ---------------- */
  {
    painel: "tov-tipos",
    views: ["vw_fato_rh_desligamento"],
    cruzamento: null,
    eixo: "tipo-de-saida",
    formula: formula(
      "participação de cada tipo de saída no total de desligamentos do recorte",
      "tov-tipos",
    ),
    series: [valor("Participação", "pct")],
  },
  {
    painel: "tov-area",
    views: ["vw_fato_rh_mes"],
    cruzamento: null,
    eixo: "area",
    formula: formula(
      "turnover da área = desligamentos da área ÷ headcount médio da área",
      "tov-area",
    ),
    series: [valor("Turnover", "pct"), referencia("Meta anual", "pct")],
  },
  {
    painel: "tov-corte",
    views: ["vw_fato_rh_desligamento", "vw_fato_rh_perfil"],
    cruzamento:
      "as saídas de cada corte vêm de uma view e o quadro que serve de " +
      "denominador vem da outra; sem as duas a taxa não existe",
    eixo: "corte-de-turnover",
    formula: formula(
      "turnover do corte = desligamentos do corte ÷ quadro do corte",
      "tov-corte",
    ),
    series: [valor("Turnover", "pct"), referencia("Meta anual", "pct")],
  },
  {
    painel: "tov-resumo",
    views: ["vw_fato_turnover_custo"],
    cruzamento: null,
    eixo: "estatistica",
    formula: formula(
      "o custo do turnover separado entre o que é rescisão e o que é reposição",
      "tov-resumo",
    ),
    series: [
      estatistica(
        "Custo total com rescisões",
        "BRL_mi",
        "soma dos componentes de rescisão no recorte",
      ),
      estatistica(
        "Custo estimado de reposição",
        "BRL_mi",
        "soma de recrutamento, ramp-up e produtividade perdida no recorte",
      ),
      estatistica(
        "Total",
        "BRL_mi",
        "soma dos quatro componentes do custo do turnover no recorte",
      ),
    ],
  },

  /* ---------------- rh/recrut ---------------- */
  {
    painel: "rec-status",
    views: ["vw_fato_vagas"],
    cruzamento: null,
    eixo: "status-de-vaga",
    formula: formula(
      "participação de cada status no total de vagas movimentadas no recorte",
      "rec-status",
    ),
    series: [valor("Participação", "pct")],
  },
  {
    painel: "rec-funil",
    views: ["vw_fato_vagas"],
    cruzamento: null,
    eixo: "passo-do-funil",
    formula: formula(
      "soma de cada etapa do funil no recorte, da candidatura à contratação",
      "rec-funil",
    ),
    series: [valor("Pessoas", "contagem")],
  },
  {
    painel: "rec-fontes",
    views: ["vw_fato_vagas_fonte"],
    cruzamento: null,
    eixo: "fonte-de-candidato",
    formula: formula(
      "participação de cada fonte no total de contratados do recorte",
      "rec-fontes",
    ),
    series: [valor("Participação", "pct")],
  },
  {
    painel: "rec-tempo",
    views: ["vw_fato_vagas"],
    cruzamento: null,
    eixo: "area",
    formula: formula(
      "dias médios da área = dias somados da área ÷ vagas fechadas da área",
      "rec-tempo",
    ),
    series: [valor("Dias", "dias"), referencia("Meta", "dias")],
  },
  {
    painel: "rec-resumo",
    views: ["vw_fato_vagas"],
    cruzamento: null,
    eixo: "estatistica",
    formula: formula(
      "o fechamento do ciclo de recrutamento no recorte, número a número",
      "rec-resumo",
    ),
    series: [
      estatistica(
        "Vagas movimentadas",
        "contagem",
        "abertas, em andamento, fechadas e canceladas no recorte",
      ),
      estatistica(
        "Taxa de conversão",
        "pct",
        "vagas fechadas ÷ vagas movimentadas no recorte",
      ),
      estatistica(
        "Custo médio de contratação",
        "BRL_mi",
        "custo de recrutamento ÷ contratados no recorte",
      ),
      estatistica(
        "Tempo médio",
        "dias",
        "dias somados ÷ vagas fechadas no recorte",
      ),
    ],
  },

  /* ---------------- rh/trein ---------------- */
  {
    painel: "tre-conclusao",
    views: ["vw_fato_treinamento"],
    cruzamento: null,
    eixo: "estatistica",
    formula: formula(
      "trilhas concluídas contra iniciadas no recorte",
      "tre-conclusao",
    ),
    series: [
      estatistica(
        "Concluídas",
        "pct",
        "trilhas concluídas ÷ trilhas iniciadas no recorte",
      ),
      estatistica(
        "Em andamento",
        "pct",
        "100% menos a participação de concluídas",
      ),
    ],
  },
  {
    painel: "tre-modal",
    views: ["vw_fato_treinamento"],
    cruzamento: null,
    eixo: "modalidade-de-trilha",
    formula: formula(
      "repartição de 100% das horas do recorte entre as modalidades de trilha",
      "tre-modal",
    ),
    series: [valor("Participação", "pct")],
  },
  {
    painel: "tre-conclmod",
    views: ["vw_fato_treinamento"],
    cruzamento: null,
    eixo: "modalidade-de-trilha",
    formula: formula(
      "conclusão da modalidade = concluídas ÷ iniciadas naquela modalidade",
      "tre-conclmod",
    ),
    series: [valor("Conclusão", "pct")],
  },
  {
    painel: "tre-invest",
    views: ["vw_fato_treinamento", "vw_fato_rh_mes"],
    cruzamento:
      "o investimento e as horas vêm do LMS; a participação precisa do quadro " +
      "como denominador, que só o fato mensal tem",
    eixo: "estatistica",
    formula: formula(
      "as três leituras do investimento em desenvolvimento no recorte",
      "tre-invest",
    ),
    series: [
      estatistica(
        "Investimento total",
        "BRL_mi",
        "soma do investimento em treinamento no recorte",
      ),
      estatistica(
        "Horas realizadas",
        "horas",
        "soma das horas de treinamento no recorte",
      ),
      estatistica(
        "Participação",
        "pct",
        "participantes ÷ headcount FTE no último mês do recorte",
      ),
    ],
  },
  {
    painel: "tre-area",
    views: ["vw_fato_treinamento"],
    cruzamento: null,
    eixo: "area",
    formula: formula("soma das horas de treinamento por área", "tre-area"),
    series: [valor("Horas", "horas")],
  },

  /* ---------------- rh/engaj ---------------- */
  {
    painel: "eng-area",
    views: ["vw_fato_rh_mes"],
    cruzamento: null,
    eixo: "area",
    formula: formula(
      "engajamento da área = pontos da pesquisa ÷ respondentes da área",
      "eng-area",
    ),
    series: [valor("Engajamento", "pct")],
  },
  {
    painel: "eng-cat",
    views: ["vw_fato_rh_mes"],
    cruzamento: null,
    eixo: "categoria-de-enps",
    formula: formula(
      "repartição de 100% dos respondentes entre promotores, neutros e detratores",
      "eng-cat",
    ),
    series: [valor("Participação", "pct")],
  },
  {
    painel: "eng-clima",
    views: ["vw_fato_rh_mes"],
    cruzamento: null,
    eixo: "estatistica",
    formula: formula(
      "as leituras de clima do recorte, cada uma com a própria fórmula",
      "eng-clima",
    ),
    series: [
      estatistica(
        "eNPS atual",
        "pontos",
        "(promotores − detratores) ÷ respondentes × 100 no recorte",
      ),
      estatistica(
        "Engajamento médio",
        "pct",
        "pontos da pesquisa ÷ respondentes no recorte",
      ),
      estatistica(
        "Absenteísmo médio",
        "pct",
        "horas ausentes ÷ horas previstas no recorte",
      ),
      estatistica(
        "Pior área",
        "pct",
        "a área com o menor engajamento do recorte",
      ),
    ],
  },

  /* ---------------- rh/sal ---------------- */
  {
    painel: "sal-medio",
    views: ["vw_fato_rh_mes"],
    cruzamento: null,
    eixo: "area",
    formula: formula(
      "salário médio da área = folha da área ÷ headcount FTE da área",
      "sal-medio",
    ),
    series: [valor("Salário médio", "BRL_mi")],
  },
  {
    painel: "sal-comp",
    views: ["vw_fato_rh_mes"],
    cruzamento: null,
    eixo: "componente-da-folha",
    formula: formula(
      "repartição de 100% da folha do recorte entre os quatro componentes",
      "sal-comp",
    ),
    series: [valor("Participação", "pct")],
  },
  {
    painel: "sal-folha",
    views: ["vw_fato_rh_mes"],
    cruzamento: null,
    eixo: "area",
    formula: formula("soma da folha por área no recorte", "sal-folha"),
    series: [valor("Folha", "BRL_mi")],
  },
  {
    painel: "sal-benef",
    views: ["vw_fato_rh_mes"],
    cruzamento: null,
    eixo: "componente-da-folha",
    formula: formula(
      "soma de encargos e benefícios no recorte, em reais",
      "sal-benef",
    ),
    series: [valor("Valor", "BRL_mi")],
  },
  {
    painel: "sal-resumo",
    views: ["vw_dim_cargo"],
    cruzamento: null,
    eixo: "estatistica",
    formula: formula(
      "os limites da política de remuneração, lidos das bandas de cargo",
      "sal-resumo",
    ),
    series: [
      estatistica(
        "Maior salário base",
        "BRL_mi",
        "o teto da banda mais alta do cadastro de cargos",
      ),
      estatistica(
        "Menor salário base",
        "BRL_mi",
        "o piso da banda mais baixa do cadastro de cargos",
      ),
      estatistica(
        "Amplitude",
        "contagem",
        "o teto mais alto dividido pelo piso mais baixo",
      ),
    ],
  },

  /* ---------------- fin/caixa ---------------- */
  {
    painel: "cx-cat",
    views: ["vw_fato_saida_categoria"],
    cruzamento: null,
    eixo: "natureza-de-saida",
    formula: formula(
      "soma do desembolso de cada natureza no recorte",
      "cx-cat",
    ),
    series: [valor("Desembolso", "BRL_mi")],
  },

  /* ---------------- fin/orc ---------------- */
  {
    painel: "orc-gastos",
    views: ["vw_fato_orcamento"],
    cruzamento: null,
    eixo: "centro-de-custo",
    formula: formula(
      "soma do realizado por centro de custo no recorte",
      "orc-gastos",
    ),
    series: [valor("Realizado", "BRL_mi")],
  },

  /* ---------------- fin/contas ---------------- */
  {
    painel: "cr-inadim",
    views: ["vw_fato_contas"],
    cruzamento: null,
    eixo: "contraparte",
    formula: formula(
      "saldo vencido por cliente no fim do recorte, do maior para o menor",
      "cr-inadim",
    ),
    series: [valor("Vencido", "BRL_mi")],
  },
  {
    painel: "cp-fornec",
    views: ["vw_fato_contas"],
    cruzamento: null,
    eixo: "contraparte",
    formula: formula(
      "saldo a pagar por fornecedor no fim do recorte, do maior para o menor",
      "cp-fornec",
    ),
    series: [valor("A pagar", "BRL_mi")],
  },

  /* ---------------- fin/fat ---------------- */
  {
    painel: "fat-segm",
    views: ["vw_fato_faturamento_cliente"],
    cruzamento: null,
    eixo: "segmento",
    formula: formula(
      "participação de cada segmento na receita da carteira no recorte",
      "fat-segm",
    ),
    series: [valor("Participação", "pct")],
  },
];

/* ------------------------------------------------------------------ *
 * Os invariantes declarados
 * ------------------------------------------------------------------ */

/**
 * Painel que **não** muda sob um recorte, e por quê.
 *
 * O aceite de T-117 pede que o painel mude ao trocar entidade e área. Três não
 * mudam sob entidade e treze não mudam sob área — e nenhum dos dezesseis é
 * defeito. São views cujo grão não tem aquela dimensão, ou razões cujo
 * numerador e denominador escalam junto.
 *
 * A lista existe para que a diferença entre "não muda porque não pode" e "não
 * muda porque alguém errou" fique escrita. Um teste percorre os dois sentidos:
 * quem está na lista precisa mesmo ser invariante, e quem não está precisa
 * mudar. Sem o segundo sentido a lista viraria um lugar para esconder defeito.
 */
export type InvarianteDePainel = {
  readonly dimensao: "entidade" | "area" | "modalidade";
  readonly paineis: readonly string[];
  readonly porque: string;
};

export const INVARIANTES_DOS_PAINEIS: readonly InvarianteDePainel[] = [
  {
    dimensao: "entidade",
    paineis: ["rec-dias", "rec-vagas"],
    porque:
      "vw_fato_vagas tem grão mês × área e não carrega entidade — o ATS " +
      "controla vaga por área, não por unidade legal. Filtrar por entidade " +
      "não tem o que filtrar, e mostrar o total é mais honesto que mostrar zero",
  },
  {
    dimensao: "entidade",
    paineis: ["fat-risco"],
    porque:
      "é participação, e a fixture divide numerador e denominador pela mesma " +
      "fatia de entidade — uma razão não muda quando os dois lados escalam " +
      "junto. Com dado real a carteira de SP tem rating diferente da das " +
      "demais unidades, e é o que H-53 precisa responder",
  },
  {
    dimensao: "area",
    paineis: [
      "fin-receita",
      "fin-margens",
      "fin-ebitda",
      "cx-diario",
      "cx-saldo",
      "cx-fluxo",
      "orc-vs",
      "orc-acum",
      "cr-aging",
      "cp-aging",
      "fat-evolucao",
      "fat-risco",
    ],
    porque:
      "as views de Financeiro têm grão mês × entidade e não carregam área. " +
      "Não é omissão: o que 'área' significa no módulo Financeiro é decisão " +
      "aberta — centro de custo, área de RH ou segmento comercial são três " +
      "recortes diferentes com o mesmo nome. É T-144, bloqueada em H-04",
  },
  {
    dimensao: "area",
    paineis: ["orc-desvio"],
    porque:
      "o eixo do painel JÁ é o centro de custo, e o orçamento não tem área de " +
      "RH. Filtrar por área e quebrar por centro de custo seriam dois cortes " +
      "da mesma coisa se a decisão de H-04 os igualar — até lá, o painel " +
      "mostra os oito centros sob qualquer área",
  },
  {
    dimensao: "modalidade",
    paineis: [
      "tov-custo",
      "rec-dias",
      "rec-vagas",
      "fin-receita",
      "fin-margens",
      "fin-ebitda",
      "cx-diario",
      "cx-saldo",
      "cx-fluxo",
      "orc-vs",
      "orc-desvio",
      "orc-acum",
      "cr-aging",
      "cp-aging",
      "fat-evolucao",
      "fat-risco",
    ],
    porque:
      "presencial, híbrido ou remoto é atributo de vínculo de pessoa. " +
      "Financeiro não o tem por construção, e vagas e custo de turnover " +
      "também não: a vaga ainda não tem ocupante, e o custo de saída é do " +
      "cargo, não do arranjo de trabalho de quem saiu",
  },
];

/** Os painéis declarados invariantes sob uma dimensão. */
export function invariantesSob(
  dimensao: InvarianteDePainel["dimensao"],
): readonly string[] {
  return INVARIANTES_DOS_PAINEIS.filter((i) => i.dimensao === dimensao).flatMap(
    (i) => i.paineis,
  );
}

const POR_PAINEL: ReadonlyMap<string, OrigemDePainel> = new Map(
  ORIGEM_DOS_PAINEIS.map((o) => [o.painel, o]),
);

export function origemDoPainel(id: string): OrigemDePainel | undefined {
  return POR_PAINEL.get(id);
}

/** As formas cobertas por T-117. */
export const FORMAS_DE_SERIE_TEMPORAL = [
  "barras",
  "linha",
  "barras-empilhadas",
] as const;

/** As formas cobertas por T-118. As quatro restantes entram com T-119. */
export const FORMAS_CATEGORICAS = [
  "barras-horizontais",
  "rosca",
  "funil",
  "divisao",
  "estatisticas",
] as const;

/** As formas que já têm origem declarada: as de T-117 mais as de T-118. */
export const FORMAS_COM_ORIGEM: readonly string[] = [
  ...FORMAS_DE_SERIE_TEMPORAL,
  ...FORMAS_CATEGORICAS,
];
