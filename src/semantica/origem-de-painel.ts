/**
 * De qual view cada painel lê (T-117.2).
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
 */

/** As views que um painel lê. Mais de uma quando o painel cruza domínios. */
export type OrigemDePainel = {
  readonly painel: string;
  readonly views: readonly string[];
  /** Por que este painel precisa de mais de uma view, quando precisa. */
  readonly cruzamento: string | null;
};

/**
 * Os 31 painéis de barras, linha e barras empilhadas.
 *
 * As outras formas — barras horizontais, rosca, funil, divisão, estatísticas,
 * cascata, dispersão, régua e mosaico — entram com T-118 e T-119, e o teste de
 * cobertura cresce junto.
 */
export const ORIGEM_DOS_PAINEIS: readonly OrigemDePainel[] = [
  // rh/visao
  { painel: "rh-headcount", views: ["vw_fato_rh_mes"], cruzamento: null },
  { painel: "rh-turnover", views: ["vw_fato_rh_mes"], cruzamento: null },
  { painel: "rh-retencao", views: ["vw_fato_rh_mes"], cruzamento: null },
  { painel: "rh-folha", views: ["vw_fato_rh_mes"], cruzamento: null },

  // rh/colab
  { painel: "col-tempo", views: ["vw_fato_rh_perfil"], cruzamento: null },

  // rh/turnover
  { painel: "tov-12m", views: ["vw_fato_rh_mes"], cruzamento: null },
  {
    painel: "tov-custo",
    views: ["vw_fato_turnover_custo"],
    cruzamento: null,
  },

  // rh/recrut
  { painel: "rec-dias", views: ["vw_fato_vagas"], cruzamento: null },
  { painel: "rec-vagas", views: ["vw_fato_vagas"], cruzamento: null },

  // rh/trein
  {
    painel: "tre-horas",
    views: ["vw_fato_treinamento", "vw_fato_rh_mes"],
    cruzamento:
      "as horas vêm do LMS e a participação precisa do quadro como denominador; " +
      "contar participantes dentro do LMS contaria a mesma pessoa uma vez por trilha",
  },

  // rh/engaj
  { painel: "eng-enps", views: ["vw_fato_rh_mes"], cruzamento: null },
  { painel: "eng-eng", views: ["vw_fato_rh_mes"], cruzamento: null },
  { painel: "eng-abs", views: ["vw_fato_rh_mes"], cruzamento: null },

  // rh/sal
  { painel: "sal-faixas", views: ["vw_fato_rh_perfil"], cruzamento: null },

  // fin/visao
  { painel: "fin-receita", views: ["vw_fato_fin_mes"], cruzamento: null },
  { painel: "fin-margens", views: ["vw_fato_fin_mes"], cruzamento: null },
  { painel: "fin-ebitda", views: ["vw_fato_fin_mes"], cruzamento: null },

  // fin/caixa
  {
    painel: "cx-diario",
    views: ["vw_fato_caixa_diario"],
    cruzamento: null,
  },
  { painel: "cx-saldo", views: ["vw_fato_fin_mes"], cruzamento: null },
  { painel: "cx-fluxo", views: ["vw_fato_fin_mes"], cruzamento: null },

  // fin/orc
  { painel: "orc-vs", views: ["vw_fato_orcamento"], cruzamento: null },
  { painel: "orc-desvio", views: ["vw_fato_orcamento"], cruzamento: null },
  { painel: "orc-acum", views: ["vw_fato_orcamento"], cruzamento: null },

  // fin/contas
  { painel: "cr-aging", views: ["vw_fato_contas"], cruzamento: null },
  { painel: "cp-aging", views: ["vw_fato_contas"], cruzamento: null },

  // fin/fat
  { painel: "fat-evolucao", views: ["vw_fato_fin_mes"], cruzamento: null },
  {
    painel: "fat-risco",
    views: ["vw_fato_faturamento_cliente"],
    cruzamento: null,
  },

  // int/cruz — os quatro cruzam RH com Financeiro, que é o que a tela é
  {
    painel: "int-rpc",
    views: ["vw_fato_fin_mes", "vw_fato_rh_mes"],
    cruzamento: "receita sobre quadro: numerador financeiro, denominador de RH",
  },
  {
    painel: "int-ebitda-pc",
    views: ["vw_fato_fin_mes", "vw_fato_rh_mes"],
    cruzamento: "EBITDA sobre quadro: numerador financeiro, denominador de RH",
  },
  {
    painel: "int-hc-desp",
    views: ["vw_fato_fin_mes", "vw_fato_rh_mes"],
    cruzamento:
      "põe folha e receita no mesmo eixo e o quadro no outro — a leitura é " +
      "justamente a divergência entre as três curvas",
  },
  {
    painel: "int-pct",
    views: ["vw_fato_fin_mes", "vw_fato_rh_mes"],
    cruzamento: "folha sobre receita: numerador de RH, denominador financeiro",
  },
];

const POR_PAINEL: ReadonlyMap<string, OrigemDePainel> = new Map(
  ORIGEM_DOS_PAINEIS.map((o) => [o.painel, o]),
);

export function origemDoPainel(id: string): OrigemDePainel | undefined {
  return POR_PAINEL.get(id);
}

/** As formas cobertas por T-117. As demais entram com T-118 e T-119. */
export const FORMAS_DE_SERIE_TEMPORAL = [
  "barras",
  "linha",
  "barras-empilhadas",
] as const;
