/**
 * As métricas de apoio: o que explica o número (T-328).
 *
 * O painel que detalha a métrica dá a **composição** (a ponte da DRE). Isto dá
 * o **contexto**: para o ROE, lucro líquido e patrimônio; para a liquidez
 * corrente, o que há de caixa, recebível e estoque. O estágio 2 lê cada uma
 * pelo mesmo `lerMetrica` e no mesmo recorte — nenhuma nasce fora do catálogo,
 * e todas passam pelo verificador como qualquer outro número.
 *
 * ## Por que em código, e não no YAML
 *
 * O esquema do catálogo é fechado de propósito: o que Controladoria revisa lá é
 * **definição** — fórmula, fonte, unidade, sentido. "O que o chat cita ao
 * explicar" é editorial do chat, e mora com o chat, como `roteamento.ts` já faz
 * para tela e painel. Um teste faz este mapa tão fechado quanto o esquema: id
 * que não existe no catálogo reprova a suíte.
 *
 * A escolha de cada lista segue o documento de CFO da Dreamy: são os números
 * que a resposta-modelo cita ao explicar o principal.
 */

/** Quantas de apoio uma principal pode declarar. */
export const MAXIMO_DE_APOIO = 4;

export const APOIO: Readonly<Record<string, readonly string[]>> = {
  // Rentabilidade e retorno
  roe: [
    "lucro_liquido",
    "patrimonio_liquido",
    "giro_do_ativo",
    "multiplicador_de_capital",
  ],
  roa: ["lucro_liquido", "ativo_total", "roe", "imobilizado"],
  roic: [
    "resultado_operacional_liquido",
    "capital_investido",
    "custo_medio_da_divida",
    "caixa_excedente",
  ],
  margem_liquida: ["lucro_liquido", "receita_liquida"],
  margem_bruta: ["receita_liquida"],
  ebitda: ["margem_ebitda", "conversao_de_caixa", "fco", "juros_pagos"],
  lucro_liquido: [
    "variacao_de_capital_de_giro",
    "capex",
    "amortizacao_de_divida",
    "distribuicao_a_socios",
  ],
  fluxo_de_caixa_livre: [
    "ebitda",
    "variacao_de_capital_de_giro",
    "juros_pagos",
    "capex",
  ],
  crescimento_yoy: ["receita_liquida"],

  // Liquidez e capital de giro
  liquidez_corrente: [
    "saldo_caixa",
    "contas_a_receber",
    "a_receber_vencido",
    "estoque_sem_giro",
  ],
  liquidez_seca: ["liquidez_imediata", "pme", "dias_de_caixa", "saldo_caixa"],
  liquidez_imediata: ["saldo_caixa", "dias_de_caixa"],
  pmr: [
    "contas_a_receber",
    "a_receber_vencido",
    "custo_do_prazo_de_recebimento",
  ],
  pmp: ["contas_a_pagar", "a_pagar_vencido", "pmr"],
  pme: ["estoque_sem_giro", "custo_de_carregar_estoque", "ciclo_financeiro"],
  ciclo_financeiro: ["pme", "pmr", "pmp", "ncg"],
  ncg: [
    "saldo_de_tesouraria",
    "saldo_caixa",
    "caixa_excedente",
    "ciclo_financeiro",
  ],
  saldo_de_tesouraria: ["saldo_caixa", "divida_curto_prazo", "ncg"],
  caixa_excedente: ["saldo_caixa", "ncg"],

  // Endividamento
  divida_liquida_sobre_ebitda: [
    "divida_liquida",
    "divida_curto_prazo",
    "divida_longo_prazo",
    "ebitda",
  ],
  divida_liquida: ["divida_bruta", "saldo_caixa"],
  divida_bruta: ["divida_curto_prazo", "divida_longo_prazo"],
  cobertura_de_juros: [
    "juros_pagos",
    "custo_medio_da_divida",
    "cobertura_do_servico_da_divida",
    "amortizacao_de_divida",
  ],
  custo_medio_da_divida: [
    "divida_capital_de_giro",
    "divida_financiamento_longo_prazo",
    "divida_antecipacao_de_recebiveis",
    "juros_pagos",
  ],
  custo_liquido_da_divida: ["custo_medio_da_divida", "roic"],
  divida_sobre_pl: ["divida_bruta", "patrimonio_liquido", "roe", "roa"],

  // Margens e operação (etapa 2)
  margem_de_contribuicao: [
    "custos_fixos",
    "custos_variaveis",
    "margem_bruta",
    "margem_de_contribuicao_valor",
  ],
  contas_com_classificacao_inconsistente: [
    "valor_em_classificacao_inconsistente",
    "margem_bruta",
    "margem_de_contribuicao",
  ],
  ponto_de_equilibrio: [
    "ponto_de_equilibrio_caixa",
    "ponto_de_equilibrio_economico",
    "margem_de_contribuicao",
    "custos_fixos",
  ],
  margem_de_seguranca: [
    "ponto_de_equilibrio",
    "receita_liquida",
    "concentracao_top_10",
  ],
  gao: [
    "custos_fixos",
    "margem_de_contribuicao_valor",
    "resultado_com_receita_10_menor",
  ],
  receita_dos_principais_clientes: [
    "concentracao_top_10",
    "receita_liquida",
    "ticket_medio",
  ],

  // Qualidade do razão (etapa 2)
  lancamentos_para_revisao: [
    "valor_para_revisao",
    "lancamentos_fora_do_padrao",
    "pares_de_estorno",
    "lancamentos_de_competencia_anterior",
  ],
  completude_da_base: [
    "valor_sem_centro_de_custo",
    "valor_em_conta_generica",
    "valor_sem_natureza",
    "lancamentos_do_mes",
  ],
  indicios_de_competencia: [
    "contas_recorrentes_sem_lancamento",
    "lancamentos_duplicados",
    "lancamentos_de_competencia_anterior",
    "efeito_no_resultado_da_competencia",
  ],
  movimentacao_com_partes_relacionadas: [
    "mutuo_com_socios",
    "roe",
    "roe_sem_partes_relacionadas",
  ],
};

export function apoioDe(metrica: string): readonly string[] {
  return APOIO[metrica] ?? [];
}
