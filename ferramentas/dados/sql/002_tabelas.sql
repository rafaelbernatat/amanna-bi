-- As tabelas cruas: uma por CSV de docs/dados, coluna a coluna, com o nome do
-- cabeçalho. Nada é derivado aqui — derivação é trabalho das views.
--
-- Tipos: dinheiro e quantidade em `numeric` (a carga não arredonda),
-- competência em `char(7)` (AAAA-MM), datas em `date`. Chave primária é o grão
-- que o dicionário declara. Sem chave estrangeira de propósito: a base é
-- sintética e a carga trunca e recarrega tabela a tabela, e uma FK faria a
-- ordem de carga virar dependência escondida.

CREATE TABLE IF NOT EXISTS amanna.dim_calendario (
  data date PRIMARY KEY,
  ano int NOT NULL,
  mes int NOT NULL,
  competencia char(7) NOT NULL,
  mes_abrev text,
  mes_extenso text,
  trimestre text,
  semestre text,
  semana_ano int,
  dia int,
  dia_semana text,
  dia_util char(1) NOT NULL,
  feriado text
);

CREATE TABLE IF NOT EXISTS amanna.dim_entidade (
  id_entidade text PRIMARY KEY,
  entidade text NOT NULL,
  grupo_filtro text NOT NULL,
  razao_social text,
  cidade text,
  uf text,
  regime_tributario text,
  tipo text
);

CREATE TABLE IF NOT EXISTS amanna.dim_centro_custo (
  id_centro_custo text PRIMARY KEY,
  centro_custo text,
  area text,
  area_slug text NOT NULL,
  tipo text,
  rateio_dre text,
  responsavel text
);

CREATE TABLE IF NOT EXISTS amanna.dim_conta_contabil (
  conta text PRIMARY KEY,
  conta_descricao text,
  classe text,
  grupo text,
  natureza text,
  demonstrativo text,
  linha_dre text
);

CREATE TABLE IF NOT EXISTS amanna.dim_cliente (
  id_cliente text PRIMARY KEY,
  cliente text,
  cnpj text,
  segmento text,
  porte text,
  uf text,
  cidade text,
  rating_credito text,
  limite_credito numeric,
  prazo_medio_contratado int,
  cliente_desde date,
  canal text,
  status text
);

CREATE TABLE IF NOT EXISTS amanna.dim_fornecedor (
  id_fornecedor text PRIMARY KEY,
  fornecedor text,
  cnpj text,
  categoria text,
  uf text,
  cidade text,
  prazo_pagamento int,
  condicao text,
  critico char(1),
  status text
);

CREATE TABLE IF NOT EXISTS amanna.dim_cargo (
  id_cargo text PRIMARY KEY,
  cargo text,
  familia text,
  area text,
  nivel text,
  salario_min numeric,
  salario_medio numeric,
  salario_max numeric,
  cbo text,
  elegivel_bonus char(1),
  elegivel_comissao char(1)
);

CREATE TABLE IF NOT EXISTS amanna.dim_produto_servico (
  id_produto text PRIMARY KEY,
  produto text,
  familia text,
  tipo text,
  unidade text,
  preco_tabela numeric,
  custo_padrao numeric,
  margem_alvo_pct numeric,
  ncm text,
  cfop_padrao text,
  status text
);

-- Recursos Humanos ----------------------------------------------------------

CREATE TABLE IF NOT EXISTS amanna.colaboradores (
  matricula text PRIMARY KEY,
  nome text,
  cpf_ficticio text,
  data_nascimento date,
  faixa_etaria text,
  genero text,
  escolaridade text,
  uf text,
  cidade text,
  id_entidade text NOT NULL,
  area text,
  id_centro_custo text NOT NULL,
  centro_custo text,
  id_cargo text,
  cargo text,
  nivel text,
  modalidade text NOT NULL,
  tipo_contrato text,
  jornada_semanal numeric,
  fte numeric,
  salario_base numeric,
  data_admissao date NOT NULL,
  data_desligamento date,
  motivo_desligamento text,
  tipo_desligamento text,
  status text,
  gestor_matricula text,
  sindicato text,
  banco text
);

CREATE TABLE IF NOT EXISTS amanna.movimentacao_pessoal (
  competencia char(7) NOT NULL,
  data date NOT NULL,
  matricula text NOT NULL,
  evento text NOT NULL,
  motivo text,
  tipo text,
  PRIMARY KEY (matricula, data, evento)
);

CREATE TABLE IF NOT EXISTS amanna.folha_pagamento (
  competencia char(7) NOT NULL,
  ano int,
  mes int,
  matricula text NOT NULL,
  nome text,
  id_entidade text NOT NULL,
  area text,
  id_centro_custo text NOT NULL,
  centro_custo text,
  cargo text,
  nivel text,
  modalidade text NOT NULL,
  fte numeric NOT NULL,
  dias_trabalhados int,
  salario_base numeric NOT NULL DEFAULT 0,
  horas_extras_qtd numeric,
  horas_extras numeric NOT NULL DEFAULT 0,
  adicional_noturno numeric NOT NULL DEFAULT 0,
  periculosidade numeric NOT NULL DEFAULT 0,
  comissao numeric NOT NULL DEFAULT 0,
  bonus numeric NOT NULL DEFAULT 0,
  plr numeric NOT NULL DEFAULT 0,
  verbas_rescisorias numeric NOT NULL DEFAULT 0,
  provisao_ferias numeric NOT NULL DEFAULT 0,
  provisao_decimo numeric NOT NULL DEFAULT 0,
  inss_patronal numeric NOT NULL DEFAULT 0,
  rat numeric NOT NULL DEFAULT 0,
  terceiros numeric NOT NULL DEFAULT 0,
  fgts numeric NOT NULL DEFAULT 0,
  vale_refeicao numeric NOT NULL DEFAULT 0,
  vale_alimentacao numeric NOT NULL DEFAULT 0,
  vale_transporte numeric NOT NULL DEFAULT 0,
  plano_saude numeric NOT NULL DEFAULT 0,
  plano_odontologico numeric NOT NULL DEFAULT 0,
  seguro_vida numeric NOT NULL DEFAULT 0,
  auxilio_creche numeric NOT NULL DEFAULT 0,
  auxilio_home_office numeric NOT NULL DEFAULT 0,
  inss_empregado numeric NOT NULL DEFAULT 0,
  irrf numeric NOT NULL DEFAULT 0,
  desconto_vt numeric NOT NULL DEFAULT 0,
  coparticipacao_saude numeric NOT NULL DEFAULT 0,
  desconto_faltas numeric NOT NULL DEFAULT 0,
  adiantamento numeric NOT NULL DEFAULT 0,
  total_proventos numeric NOT NULL DEFAULT 0,
  total_descontos numeric NOT NULL DEFAULT 0,
  liquido_a_pagar numeric NOT NULL DEFAULT 0,
  total_encargos numeric NOT NULL DEFAULT 0,
  total_beneficios numeric NOT NULL DEFAULT 0,
  total_provisoes numeric NOT NULL DEFAULT 0,
  custo_total_empresa numeric NOT NULL DEFAULT 0,
  PRIMARY KEY (competencia, matricula)
);
CREATE INDEX IF NOT EXISTS folha_competencia ON amanna.folha_pagamento (competencia, id_entidade, id_centro_custo);

CREATE TABLE IF NOT EXISTS amanna.ponto_ausencias (
  id_ausencia text PRIMARY KEY,
  competencia char(7) NOT NULL,
  matricula text NOT NULL,
  nome text,
  area text,
  id_centro_custo text,
  id_entidade text,
  modalidade text,
  tipo text,
  data_inicio date,
  data_fim date,
  dias int,
  horas_perdidas numeric NOT NULL DEFAULT 0,
  abonado char(1),
  cid text,
  observacao text
);

CREATE TABLE IF NOT EXISTS amanna.vagas_recrutamento (
  id_vaga text PRIMARY KEY,
  competencia_abertura char(7) NOT NULL,
  data_abertura date,
  data_fechamento date,
  status text,
  area text,
  id_cargo text,
  cargo text,
  nivel text,
  id_centro_custo text,
  id_entidade text,
  modalidade text,
  motivo text,
  salario_ofertado numeric,
  recrutador text,
  fonte_principal text,
  candidaturas int NOT NULL DEFAULT 0,
  triagem int NOT NULL DEFAULT 0,
  entrevistas int NOT NULL DEFAULT 0,
  propostas int NOT NULL DEFAULT 0,
  contratacoes int NOT NULL DEFAULT 0,
  dias_para_fechar int,
  sla_dias int,
  custo_anuncio numeric NOT NULL DEFAULT 0,
  custo_headhunter numeric NOT NULL DEFAULT 0,
  custo_exames numeric NOT NULL DEFAULT 0,
  custo_total numeric NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS amanna.candidaturas (
  id_candidatura text PRIMARY KEY,
  id_vaga text NOT NULL,
  competencia char(7) NOT NULL,
  data_candidatura date,
  candidato text,
  genero text,
  uf text,
  fonte text,
  etapa_final text,
  pretensao_salarial numeric,
  nota_triagem numeric,
  reprovado_em text,
  motivo_reprova text
);

CREATE TABLE IF NOT EXISTS amanna.treinamento_turmas (
  id_turma text PRIMARY KEY,
  competencia char(7) NOT NULL,
  treinamento text,
  categoria text,
  carga_horaria numeric,
  modalidade text,
  fornecedor text,
  instrutor text,
  data_inicio date,
  data_fim date,
  vagas int,
  custo_hora_aluno numeric,
  id_centro_custo text,
  obrigatorio char(1)
);

CREATE TABLE IF NOT EXISTS amanna.treinamento_participacoes (
  id_participacao text PRIMARY KEY,
  id_turma text NOT NULL,
  competencia char(7) NOT NULL,
  treinamento text,
  categoria text,
  matricula text NOT NULL,
  nome text,
  area text,
  id_centro_custo text,
  id_entidade text,
  modalidade_colaborador text,
  horas_previstas numeric,
  horas_realizadas numeric NOT NULL DEFAULT 0,
  conclusao_pct numeric,
  status text,
  nota_avaliacao numeric,
  custo numeric NOT NULL DEFAULT 0,
  certificado char(1)
);

CREATE TABLE IF NOT EXISTS amanna.pesquisa_engajamento (
  id_resposta text PRIMARY KEY,
  onda text,
  competencia char(7) NOT NULL,
  data_resposta date,
  matricula text NOT NULL,
  area text,
  id_centro_custo text,
  id_entidade text,
  modalidade text,
  genero text,
  faixa_etaria text,
  tempo_casa_meses int,
  enps_nota int,
  enps_classificacao text,
  dim_lideranca numeric,
  dim_reconhecimento numeric,
  dim_carreira numeric,
  dim_remuneracao numeric,
  dim_ambiente numeric,
  dim_carga numeric,
  dim_comunicacao numeric,
  dim_autonomia numeric,
  dim_proposito numeric,
  dim_ferramentas numeric,
  comentario_aberto text
);

CREATE TABLE IF NOT EXISTS amanna.apontamento_horas (
  competencia char(7) NOT NULL,
  matricula text NOT NULL,
  nome text,
  area text,
  id_centro_custo text,
  id_projeto text NOT NULL,
  projeto text,
  id_cliente text,
  horas_apontadas numeric,
  horas_faturaveis numeric,
  custo_hora numeric,
  custo_apontado numeric,
  PRIMARY KEY (competencia, matricula, id_projeto)
);

-- Financeiro e fiscal -------------------------------------------------------

CREATE TABLE IF NOT EXISTS amanna.notas_fiscais_saida (
  id_nf text PRIMARY KEY,
  numero text,
  serie text,
  chave_acesso text,
  competencia char(7) NOT NULL,
  data_emissao date,
  id_entidade text NOT NULL,
  uf_origem text,
  id_cliente text,
  cliente text,
  cnpj_cliente text,
  uf_destino text,
  segmento text,
  canal text,
  rating_credito text,
  cfop text,
  natureza_operacao text,
  valor_produtos numeric,
  desconto numeric,
  valor_total numeric NOT NULL DEFAULT 0,
  icms numeric,
  pis numeric,
  cofins numeric,
  iss numeric,
  valor_liquido numeric NOT NULL DEFAULT 0,
  condicao_pagamento text,
  prazo_dias int,
  vendedor text,
  comissao_pct numeric,
  comissao_valor numeric,
  id_centro_custo text,
  status text,
  transportadora text
);

CREATE TABLE IF NOT EXISTS amanna.itens_nota_saida (
  id_nf text NOT NULL,
  item int NOT NULL,
  id_produto text,
  produto text,
  familia text,
  tipo text,
  unidade text,
  ncm text,
  quantidade numeric,
  preco_unitario numeric,
  valor_total numeric,
  custo_unitario_padrao numeric,
  custo_total numeric,
  margem_contribuicao numeric,
  PRIMARY KEY (id_nf, item)
);

CREATE TABLE IF NOT EXISTS amanna.notas_fiscais_entrada (
  id_nf_entrada text PRIMARY KEY,
  numero text,
  serie text,
  chave_acesso text,
  competencia char(7) NOT NULL,
  data_emissao date,
  id_entidade text NOT NULL,
  id_fornecedor text,
  fornecedor text,
  cnpj_fornecedor text,
  uf_fornecedor text,
  categoria_fornecedor text,
  bloco_dre text,
  conta text,
  conta_descricao text,
  area text,
  id_centro_custo text,
  centro_custo text,
  cfop text,
  valor_total numeric,
  icms_creditado numeric,
  pis_creditado numeric,
  cofins_creditado numeric,
  valor_liquido_custo numeric,
  condicao_pagamento text,
  prazo_dias int,
  aprovador text,
  pedido_compra text,
  rateio text,
  observacao text
);

CREATE TABLE IF NOT EXISTS amanna.contas_receber (
  id_titulo text PRIMARY KEY,
  id_nf text,
  competencia char(7) NOT NULL,
  id_cliente text,
  cliente text,
  rating_credito text,
  id_entidade text NOT NULL,
  data_emissao date NOT NULL,
  data_vencimento date NOT NULL,
  valor_titulo numeric NOT NULL DEFAULT 0,
  valor_recebido numeric NOT NULL DEFAULT 0,
  data_recebimento date,
  dias_atraso int,
  status text,
  juros_multa numeric,
  provisao_pdd numeric,
  faixa_aging text,
  forma_cobranca text,
  condicao text
);
CREATE INDEX IF NOT EXISTS contas_receber_datas ON amanna.contas_receber (id_entidade, data_emissao, data_recebimento);

CREATE TABLE IF NOT EXISTS amanna.contas_pagar (
  id_titulo text PRIMARY KEY,
  id_nf_entrada text,
  competencia char(7) NOT NULL,
  id_fornecedor text,
  fornecedor text,
  categoria text,
  id_entidade text NOT NULL,
  id_centro_custo text,
  conta text,
  conta_descricao text,
  data_emissao date NOT NULL,
  data_vencimento date NOT NULL,
  valor_titulo numeric NOT NULL DEFAULT 0,
  valor_pago numeric NOT NULL DEFAULT 0,
  data_pagamento date,
  desconto_antecipacao numeric,
  juros_mora numeric,
  dias_para_pagar int,
  status text,
  forma_pagamento text,
  aprovado_por text
);
CREATE INDEX IF NOT EXISTS contas_pagar_datas ON amanna.contas_pagar (id_entidade, data_emissao, data_pagamento);

-- Os dois arquivos do razão caem numa tabela só. `arquivo_origem` guarda de
-- qual veio cada lançamento, e é preenchida pela carga — não vem do CSV.
CREATE TABLE IF NOT EXISTS amanna.razao_contabil (
  id_lancamento text PRIMARY KEY,
  lote text,
  data date NOT NULL,
  competencia char(7) NOT NULL,
  id_entidade text NOT NULL,
  conta text NOT NULL,
  conta_descricao text,
  linha_dre text,
  id_centro_custo text,
  centro_custo text,
  area text,
  historico text,
  debito numeric NOT NULL DEFAULT 0,
  credito numeric NOT NULL DEFAULT 0,
  documento_tipo text,
  documento_numero text,
  nf_numero text,
  parceiro_tipo text,
  id_parceiro text,
  parceiro_nome text,
  id_projeto text,
  origem text,
  usuario text,
  status text,
  arquivo_origem text
);
CREATE INDEX IF NOT EXISTS razao_competencia ON amanna.razao_contabil (competencia, id_entidade, conta);
CREATE INDEX IF NOT EXISTS razao_lote ON amanna.razao_contabil (lote);

-- O extrato traz lançamentos sem `id_lancamento` (tarifas e rendimentos não
-- passam pelo razão), então a chave é própria e a ordem dentro do dia é a de
-- chegada — que é a ordem do arquivo.
CREATE TABLE IF NOT EXISTS amanna.movimento_caixa (
  id bigserial PRIMARY KEY,
  data date NOT NULL,
  competencia char(7) NOT NULL,
  id_entidade text NOT NULL,
  banco_conta text,
  classe_fluxo text NOT NULL,
  natureza text,
  historico text,
  documento text,
  parceiro text,
  entrada numeric NOT NULL DEFAULT 0,
  saida numeric NOT NULL DEFAULT 0,
  saldo_apos numeric,
  id_lancamento text,
  forma text
);
CREATE INDEX IF NOT EXISTS caixa_competencia ON amanna.movimento_caixa (id_entidade, competencia, data);

CREATE TABLE IF NOT EXISTS amanna.orcamento (
  competencia char(7) NOT NULL,
  ano int,
  mes int,
  id_entidade text NOT NULL,
  id_centro_custo text NOT NULL,
  centro_custo text,
  area text,
  conta text NOT NULL,
  conta_descricao text,
  linha_dre text,
  versao text,
  valor_orcado numeric NOT NULL DEFAULT 0,
  valor_realizado numeric NOT NULL DEFAULT 0,
  desvio_valor numeric,
  desvio_pct numeric,
  responsavel text,
  justificativa text,
  PRIMARY KEY (competencia, id_entidade, id_centro_custo, conta)
);

CREATE TABLE IF NOT EXISTS amanna.projetos (
  id_projeto text PRIMARY KEY,
  projeto text,
  id_cliente text,
  cliente text,
  id_entidade text,
  gerente text,
  data_inicio date,
  data_fim_prevista date,
  data_fim_real date,
  status text,
  receita_contratada numeric,
  custo_material numeric,
  custo_mao_de_obra numeric,
  horas_previstas numeric,
  horas_realizadas numeric,
  margem_bruta numeric,
  margem_bruta_pct numeric
);

CREATE TABLE IF NOT EXISTS amanna.emprestimos (
  id_contrato text PRIMARY KEY,
  banco text,
  modalidade text NOT NULL,
  indexador text,
  taxa_efetiva_aa numeric,
  principal numeric NOT NULL,
  saldo_devedor_2026_12 numeric NOT NULL,
  data_contratacao date NOT NULL,
  data_vencimento date NOT NULL,
  carencia_meses int NOT NULL DEFAULT 0,
  parcelas int NOT NULL,
  garantia text,
  id_entidade text NOT NULL,
  covenant text
);

CREATE TABLE IF NOT EXISTS amanna.metas (
  modulo text NOT NULL,
  indicador text PRIMARY KEY,
  unidade text,
  meta numeric,
  sentido text,
  periodicidade text,
  responsavel text
);
