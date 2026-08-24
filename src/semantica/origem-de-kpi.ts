/**
 * De onde sai cada KPI que o protótipo mostrava cravado (T-143).
 *
 * O achado 5 do Anexo D é uma lista de números que não respondem a filtro
 * nenhum. Tirar isso não é questão de código de tela: é questão de **existir de
 * onde calcular**. Este arquivo é a declaração — para cada KPI, a view, a coluna
 * que é numerador e a coluna que é denominador.
 *
 * Uma declaração e não um cálculo. Quem calcula é o adaptador; o que mora aqui
 * é o compromisso de que a coluna existe, e é isso que um teste confere: nenhum
 * dos KPIs do achado 5 fica sem origem, e nenhuma origem aponta para coluna que
 * não está na fixture.
 *
 * ## A contagem
 *
 * O Anexo D escreve **15**; a medição encontra **23**, e é o que o registro de
 * KPIs carrega em `constanteNoPrototipo`. A diferença está em **H-48**, com
 * Produto. Declarar origem para os 23 satisfaz "nenhuma das 15 fica sem coluna"
 * com folga — fazer pelos 15 do texto é que deixaria oito de fora.
 *
 * ## Denominador é parte da definição, não detalhe
 *
 * `encargos / salarios` dá 37,5%; `encargos / folha` dá 22,6%. Os dois são
 * "percentual de encargos" em português e um dos dois aparece numa negociação
 * sindical. O denominador está declarado aqui pelo mesmo motivo que a fórmula
 * está no catálogo: para a discussão ser sobre a escolha, e não sobre o número.
 */

/** De onde sai um número: a view, o que soma em cima, o que soma embaixo. */
export type OrigemDeKpi = {
  readonly kpi: string;
  /** A view de fato da seção 10.1 que tem a coluna. */
  readonly view: string;
  /** A coluna que é numerador — ou a expressão, quando é diferença de colunas. */
  readonly medida: string;
  /**
   * A coluna que é denominador. `null` quando a medida é absoluta.
   *
   * `view.coluna` quando o denominador está em **outra** view — e vale reparar
   * quantas vezes isso acontece: é a razão de o mapeamento existir em vez de
   * cada painel resolver por conta.
   */
  readonly denominador: string | null;
  /** O que a divisão significa, em uma linha. */
  readonly leitura: string;
};

/**
 * Os 23 KPIs do achado 5, com origem declarada.
 *
 * Na ordem do registro de KPIs, que é a ordem das telas do Anexo A.
 */
export const ORIGEM_DOS_KPIS_CONSTANTES: readonly OrigemDeKpi[] = [
  {
    kpi: "rh-colab-idade-media",
    view: "vw_fato_rh_mes",
    medida: "somaDeIdade",
    denominador: "headcountFte",
    leitura: "média de idade do quadro no recorte",
  },
  {
    kpi: "rh-colab-tempo-medio-de-casa",
    view: "vw_fato_rh_mes",
    medida: "somaDeTempoDeCasa",
    denominador: "headcountFte",
    leitura: "média de anos de casa do quadro no recorte",
  },
  {
    kpi: "rh-colab-estados-atendidos",
    view: "vw_fato_rh_perfil",
    medida: "contagem de valores distintos da dimensão uf com headcountFte > 0",
    denominador: null,
    leitura: "quantos estados têm ao menos uma pessoa no recorte",
  },
  {
    kpi: "rh-colab-superior-ou-mais",
    view: "vw_fato_rh_perfil",
    medida:
      "headcountFte da dimensão escolaridade em superior, pos-graduacao e mestrado-mais",
    denominador: "headcountFte da dimensão escolaridade, todos os valores",
    leitura:
      "fração do quadro com ensino superior completo ou titulação acima dele",
  },
  {
    kpi: "rh-turnover-tempo-ate-a-saida",
    view: "vw_fato_rh_mes",
    medida: "somaDeTempoAteASaida",
    denominador: "desligamentos",
    leitura:
      "média de anos de casa de **quem saiu** — o denominador é a saída, não o quadro",
  },
  {
    kpi: "rh-recrut-tempo-de-fechamento",
    view: "vw_fato_vagas",
    medida: "diasSomados",
    denominador: "fechadas",
    leitura: "dias médios por vaga fechada; vaga aberta não entra na média",
  },
  {
    kpi: "rh-recrut-custo-por-contratacao",
    view: "vw_fato_vagas",
    medida: "custoDeRecrutamento",
    denominador: "contratados",
    leitura: "quanto custou cada contratação efetivada no recorte",
  },
  {
    kpi: "rh-trein-participacao",
    view: "vw_fato_treinamento",
    medida: "participantes",
    denominador: "vw_fato_rh_mes.elegiveis",
    leitura: "fração do quadro elegível que iniciou ao menos uma trilha",
  },
  {
    kpi: "rh-trein-conclusao-media",
    view: "vw_fato_treinamento",
    medida: "trilhasConcluidas",
    denominador: "trilhasIniciadas",
    leitura: "fração das trilhas iniciadas que chegou ao fim",
  },
  {
    kpi: "rh-trein-custo-por-hora",
    view: "vw_fato_treinamento",
    medida: "investimentoReais",
    denominador: "horas",
    leitura: "quanto custa cada hora de treinamento realizada",
  },
  {
    kpi: "rh-engaj-promotores",
    view: "vw_fato_rh_mes",
    medida: "promotores",
    denominador: "respondentes",
    leitura: "fração de promotores entre quem respondeu",
  },
  {
    kpi: "rh-engaj-cobertura-da-pesquisa",
    view: "vw_fato_rh_mes",
    medida: "respondentes",
    denominador: "elegiveis",
    leitura: "fração do quadro elegível que respondeu à pesquisa",
  },
  {
    kpi: "rh-sal-encargos",
    view: "vw_fato_rh_mes",
    medida: "encargos",
    denominador: "salarios",
    leitura:
      "encargos sobre **salários**, e não sobre a folha — 37,5% contra 22,6%",
  },
  {
    kpi: "fin-visao-margem-bruta",
    view: "vw_fato_fin_mes",
    medida: "receitaLiquida - cmv",
    denominador: "receitaLiquida",
    leitura: "quanto sobra da receita depois do custo do que foi vendido",
  },
  {
    kpi: "fin-visao-margem-liquida",
    view: "vw_fato_fin_mes",
    medida:
      "receitaLiquida - cmv - despesasOperacionais - depreciacaoEAmortizacao - resultadoFinanceiro - naoOperacional",
    denominador: "receitaLiquida",
    leitura: "o que sobra no fim da ponte da DRE, sobre a receita",
  },
  {
    kpi: "fin-caixa-conversao-de-dez",
    view: "vw_fato_fin_mes",
    medida: "fco",
    denominador: "receitaLiquida - cmv - despesasOperacionais",
    leitura: "quanto do EBITDA virou caixa de fato",
  },
  {
    kpi: "fin-contas-pmr",
    view: "vw_fato_contas",
    medida: "aReceber",
    denominador: "vw_fato_fin_mes.receitaLiquida",
    leitura: "dias de receita parados em contas a receber",
  },
  {
    kpi: "fin-contas-pme",
    view: "vw_fato_fin_mes",
    medida: "estoque",
    denominador: "cmv",
    leitura: "dias de custo parados em estoque",
  },
  {
    kpi: "fin-contas-pmp",
    view: "vw_fato_contas",
    medida: "aPagar",
    denominador: "vw_fato_fin_mes.cmv",
    leitura: "dias de custo ainda não pagos ao fornecedor",
  },
  {
    kpi: "fin-contas-ciclo-de-conversao",
    view: "vw_fato_contas",
    medida: "pmr + pme - pmp, dos três acima",
    denominador: null,
    leitura: "dias entre pagar o fornecedor e receber do cliente",
  },
  {
    kpi: "fin-contas-inadimplencia",
    view: "vw_fato_contas",
    medida: "aReceber nas faixas de aging vencidas",
    denominador: "aReceber em todas as faixas",
    leitura: "fração do que se tem a receber que já venceu",
  },
  {
    kpi: "fin-fat-ticket-medio",
    view: "vw_fato_fin_mes",
    medida: "receitaLiquida",
    denominador: "notasEmitidas",
    leitura: "receita média por nota fiscal emitida",
  },
  {
    kpi: "fin-fat-concentracao-top-10",
    view: "vw_fato_faturamento_cliente",
    medida: "receita",
    denominador: "vw_fato_fin_mes.receitaLiquida",
    leitura: "quanto da receita vem dos dez maiores clientes",
  },
];

/** A origem de um KPI, ou `undefined` se ele não está no achado 5. */
export function origemDoKpi(kpi: string): OrigemDeKpi | undefined {
  return ORIGEM_DOS_KPIS_CONSTANTES.find((o) => o.kpi === kpi);
}
