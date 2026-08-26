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
import { REGISTRO_DE_KPIS } from "@/semantica/kpis";

export type OrigemDeKpi = {
  readonly kpi: string;
  /**
   * A métrica do catálogo que define este número.
   *
   * É o elo que faz "todo KPI vem do catálogo" ser conferivel: sem ele, a
   * fórmula estaria escrita duas vezes — no catálogo e no código do KPI — e as
   * duas divergiriam no primeiro ajuste.
   */
  readonly metrica: string;
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
 * A origem de cada KPI, na ordem do registro — que é a ordem das telas.
 *
 * Começou com os 23 do achado 5 (T-143) e cresceu com as 7 telas de RH
 * (T-115). As telas de Financeiro e Integração entram com T-116.
 *
 * Um KPI pode repetir métrica: "Turnover 12m" aparece em `rh/visao` e em
 * `rh/turnover`, e é o mesmo número lido em duas telas. O que não pode é a
 * mesma métrica ter duas definições.
 */
export const ORIGEM_DOS_KPIS: readonly OrigemDeKpi[] = [
  {
    kpi: "rh-colab-idade-media",
    metrica: "idade_media",
    view: "vw_fato_rh_mes",
    medida: "somaDeIdade",
    denominador: "headcountFte",
    leitura: "média de idade do quadro no recorte",
  },
  {
    kpi: "rh-colab-tempo-medio-de-casa",
    metrica: "tempo_medio_de_casa",
    view: "vw_fato_rh_mes",
    medida: "somaDeTempoDeCasa",
    denominador: "headcountFte",
    leitura: "média de anos de casa do quadro no recorte",
  },
  {
    kpi: "rh-colab-estados-atendidos",
    metrica: "estados_atendidos",
    view: "vw_fato_rh_perfil",
    medida: "contagem de valores distintos da dimensão uf com headcountFte > 0",
    denominador: null,
    leitura: "quantos estados têm ao menos uma pessoa no recorte",
  },
  {
    kpi: "rh-colab-superior-ou-mais",
    metrica: "escolaridade_superior",
    view: "vw_fato_rh_perfil",
    medida:
      "headcountFte da dimensão escolaridade em superior, pos-graduacao e mestrado-mais",
    denominador: "headcountFte da dimensão escolaridade, todos os valores",
    leitura:
      "fração do quadro com ensino superior completo ou titulação acima dele",
  },
  {
    kpi: "rh-turnover-tempo-ate-a-saida",
    metrica: "tempo_ate_a_saida",
    view: "vw_fato_rh_mes",
    medida: "somaDeTempoAteASaida",
    denominador: "desligamentos",
    leitura:
      "média de anos de casa de **quem saiu** — o denominador é a saída, não o quadro",
  },
  {
    kpi: "rh-recrut-tempo-de-fechamento",
    metrica: "tempo_fechamento",
    view: "vw_fato_vagas",
    medida: "diasSomados",
    denominador: "fechadas",
    leitura: "dias médios por vaga fechada; vaga aberta não entra na média",
  },
  {
    kpi: "rh-recrut-custo-por-contratacao",
    metrica: "custo_por_contratacao",
    view: "vw_fato_vagas",
    medida: "custoDeRecrutamento",
    denominador: "contratados",
    leitura: "quanto custou cada contratação efetivada no recorte",
  },
  {
    kpi: "rh-trein-participacao",
    metrica: "participacao_treinamento",
    view: "vw_fato_rh_mes",
    medida: "participantesDeTreinamento do último mês",
    denominador: "elegiveis do último mês",
    leitura:
      "fração do quadro elegível que iniciou ao menos uma trilha; lida no fim da janela porque pessoa não soma ao longo do tempo",
  },
  {
    kpi: "rh-trein-conclusao-media",
    metrica: "conclusao_treinamento",
    view: "vw_fato_treinamento",
    medida: "trilhasConcluidas",
    denominador: "trilhasIniciadas",
    leitura: "fração das trilhas iniciadas que chegou ao fim",
  },
  {
    kpi: "rh-trein-custo-por-hora",
    metrica: "custo_por_hora_treinamento",
    view: "vw_fato_treinamento",
    medida: "investimentoReais",
    denominador: "horas",
    leitura: "quanto custa cada hora de treinamento realizada",
  },
  {
    kpi: "rh-engaj-promotores",
    metrica: "promotores",
    view: "vw_fato_rh_mes",
    medida: "promotores",
    denominador: "respondentes",
    leitura: "fração de promotores entre quem respondeu",
  },
  {
    kpi: "rh-engaj-cobertura-da-pesquisa",
    metrica: "cobertura_da_pesquisa",
    view: "vw_fato_rh_mes",
    medida: "respondentes",
    denominador: "elegiveis",
    leitura: "fração do quadro elegível que respondeu à pesquisa",
  },
  {
    kpi: "rh-sal-encargos",
    metrica: "encargos_sobre_salarios",
    view: "vw_fato_rh_mes",
    medida: "encargos",
    denominador: "salarios",
    leitura:
      "encargos sobre **salários**, e não sobre a folha — 37,5% contra 22,6%",
  },
  {
    kpi: "fin-visao-margem-bruta",
    metrica: "margem_bruta",
    view: "vw_fato_fin_mes",
    medida: "receitaLiquida - cmv",
    denominador: "receitaLiquida",
    leitura: "quanto sobra da receita depois do custo do que foi vendido",
  },
  {
    kpi: "fin-visao-margem-liquida",
    metrica: "margem_liquida",
    view: "vw_fato_fin_mes",
    medida:
      "receitaLiquida - cmv - despesasOperacionais - depreciacaoEAmortizacao - resultadoFinanceiro - naoOperacional",
    denominador: "receitaLiquida",
    leitura: "o que sobra no fim da ponte da DRE, sobre a receita",
  },
  {
    kpi: "fin-caixa-conversao-de-dez",
    metrica: "conversao_de_caixa",
    view: "vw_fato_fin_mes",
    medida: "fco",
    denominador: "receitaLiquida - cmv - despesasOperacionais",
    leitura: "quanto do EBITDA virou caixa de fato",
  },
  {
    kpi: "fin-contas-pmr",
    metrica: "pmr",
    view: "vw_fato_contas",
    medida: "aReceber",
    denominador: "vw_fato_fin_mes.receitaLiquida",
    leitura: "dias de receita parados em contas a receber",
  },
  {
    kpi: "fin-contas-pme",
    metrica: "pme",
    view: "vw_fato_fin_mes",
    medida: "estoque",
    denominador: "cmv",
    leitura: "dias de custo parados em estoque",
  },
  {
    kpi: "fin-contas-pmp",
    metrica: "pmp",
    view: "vw_fato_contas",
    medida: "aPagar",
    denominador: "vw_fato_fin_mes.cmv",
    leitura: "dias de custo ainda não pagos ao fornecedor",
  },
  {
    kpi: "fin-contas-ciclo-de-conversao",
    metrica: "ciclo_financeiro",
    view: "vw_fato_contas",
    medida: "pmr + pme - pmp, dos três acima",
    denominador: null,
    leitura: "dias entre pagar o fornecedor e receber do cliente",
  },
  {
    kpi: "fin-contas-inadimplencia",
    metrica: "inadimplencia",
    view: "vw_fato_contas",
    medida: "aReceber na faixa acima de 90 dias, no fim da janela",
    denominador: "aReceber em todas as faixas, no fim da janela",
    leitura:
      "fração do que se tem a receber que passou de 90 dias; contar a partir de 30 levaria de 4,1% para 31%",
  },
  {
    kpi: "fin-fat-ticket-medio",
    metrica: "ticket_medio",
    view: "vw_fato_fin_mes",
    medida: "receitaLiquida",
    denominador: "notasEmitidas",
    leitura: "receita média por nota fiscal emitida",
  },
  {
    kpi: "fin-fat-concentracao-top-10",
    metrica: "concentracao_top_10",
    view: "vw_fato_faturamento_cliente",
    medida: "receita",
    denominador: "vw_fato_fin_mes.receitaLiquida",
    leitura: "quanto da receita vem dos dez maiores clientes",
  },

  /* ---------------- rh/visao ---------------- */
  {
    kpi: "rh-visao-headcount",
    metrica: "headcount_fte",
    view: "vw_fato_rh_mes",
    medida: "headcountFte do último mês do recorte",
    denominador: null,
    leitura: "o quadro no fechamento do recorte",
  },
  {
    kpi: "rh-visao-turnover-12m",
    metrica: "turnover_12m",
    view: "vw_fato_rh_mes",
    medida: "desligamentos",
    denominador: "média mensal de headcountFte",
    leitura: "saídas sobre o quadro médio do período",
  },
  {
    kpi: "rh-visao-retencao-12m",
    metrica: "retencao_12m",
    view: "vw_fato_rh_mes",
    medida: "desligamentos",
    denominador: "média mensal de headcountFte",
    leitura: "o complemento do turnover: 100% menos ele",
  },
  {
    kpi: "rh-visao-enps",
    metrica: "enps",
    view: "vw_fato_rh_mes",
    medida: "promotores menos detratores",
    denominador: "respondentes",
    leitura: "promotores menos detratores, sobre quem respondeu",
  },
  {
    kpi: "rh-visao-custo-por-fte",
    metrica: "custo_por_fte",
    view: "vw_fato_rh_mes",
    medida: "folhaReais",
    denominador: "headcountFte do último mês",
    leitura: "quanto custa cada pessoa no período",
  },
  {
    kpi: "rh-visao-folha-total",
    metrica: "folha_total",
    view: "vw_fato_rh_mes",
    medida: "folhaReais",
    denominador: null,
    leitura: "a folha somada no recorte",
  },

  /* ---------------- rh/colab ---------------- */
  {
    kpi: "rh-colab-colaboradores",
    metrica: "headcount_fte",
    view: "vw_fato_rh_mes",
    medida: "headcountFte do último mês do recorte",
    denominador: null,
    leitura: "o mesmo quadro de rh/visao, lido na tela de colaboradores",
  },
  {
    kpi: "rh-colab-trabalho-flexivel",
    metrica: "trabalho_flexivel",
    view: "vw_fato_rh_mes",
    medida: "headcountFte em hibrido e remoto",
    denominador: "headcountFte em todas as modalidades",
    leitura: "fração do quadro fora do presencial integral",
  },

  /* ---------------- rh/turnover ---------------- */
  {
    kpi: "rh-turnover-turnover-12m",
    metrica: "turnover_12m",
    view: "vw_fato_rh_mes",
    medida: "desligamentos",
    denominador: "média mensal de headcountFte",
    leitura: "o mesmo turnover de rh/visao",
  },
  {
    kpi: "rh-turnover-retencao-12m",
    metrica: "retencao_12m",
    view: "vw_fato_rh_mes",
    medida: "desligamentos",
    denominador: "média mensal de headcountFte",
    leitura: "o mesmo complemento, na tela de turnover",
  },
  {
    kpi: "rh-turnover-desligamentos",
    metrica: "desligamentos",
    view: "vw_fato_rh_mes",
    medida: "desligamentos",
    denominador: null,
    leitura: "quantas pessoas saíram no recorte",
  },
  {
    kpi: "rh-turnover-custo-do-turnover",
    metrica: "custo_do_turnover",
    view: "vw_fato_rh_mes",
    medida: "custoDeReposicao mais custoDeDesligamento",
    denominador: null,
    leitura: "rescindir, recrutar de novo e esperar a curva de aprendizado",
  },
  {
    kpi: "rh-turnover-custo-de-reposicao",
    metrica: "custo_de_reposicao",
    view: "vw_fato_rh_mes",
    medida: "custoDeReposicao",
    denominador: null,
    leitura: "a parcela que não aparece em nota fiscal nenhuma",
  },

  /* ---------------- rh/recrut ---------------- */
  {
    kpi: "rh-recrut-vagas-abertas",
    metrica: "vagas_abertas",
    view: "vw_fato_vagas",
    medida: "abertas",
    denominador: null,
    leitura: "vagas abertas no período",
  },
  {
    kpi: "rh-recrut-em-andamento",
    metrica: "vagas_em_andamento",
    view: "vw_fato_vagas",
    medida: "emAndamento",
    denominador: null,
    leitura: "da triagem à proposta",
  },
  {
    kpi: "rh-recrut-fechadas-12m",
    metrica: "vagas_fechadas",
    view: "vw_fato_vagas",
    medida: "fechadas",
    denominador: null,
    leitura: "contratações efetivadas",
  },
  {
    kpi: "rh-recrut-canceladas",
    metrica: "vagas_canceladas",
    view: "vw_fato_vagas",
    medida: "canceladas",
    denominador: null,
    leitura: "saíram do funil sem contratação",
  },

  /* ---------------- rh/trein ---------------- */
  {
    kpi: "rh-trein-horas-de-treinamento",
    metrica: "horas_treinamento",
    view: "vw_fato_treinamento",
    medida: "horas",
    denominador: null,
    leitura: "horas realizadas no recorte",
  },
  {
    kpi: "rh-trein-investimento",
    metrica: "investimento_treinamento",
    view: "vw_fato_treinamento",
    medida: "investimentoReais",
    denominador: null,
    leitura: "a verba gasta no recorte",
  },
  {
    kpi: "rh-trein-horas-por-fte",
    metrica: "horas_por_fte",
    view: "vw_fato_treinamento",
    medida: "horas",
    denominador: "vw_fato_rh_mes.headcountFte do último mês",
    leitura: "alcance do treinamento sobre o quadro inteiro",
  },

  /* ---------------- rh/engaj ---------------- */
  {
    kpi: "rh-engaj-enps",
    metrica: "enps",
    view: "vw_fato_rh_mes",
    medida: "promotores menos detratores",
    denominador: "respondentes",
    leitura: "o mesmo eNPS de rh/visao",
  },
  {
    kpi: "rh-engaj-engajamento",
    metrica: "engajamento_area",
    view: "vw_fato_rh_mes",
    medida: "pontosDeEngajamento",
    denominador: "respondentes",
    leitura: "média ponderada por respondente, não média das áreas",
  },
  {
    kpi: "rh-engaj-absenteismo",
    metrica: "absenteismo",
    view: "vw_fato_rh_mes",
    medida: "horasAusentes",
    denominador: "horasPrevistas",
    leitura: "horas não trabalhadas sobre horas previstas",
  },
  {
    kpi: "rh-engaj-area-mais-critica",
    metrica: "engajamento_minimo_por_area",
    view: "vw_fato_rh_mes",
    medida: "pontosDeEngajamento",
    denominador: "respondentes",
    leitura: "o menor engajamento entre as áreas do recorte",
  },

  /* ---------------- rh/sal ---------------- */
  {
    kpi: "rh-sal-folha-total",
    metrica: "folha_total",
    view: "vw_fato_rh_mes",
    medida: "folhaReais",
    denominador: null,
    leitura: "a mesma folha de rh/visao",
  },
  {
    kpi: "rh-sal-salario-medio",
    metrica: "salario_medio",
    view: "vw_fato_rh_mes",
    medida: "salarios",
    denominador: "headcountFte do último mês, vezes os meses do recorte",
    leitura: "salário mensal médio, sem encargos",
  },
  {
    kpi: "rh-sal-custo-por-colaborador",
    metrica: "custo_por_fte",
    view: "vw_fato_rh_mes",
    medida: "folhaReais",
    denominador: "headcountFte do último mês",
    leitura: "o mesmo custo por FTE de rh/visao",
  },
  {
    kpi: "rh-sal-beneficios",
    metrica: "beneficios",
    view: "vw_fato_rh_mes",
    medida: "beneficios",
    denominador: null,
    leitura: "a parcela de benefícios da folha",
  },
  {
    kpi: "rh-sal-variavel",
    metrica: "remuneracao_variavel",
    view: "vw_fato_rh_mes",
    medida: "variavel",
    denominador: null,
    leitura: "bônus e horas extras",
  },

  /* ---------------- fin/visao ---------------- */
  {
    kpi: "fin-visao-receita-bruta",
    metrica: "receita_bruta",
    view: "vw_fato_fin_mes",
    medida: "receitaBruta",
    denominador: null,
    leitura: "a receita antes das deduções",
  },
  {
    kpi: "fin-visao-receita-liquida",
    metrica: "receita_liquida",
    view: "vw_fato_fin_mes",
    medida: "receitaLiquida",
    denominador: null,
    leitura: "o denominador de quase toda margem do produto",
  },
  {
    kpi: "fin-visao-ebitda",
    metrica: "ebitda",
    view: "vw_fato_fin_mes",
    medida: "receitaLiquida menos cmv menos despesasOperacionais",
    denominador: null,
    leitura: "resultado da operação, antes de juros e depreciação",
  },
  {
    kpi: "fin-visao-lucro-liquido",
    metrica: "lucro_liquido",
    view: "vw_fato_fin_mes",
    medida: "os seis degraus da ponte da DRE",
    denominador: null,
    leitura: "o que sobra no fim: -R$ 8 mi no ano",
  },

  /* ---------------- fin/caixa ---------------- */
  {
    kpi: "fin-caixa-saldo-de-caixa",
    metrica: "saldo_caixa",
    view: "vw_fato_fin_mes",
    medida: "saldoDeCaixa do último mês do recorte",
    denominador: null,
    leitura: "quanto há em caixa no fechamento",
  },
  {
    kpi: "fin-caixa-geracao-operacional",
    metrica: "fco",
    view: "vw_fato_fin_mes",
    medida: "fco",
    denominador: null,
    leitura: "caixa que a operação gerou — não lucro",
  },
  {
    kpi: "fin-caixa-investimento-fci",
    metrica: "capex",
    view: "vw_fato_fin_mes",
    medida: "capex",
    denominador: null,
    leitura: "saída de caixa por investimento",
  },
  {
    kpi: "fin-caixa-financiamento-fcf",
    metrica: "financiamento",
    view: "vw_fato_fin_mes",
    medida: "financiamento",
    denominador: null,
    leitura: "amortização e juros, líquidos de captação",
  },

  /* ---------------- fin/orc ---------------- */
  {
    kpi: "fin-orc-orcado",
    metrica: "orcado",
    view: "vw_fato_orcamento",
    medida: "orcado",
    denominador: null,
    leitura: "o orçamento aprovado do período",
  },
  {
    kpi: "fin-orc-realizado",
    metrica: "realizado",
    view: "vw_fato_orcamento",
    medida: "realizado",
    denominador: null,
    leitura: "o gasto do período, por competência",
  },
  {
    kpi: "fin-orc-desvio",
    metrica: "desvio_orcamentario",
    view: "vw_fato_orcamento",
    medida: "realizado menos orcado",
    denominador: null,
    leitura: "positivo é estouro",
  },
  {
    kpi: "fin-orc-economia-obtida",
    metrica: "economia_orcamentaria",
    view: "vw_fato_orcamento",
    medida: "orcado menos realizado, só onde a diferença é positiva",
    denominador: null,
    leitura: "o que sobrou nos centros que gastaram menos",
  },

  /* ---------------- fin/fat ---------------- */
  {
    kpi: "fin-fat-faturamento",
    metrica: "receita_liquida",
    view: "vw_fato_fin_mes",
    medida: "receitaLiquida",
    denominador: null,
    leitura: "a mesma receita de fin/visao",
  },
  {
    kpi: "fin-fat-crescimento-yoy",
    metrica: "crescimento_yoy",
    view: "vw_fato_fin_mes",
    medida: "receitaLiquida",
    denominador: "receitaLiquidaAnoAnterior",
    leitura: "contra o mesmo período do ano anterior, pela série de comparação",
  },

  /* ---------------- int/cruz ---------------- */
  {
    kpi: "int-cruz-receita-por-colaborador",
    metrica: "receita_por_fte",
    view: "vw_fato_fin_mes",
    medida: "receitaLiquida",
    denominador: "vw_fato_rh_mes.headcountFte do último mês",
    leitura: "quanto cada pessoa gera de receita",
  },
  {
    kpi: "int-cruz-ebitda-per-capita",
    metrica: "ebitda_por_fte",
    view: "vw_fato_fin_mes",
    medida: "receitaLiquida menos cmv menos despesasOperacionais",
    denominador: "vw_fato_rh_mes.headcountFte do último mês",
    leitura: "quanto cada pessoa gera de resultado operacional",
  },
  {
    kpi: "int-cruz-despesa-de-pessoal",
    metrica: "folha_sobre_receita",
    view: "vw_fato_rh_mes",
    medida: "folhaReais",
    denominador: "vw_fato_fin_mes.receitaLiquida",
    leitura: "o peso da folha sobre a receita: 15,5%",
  },
  {
    kpi: "int-cruz-headcount",
    metrica: "headcount_fte",
    view: "vw_fato_rh_mes",
    medida: "headcountFte do último mês do recorte",
    denominador: null,
    leitura: "o mesmo quadro de rh/visao, na tela de cruzamento",
  },
];

/** A origem de um KPI, ou `undefined` se ainda não foi declarada. */
export function origemDoKpi(kpi: string): OrigemDeKpi | undefined {
  return ORIGEM_DOS_KPIS.find((o) => o.kpi === kpi);
}

/**
 * Só as origens dos KPIs que o protótipo mostrava cravados (achado 5).
 *
 * Derivada, e não uma segunda lista: duas listas com quase o mesmo conteúdo
 * divergem na primeira edição. Quem decide o que é constante é o registro de
 * KPIs, no campo `constanteNoPrototipo`.
 */
export const ORIGEM_DOS_KPIS_CONSTANTES: readonly OrigemDeKpi[] =
  ORIGEM_DOS_KPIS.filter((o) =>
    REGISTRO_DE_KPIS.some((k) => k.id === o.kpi && k.constanteNoPrototipo),
  );
