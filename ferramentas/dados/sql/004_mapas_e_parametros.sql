-- Mapas de código e parâmetros declarados.
--
-- A base fala a língua do ERP ("Ensino médio", "B ou inferior", "Online ao
-- vivo"); o produto fala em códigos estáveis (`medio`, `B-ou-inferior`,
-- `online-ao-vivo`). A tradução mora numa tabela, com a origem de cada linha,
-- e não em CASE espalhado pelas views: quem trocar uma taxonomia (H-53, H-54,
-- H-56) troca aqui, e todas as views seguem.
--
-- Os parâmetros são a parte honesta do desenho: o que não é derivável do dado
-- fica NULL até alguém decidir, e a decisão é uma linha com nome e data.

CREATE TABLE IF NOT EXISTS amanna.map_codigo (
  dominio text NOT NULL,
  valor_origem text NOT NULL,
  codigo text NOT NULL,
  rotulo text,
  ordem int NOT NULL DEFAULT 0,
  origem text NOT NULL DEFAULT 'engenharia-2026-09',
  PRIMARY KEY (dominio, valor_origem)
);

INSERT INTO amanna.map_codigo (dominio, valor_origem, codigo, rotulo, ordem) VALUES
  -- Modalidade de trabalho: o vocabulário fechado da seção 6.2.
  ('modalidade', 'Presencial', 'presencial', 'Presencial', 0),
  ('modalidade', 'Híbrido', 'hibrido', 'Híbrido', 1),
  ('modalidade', 'Remoto', 'remoto', 'Remoto', 2),
  -- Escolaridade: os códigos de vw_dim_escolaridade.
  ('escolaridade', 'Ensino médio', 'medio', 'Médio', 0),
  ('escolaridade', 'Técnico', 'tecnico', 'Técnico', 1),
  ('escolaridade', 'Superior', 'superior', 'Superior', 2),
  ('escolaridade', 'Pós-graduação', 'pos-graduacao', 'Pós-graduação', 3),
  ('escolaridade', 'Mestrado ou doutorado', 'mestrado-mais', 'Mestrado+', 4),
  -- Gênero: vw_dim_genero. "Outro" e "não informado" juntos até H-55.
  ('genero', 'Masculino', 'masculino', 'Masculino', 0),
  ('genero', 'Feminino', 'feminino', 'Feminino', 1),
  ('genero', 'Outro ou não informado', 'outro-ou-nao-informado', 'Outro / não informado', 2),
  -- Tipo de desligamento: a lista da base, sem reinterpretar (H-54 decide).
  ('tipo_desligamento', 'Voluntário', 'voluntario', 'Voluntário', 0),
  ('tipo_desligamento', 'Involuntário', 'involuntario', 'Involuntário', 1),
  ('tipo_desligamento', 'Acordo', 'acordo', 'Acordo', 2),
  ('tipo_desligamento', 'Fim de contrato', 'fim-de-contrato', 'Fim de contrato', 3),
  -- Rating de crédito: as quatro faixas do protótipo (H-53).
  ('rating', 'AAA-A', 'AAA-A', 'AAA–A', 0),
  ('rating', 'BBB', 'BBB', 'BBB', 1),
  ('rating', 'BB', 'BB', 'BB', 2),
  ('rating', 'B ou inferior', 'B-ou-inferior', 'B ou inferior', 3),
  -- Segmento comercial do cliente: os dez da base (H-57).
  ('segmento', 'Agronegócio', 'agronegocio', 'Agronegócio', 0),
  ('segmento', 'Automotivo', 'automotivo', 'Automotivo', 1),
  ('segmento', 'Construção civil', 'construcao-civil', 'Construção civil', 2),
  ('segmento', 'Cosméticos', 'cosmeticos', 'Cosméticos', 3),
  ('segmento', 'Distribuição', 'distribuicao', 'Distribuição', 4),
  ('segmento', 'E-commerce', 'e-commerce', 'E-commerce', 5),
  ('segmento', 'Farmacêutico', 'farmaceutico', 'Farmacêutico', 6),
  ('segmento', 'Indústria de bebidas', 'industria-de-bebidas', 'Indústria de bebidas', 7),
  ('segmento', 'Serviços B2B', 'servicos-b2b', 'Serviços B2B', 8),
  ('segmento', 'Varejo alimentar', 'varejo-alimentar', 'Varejo alimentar', 9),
  -- Modalidade da turma de treinamento.
  ('modalidade_treinamento', 'Presencial', 'presencial', 'Presencial', 0),
  ('modalidade_treinamento', 'Online ao vivo', 'online-ao-vivo', 'Online ao vivo', 1),
  ('modalidade_treinamento', 'EAD', 'ead', 'EAD', 2),
  -- Trilha (categoria do treinamento).
  ('trilha', 'Obrigatório', 'obrigatorio', 'Obrigatório', 0),
  ('trilha', 'Técnico', 'tecnico', 'Técnico', 1),
  ('trilha', 'Liderança', 'lideranca', 'Liderança', 2),
  ('trilha', 'Comercial', 'comercial', 'Comercial', 3),
  ('trilha', 'Operacional', 'operacional', 'Operacional', 4),
  ('trilha', 'Idiomas', 'idiomas', 'Idiomas', 5),
  ('trilha', 'Integração', 'integracao', 'Integração', 6),
  -- Fonte do candidato.
  ('fonte_candidato', 'Indicação interna', 'indicacao', 'Indicação', 0),
  ('fonte_candidato', 'LinkedIn', 'linkedin', 'LinkedIn', 1),
  ('fonte_candidato', 'Banco de talentos', 'banco-de-talentos', 'Banco de talentos', 2),
  ('fonte_candidato', 'Headhunter', 'agencia', 'Agência', 3),
  ('fonte_candidato', 'Gupy', 'gupy', 'Gupy', 4),
  ('fonte_candidato', 'Site de carreiras', 'site-de-carreiras', 'Site de carreiras', 5),
  ('fonte_candidato', 'Feira de talentos', 'feira-de-talentos', 'Feira de talentos', 6),
  -- Linha de crédito (emprestimos.modalidade): os códigos que o motor conhece.
  ('linha_de_credito', 'CCB', 'financiamento-longo-prazo', 'Financiamento de longo prazo', 0),
  ('linha_de_credito', 'Conta garantida', 'capital-de-giro', 'Capital de giro', 1),
  ('linha_de_credito', 'Capital de giro', 'capital-de-giro', 'Capital de giro', 1),
  -- Natureza de saída de caixa, por conta contábil do título pago (H-56).
  ('natureza_de_saida', '4.1.1.001', 'materia-prima', 'Matéria-prima', 0),
  ('natureza_de_saida', '4.1.1.002', 'materia-prima', 'Matéria-prima', 0),
  ('natureza_de_saida', '4.1.3.001', 'outras-saidas', 'Outras saídas', 7),
  ('natureza_de_saida', '4.1.3.002', 'servicos', 'Serviços de terceiros', 3),
  ('natureza_de_saida', '4.1.3.003', 'fretes', 'Fretes e logística', 5),
  ('natureza_de_saida', '4.1.3.004', 'servicos', 'Serviços de terceiros', 3),
  ('natureza_de_saida', '5.1.2.001', 'outras-saidas', 'Outras saídas', 7),
  ('natureza_de_saida', '5.1.2.002', 'outras-saidas', 'Outras saídas', 7),
  ('natureza_de_saida', '5.1.2.003', 'servicos', 'Serviços de terceiros', 3),
  ('natureza_de_saida', '5.1.2.004', 'servicos', 'Serviços de terceiros', 3),
  ('natureza_de_saida', '5.1.2.005', 'servicos', 'Serviços de terceiros', 3),
  ('natureza_de_saida', '5.1.2.006', 'outras-saidas', 'Outras saídas', 7),
  ('natureza_de_saida', '5.1.2.007', 'outras-saidas', 'Outras saídas', 7),
  ('natureza_de_saida', '5.1.2.008', 'outras-saidas', 'Outras saídas', 7),
  ('natureza_de_saida', '5.1.3.001', 'marketing', 'Marketing', 6),
  ('natureza_de_saida', '5.1.3.003', 'fretes', 'Fretes e logística', 5),
  -- Naturezas que não vêm de título: folha, impostos, juros e capex são
  -- reconhecidos pelo histórico ou pela natureza do lançamento de caixa.
  ('natureza_de_saida', 'folha', 'pessoal', 'Pessoal', 1),
  ('natureza_de_saida', 'impostos', 'impostos', 'Impostos', 4),
  ('natureza_de_saida', 'juros', 'juros', 'Juros', 2),
  ('natureza_de_saida', 'capex', 'investimento', 'Investimento', 8),
  ('natureza_de_saida', 'outras', 'outras-saidas', 'Outras saídas', 7)
ON CONFLICT (dominio, valor_origem) DO NOTHING;

-- Fixo × variável, conta a conta (H-08).
--
-- Semente da Engenharia: o que varia com a venda — matéria-prima, embalagem,
-- energia de produção, terceirização, comissão, frete e PDD — é variável; o
-- resto da estrutura é fixo. Conta sem classificação deixa o mês em NULL, e não
-- em zero: ausência de decisão não é custo zero.
CREATE TABLE IF NOT EXISTS amanna.param_natureza_conta (
  conta text PRIMARY KEY,
  natureza text NOT NULL CHECK (natureza IN ('fixo', 'variavel')),
  origem text NOT NULL DEFAULT 'engenharia-2026-09'
);

INSERT INTO amanna.param_natureza_conta (conta, natureza) VALUES
  ('4.1.1.001', 'variavel'), ('4.1.1.002', 'variavel'),
  ('4.1.2.001', 'fixo'), ('4.1.2.002', 'fixo'),
  ('4.1.3.001', 'variavel'), ('4.1.3.002', 'fixo'),
  ('4.1.3.003', 'variavel'), ('4.1.3.004', 'variavel'),
  ('5.1.1.001', 'fixo'), ('5.1.1.002', 'fixo'), ('5.1.1.003', 'fixo'),
  ('5.1.1.004', 'fixo'), ('5.1.1.005', 'variavel'), ('5.1.1.006', 'fixo'),
  ('5.1.1.007', 'fixo'), ('5.1.1.008', 'fixo'),
  ('5.1.2.001', 'fixo'), ('5.1.2.002', 'fixo'), ('5.1.2.003', 'fixo'),
  ('5.1.2.004', 'fixo'), ('5.1.2.005', 'fixo'), ('5.1.2.006', 'fixo'),
  ('5.1.2.007', 'fixo'), ('5.1.2.008', 'fixo'),
  ('5.1.3.001', 'fixo'), ('5.1.3.002', 'variavel'), ('5.1.3.003', 'variavel'),
  ('5.1.3.004', 'variavel')
ON CONFLICT (conta) DO NOTHING;

-- Ramp-up e produtividade perdida (H-52): NULL até a Controladoria decidir.
-- Com os dois em NULL, `vw_fato_turnover_custo` devolve NULL nesses componentes
-- e o KPI de custo do turnover fica "sem dado" — que é a verdade.
CREATE TABLE IF NOT EXISTS amanna.param_turnover (
  componente text PRIMARY KEY,
  meses numeric,
  fracao_produtividade numeric,
  vale_por_area boolean NOT NULL DEFAULT false,
  aprovado_por text,
  aprovado_em date
);

INSERT INTO amanna.param_turnover (componente) VALUES ('ramp-up'), ('produtividade')
ON CONFLICT (componente) DO NOTHING;

-- Como reconstruir o saldo mensal da dívida a partir do único snapshot que a
-- base traz (saldo_devedor_2026_12). `ancora-linear` é derivação com hipótese
-- declarada, não medição; qualquer outro valor devolve NULL fora de 2026-12.
CREATE TABLE IF NOT EXISTS amanna.param_divida (
  chave text PRIMARY KEY,
  valor text NOT NULL,
  origem text NOT NULL DEFAULT 'engenharia-2026-09'
);

INSERT INTO amanna.param_divida (chave, valor) VALUES ('metodo', 'ancora-linear')
ON CONFLICT (chave) DO NOTHING;

-- Estoque: a base não o modela em detalhe. O que ela declara, no dicionário e
-- no gabarito de contas, é uma convenção — PME fixo em 75 dias — e é essa
-- convenção que entra aqui, com a origem escrita. `vw_fato_fin_mes.estoque` é
-- derivado dela (PME × CMV anualizado ÷ 365); apagar a linha devolve NULL e
-- PME, ciclo financeiro e NCG passam a "sem dado". Trocar o número é decisão
-- da Controladoria (H-08).
CREATE TABLE IF NOT EXISTS amanna.param_estoque (
  chave text PRIMARY KEY,
  valor text NOT NULL,
  origem text NOT NULL
);

INSERT INTO amanna.param_estoque (chave, valor, origem)
VALUES ('pme_dias', '75', 'dicionario-da-base-2026-09')
ON CONFLICT (chave) DO NOTHING;
