-- As oito views prontas que vieram com a base (`vw_*.csv`) entram como
-- **gabarito**, e não como fonte.
--
-- A razão está na regra 4 da seção 9.2 do PRD: taxa nenhuma é armazenada.
-- Esses arquivos trazem `turnover_mes_pct`, `margem_ebitda_pct`,
-- `custo_por_fte`, `ticket_medio` — números prontos que não sabem recalcular-se
-- sob recorte. As views do produto (005 a 007) derivam tudo do detalhe; estas
-- tabelas servem para `dados:conferir` provar que a derivação fecha com o que
-- o gerador da base calculou.

CREATE TABLE IF NOT EXISTS amanna.gabarito_rh_mes (
  competencia char(7) NOT NULL,
  ano int, mes int,
  id_entidade text NOT NULL,
  entidade text, grupo_entidade text,
  area text NOT NULL, area_slug text,
  modalidade text NOT NULL, modalidade_slug text,
  headcount_fte numeric, colaboradores int,
  admissoes numeric, desligamentos numeric, desligamentos_voluntarios numeric,
  turnover_mes_pct numeric,
  folha_salarios numeric, folha_encargos numeric, folha_beneficios numeric,
  folha_variavel numeric, folha_total numeric,
  custo_por_fte numeric, salario_medio numeric, horas_extras_qtd numeric,
  eventos_ausencia numeric, dias_ausencia numeric, horas_ausencia numeric,
  absenteismo_pct numeric,
  participacoes_treinamento numeric, horas_treinamento numeric,
  horas_treinamento_por_fte numeric, custo_treinamento numeric,
  conclusao_media_pct numeric,
  respostas_pesquisa numeric, enps numeric, engajamento_medio numeric,
  PRIMARY KEY (competencia, id_entidade, area, modalidade)
);

CREATE TABLE IF NOT EXISTS amanna.gabarito_recrutamento_mes (
  competencia char(7) NOT NULL,
  id_entidade text NOT NULL,
  area text NOT NULL,
  vagas_abertas int, vagas_fechadas int,
  candidaturas int, triagem int, entrevistas int, propostas int, contratacoes int,
  dias_medio_fechamento numeric,
  custo_recrutamento numeric, custo_por_contratacao numeric,
  entidade text, area_slug text, ano int, mes int,
  PRIMARY KEY (competencia, id_entidade, area)
);

CREATE TABLE IF NOT EXISTS amanna.gabarito_dre_mes (
  competencia char(7) NOT NULL,
  id_entidade text NOT NULL,
  linha_dre text,
  conta text NOT NULL,
  conta_descricao text,
  area text,
  id_centro_custo text NOT NULL,
  valor numeric,
  ano int, mes int, entidade text, grupo_entidade text, centro_custo text,
  PRIMARY KEY (competencia, id_entidade, conta, id_centro_custo)
);

CREATE TABLE IF NOT EXISTS amanna.gabarito_fin_mes (
  competencia char(7) NOT NULL,
  ano int, mes int,
  id_entidade text NOT NULL,
  entidade text, grupo_entidade text,
  receita_bruta numeric, deducoes numeric, receita_liquida numeric, cmv numeric,
  lucro_bruto numeric, despesas_operacionais numeric, ebitda numeric,
  depreciacao_amortizacao numeric, ebit numeric, resultado_financeiro numeric,
  lair numeric, ir_csll numeric, lucro_liquido numeric,
  margem_bruta_pct numeric, margem_ebitda_pct numeric, margem_liquida_pct numeric,
  cobertura_juros_vezes numeric,
  PRIMARY KEY (competencia, id_entidade)
);

CREATE TABLE IF NOT EXISTS amanna.gabarito_faturamento_mes (
  competencia char(7) NOT NULL,
  id_entidade text NOT NULL,
  id_cliente text NOT NULL,
  cliente text, segmento text, canal text, rating_credito text, uf_destino text,
  notas int,
  faturamento_bruto numeric, faturamento_liquido numeric,
  desconto numeric, comissao numeric, ticket_medio numeric,
  ano int, mes int,
  PRIMARY KEY (competencia, id_entidade, id_cliente)
);

CREATE TABLE IF NOT EXISTS amanna.gabarito_contas_mes (
  competencia char(7) NOT NULL,
  id_entidade text NOT NULL,
  titulos_receber int, valor_receber numeric, valor_recebido numeric,
  pmr_dias numeric, atraso_medio_dias numeric, pdd numeric, juros_recebidos numeric,
  inadimplencia_pct numeric,
  titulos_pagar int, valor_pagar numeric, valor_pago numeric, pmp_dias numeric,
  desconto_antecipacao numeric, juros_mora numeric,
  ano int, mes int, entidade text,
  pme_dias numeric, ciclo_financeiro_dias numeric,
  PRIMARY KEY (competencia, id_entidade)
);

CREATE TABLE IF NOT EXISTS amanna.gabarito_caixa_mes (
  competencia char(7) NOT NULL,
  id_entidade text NOT NULL,
  classe_fluxo text NOT NULL,
  entradas numeric, saidas numeric, fluxo_liquido numeric,
  ano int, mes int, entidade text,
  PRIMARY KEY (competencia, id_entidade, classe_fluxo)
);

CREATE TABLE IF NOT EXISTS amanna.gabarito_int_mes (
  competencia char(7) NOT NULL,
  id_entidade text NOT NULL,
  receita_liquida numeric, ebitda numeric, lucro_liquido numeric, cmv numeric,
  headcount_fte numeric, folha_total numeric, horas_treinamento numeric,
  ano int, mes int, entidade text,
  receita_por_colaborador numeric, ebitda_per_capita numeric,
  peso_folha_receita_pct numeric, folha_sobre_cmv_pct numeric,
  PRIMARY KEY (competencia, id_entidade)
);
