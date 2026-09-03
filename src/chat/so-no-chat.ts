/**
 * As métricas que só o chat alcança (perguntas de CFO, 2026-09-03).
 *
 * O catálogo tem uma regra: toda métrica é alcançável por algum caminho — uma
 * intenção do Anexo B, um cartão de KPI, ou uma nota de painel. As métricas
 * das perguntas de CFO da Dreamy entraram sem cartão: respondem no chat, e é
 * o chat quem as alcança. Esta lista nomeia cada uma, e dois testes a
 * sustentam pelos dois lados — nenhuma métrica do catálogo fica órfã, e cada
 * uma daqui é alvo de pelo menos uma pergunta do conjunto de roteamento.
 *
 * Quando ganharem cartão, saem daqui. Quando entrarem no Anexo B, também.
 */
export const SO_NO_CHAT: readonly string[] = [
  "patrimonio_liquido",
  "ativo_total",
  "ativo_circulante",
  "passivo_circulante",
  "imobilizado",
  "aplicacoes_financeiras",
  "divida_curto_prazo",
  "divida_longo_prazo",
  "divida_bruta",
  "divida_liquida",
  "capital_investido",
  "estoque_sem_giro",
  "a_receber_vencido",
  "a_pagar_vencido",
  "contas_a_receber",
  "contas_a_pagar",
  "juros_pagos",
  "impostos_sobre_lucro",
  "amortizacao_de_divida",
  "distribuicao_a_socios",
  "roe",
  "roa",
  "resultado_operacional_liquido",
  "roic",
  "giro_do_ativo",
  "multiplicador_de_capital",
  "liquidez_corrente",
  "liquidez_seca",
  "liquidez_imediata",
  "dias_de_caixa",
  "ncg",
  "saldo_de_tesouraria",
  "caixa_excedente",
  "divida_liquida_sobre_ebitda",
  "divida_sobre_pl",
  "cobertura_de_juros",
  "cobertura_do_servico_da_divida",
  "custo_medio_da_divida",
  "custo_liquido_da_divida",
  "custo_do_prazo_de_recebimento",
  "custo_de_carregar_estoque",
  "fluxo_de_caixa_livre",
  "variacao_de_capital_de_giro",
  "divida_capital_de_giro",
  "divida_financiamento_longo_prazo",
  "divida_antecipacao_de_recebiveis",
];
