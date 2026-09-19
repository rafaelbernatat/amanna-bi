-- 013 · Os agregados mensais, abertos à consulta do chat (T-457)
--
-- A migração 012 abriu o **detalhe** — razão, folha, títulos, notas. Faltou o
-- que já está calculado: a DRE fechada por mês, o quadro por mês, o aging, o
-- faturamento por cliente. Sem isso, "qual o faturamento de abril?" obrigava o
-- modelo a somar o razão por linha da DRE e acertar o sinal das deduções — e
-- foi exatamente o que ele tentou fazer, com resultado discutível.
--
-- Com estas views, a mesma pergunta é uma linha de SQL, o número sai do mesmo
-- cálculo que o painel usa, e a soma de dois meses vem do banco — que é o que
-- o princípio P3 exige de todo número: uma fórmula escrita, e aqui a fórmula é
-- o próprio SELECT.
--
-- Todas seguem a regra de 012: nome sem `vw_fato_`, `mes` como competência, e
-- o predicado de escopo em quem tem dono.

-- Ver 012: `CREATE OR REPLACE VIEW` só aceita acrescentar coluna no fim.
DO $$
DECLARE v record;
BEGIN
  FOR v IN
    SELECT table_name FROM information_schema.views
    WHERE table_schema = 'amanna_chat'
      AND table_name IN (
        'fin_mes', 'rh_mes', 'dre_conta_mes', 'contas_mes',
        'faturamento_cliente', 'orcamento_mes', 'vagas_mes',
        'treinamento_mes', 'qualidade_mes', 'natureza_mes', 'divida_mes',
        'caixa_diario', 'balanco_mes'
      )
  LOOP
    EXECUTE format('DROP VIEW IF EXISTS amanna_chat.%I CASCADE', v.table_name);
  END LOOP;
END
$$;

-- A DRE fechada por mês e entidade. É daqui que sai "quanto faturamos em
-- abril", "qual o lucro de dezembro", "abril mais agosto".
CREATE OR REPLACE VIEW amanna_chat.fin_mes AS
SELECT f.mes, f.entidade, f.receita_bruta, f.deducoes, f.receita_liquida,
       f.cmv, (f.receita_liquida - f.cmv) AS lucro_bruto,
       f.despesas_operacionais,
       (f.receita_liquida - f.cmv - f.despesas_operacionais) AS ebitda,
       f.depreciacao_e_amortizacao, f.resultado_financeiro, f.nao_operacional,
       f.fco, f.capex, f.financiamento, f.entradas_de_caixa, f.saidas_de_caixa,
       f.estoque, f.receita_liquida_ano_anterior, f.notas_emitidas,
       f.saldo_de_caixa
FROM amanna.vw_fato_fin_mes f
WHERE amanna_chat.no_escopo(f.entidade, NULL, 'fin');

-- O quadro por mês, entidade, área e modalidade.
CREATE OR REPLACE VIEW amanna_chat.rh_mes AS
SELECT r.mes, r.entidade, r.area, r.modalidade, r.headcount_fte, r.admissoes,
       r.desligamentos, r.folha_reais, r.salarios, r.encargos, r.beneficios,
       r.variavel, r.elegiveis, r.participantes_de_treinamento,
       r.horas_previstas, r.horas_ausentes, r.respondentes, r.promotores,
       r.neutros, r.detratores, r.pontos_de_engajamento
FROM amanna.vw_fato_rh_mes r
WHERE amanna_chat.no_escopo(r.entidade, r.area, 'rh');

-- O grão conta × centro de custo × mês: "a maior despesa de junho" numa linha.
CREATE OR REPLACE VIEW amanna_chat.dre_conta_mes AS
SELECT d.mes, d.entidade, d.area, d.centro_de_custo, d.conta,
       d.conta_descricao, d.linha_dre, d.valor
FROM amanna.vw_fato_dre_conta_mes d
WHERE amanna_chat.no_escopo(d.entidade, d.area, 'fin');

CREATE OR REPLACE VIEW amanna_chat.contas_mes AS
SELECT c.mes, c.entidade, c.faixa_de_aging, c.contraparte, c.a_receber,
       c.a_pagar
FROM amanna.vw_fato_contas c
WHERE amanna_chat.no_escopo(c.entidade, NULL, 'fin');

CREATE OR REPLACE VIEW amanna_chat.faturamento_cliente AS
SELECT f.mes, f.entidade, f.cliente, f.rating, f.segmento, f.principal,
       f.receita, f.margem_base
FROM amanna.vw_fato_faturamento_cliente f
WHERE amanna_chat.no_escopo(f.entidade, NULL, 'fin');

CREATE OR REPLACE VIEW amanna_chat.orcamento_mes AS
SELECT o.mes, o.entidade, o.centro_de_custo, o.orcado, o.realizado,
       (o.realizado - o.orcado) AS desvio
FROM amanna.vw_fato_orcamento o
WHERE amanna_chat.no_escopo(o.entidade, NULL, 'fin');

CREATE OR REPLACE VIEW amanna_chat.vagas_mes AS
SELECT v.mes, v.area, v.abertas, v.em_andamento, v.fechadas, v.canceladas,
       v.custo_de_recrutamento, v.dias_somados, v.candidaturas, v.triagem,
       v.entrevistas, v.propostas, v.contratados
FROM amanna.vw_fato_vagas v
WHERE amanna_chat.no_escopo(NULL, v.area, 'rh');

CREATE OR REPLACE VIEW amanna_chat.treinamento_mes AS
SELECT t.mes, t.area, t.trilha, t.modalidade_de_trilha, t.horas,
       t.investimento_reais, t.trilhas_iniciadas, t.trilhas_concluidas,
       t.participantes
FROM amanna.vw_fato_treinamento t
WHERE amanna_chat.no_escopo(NULL, t.area, 'rh');

CREATE OR REPLACE VIEW amanna_chat.qualidade_mes AS
SELECT q.* FROM amanna.vw_fato_qualidade_mes q
WHERE amanna_chat.no_escopo(q.entidade, NULL, 'fin');

CREATE OR REPLACE VIEW amanna_chat.natureza_mes AS
SELECT n.mes, n.entidade, n.custos_variaveis, n.custos_fixos
FROM amanna.vw_fato_natureza_mes n
WHERE amanna_chat.no_escopo(n.entidade, NULL, 'fin');

CREATE OR REPLACE VIEW amanna_chat.divida_mes AS
SELECT d.mes, d.entidade, d.linha, d.prazo, d.saldo, d.juros_pagos
FROM amanna.vw_fato_divida_mes d
WHERE amanna_chat.no_escopo(d.entidade, NULL, 'fin');

CREATE OR REPLACE VIEW amanna_chat.caixa_diario AS
SELECT c.dia, c.mes, c.entidade, c.entradas, c.saidas
FROM amanna.vw_fato_caixa_diario c
WHERE amanna_chat.no_escopo(c.entidade, NULL, 'fin');

/*
 * O balanço entra **com o aviso**.
 *
 * Nove colunas são `NULL::numeric` literal em `007_views_cfo.sql`: o razão da
 * base não tem saldo de abertura, e só doze contas patrimoniais se movimentam
 * (D-DADOS). Expor a view é melhor que escondê-la: o modelo consulta, vê nulo,
 * e diz que não há — em vez de inventar um ROE. O dicionário abaixo diz isso
 * por escrito, e é o que o modelo lê antes de consultar.
 */
CREATE OR REPLACE VIEW amanna_chat.balanco_mes AS
SELECT b.* FROM amanna.vw_fato_balanco_mes b
WHERE amanna_chat.no_escopo(b.entidade, NULL, 'fin');

-- ------------------------------------------------------------------
-- O dicionário das views novas
-- ------------------------------------------------------------------

INSERT INTO amanna_chat.dicionario (objeto, coluna, ordem, unidade, descricao) VALUES
  ('fin_mes', 'mes', 1, NULL, 'Competência, AAAA-MM'),
  ('fin_mes', 'receita_bruta', 2, 'reais', 'Receita bruta'),
  ('fin_mes', 'receita_liquida', 3, 'reais', 'Receita líquida — é o "faturamento"'),
  ('fin_mes', 'cmv', 4, 'reais', 'Custo da mercadoria vendida'),
  ('fin_mes', 'lucro_bruto', 5, 'reais', 'Receita líquida menos CMV'),
  ('fin_mes', 'despesas_operacionais', 6, 'reais', 'Despesas operacionais'),
  ('fin_mes', 'ebitda', 7, 'reais', 'EBITDA'),
  ('fin_mes', 'resultado_financeiro', 8, 'reais', 'Resultado financeiro'),
  ('fin_mes', 'saldo_de_caixa', 9, 'reais', 'Saldo de caixa no fim do mês'),
  ('fin_mes', 'fco', 10, 'reais', 'Geração operacional de caixa'),
  ('rh_mes', 'mes', 1, NULL, 'Competência, AAAA-MM'),
  ('rh_mes', 'area', 2, NULL, 'Área, em código'),
  ('rh_mes', 'headcount_fte', 3, 'FTE', 'Quadro em equivalente de tempo integral'),
  ('rh_mes', 'admissoes', 4, 'contagem', 'Admissões no mês'),
  ('rh_mes', 'desligamentos', 5, 'contagem', 'Desligamentos no mês'),
  ('rh_mes', 'folha_reais', 6, 'reais', 'Folha total'),
  ('rh_mes', 'respondentes', 7, 'contagem', 'Respostas da pesquisa — zero fora das 4 ondas'),
  ('rh_mes', 'promotores', 8, 'contagem', 'Promotores do eNPS'),
  ('rh_mes', 'detratores', 9, 'contagem', 'Detratores do eNPS'),
  ('dre_conta_mes', 'mes', 1, NULL, 'Competência, AAAA-MM'),
  ('dre_conta_mes', 'conta_descricao', 2, NULL, 'Nome da conta'),
  ('dre_conta_mes', 'linha_dre', 3, NULL, 'Linha da DRE a que a conta pertence'),
  ('dre_conta_mes', 'centro_de_custo', 4, NULL, 'Centro de custo'),
  ('dre_conta_mes', 'valor', 5, 'reais', 'Valor no mês'),
  ('contas_mes', 'faixa_de_aging', 1, NULL, 'Em dia, 1-30, 31-60, 61-90, 90+'),
  ('contas_mes', 'contraparte', 2, NULL, 'Cliente ou fornecedor'),
  ('contas_mes', 'a_receber', 3, 'reais', 'Saldo a receber'),
  ('contas_mes', 'a_pagar', 4, 'reais', 'Saldo a pagar'),
  ('faturamento_cliente', 'cliente', 1, NULL, 'Cliente'),
  ('faturamento_cliente', 'segmento', 2, NULL, 'Segmento do cliente'),
  ('faturamento_cliente', 'receita', 3, 'reais', 'Receita do cliente no mês'),
  ('orcamento_mes', 'centro_de_custo', 1, NULL, 'Centro de custo'),
  ('orcamento_mes', 'orcado', 2, 'reais', 'Valor orçado'),
  ('orcamento_mes', 'realizado', 3, 'reais', 'Valor realizado'),
  ('orcamento_mes', 'desvio', 4, 'reais', 'Realizado menos orçado'),
  ('vagas_mes', 'area', 1, NULL, 'Área'),
  ('vagas_mes', 'fechadas', 2, 'contagem', 'Vagas fechadas no mês'),
  ('vagas_mes', 'dias_somados', 3, 'dias', 'Soma dos dias para fechar, para a média'),
  ('vagas_mes', 'custo_de_recrutamento', 4, 'reais', 'Custo de recrutamento'),
  ('treinamento_mes', 'trilha', 1, NULL, 'Trilha de treinamento'),
  ('treinamento_mes', 'horas', 2, 'horas', 'Horas de treinamento'),
  ('treinamento_mes', 'investimento_reais', 3, 'reais', 'Investimento'),
  ('qualidade_mes', 'lancamentos_fora_do_padrao', 1, 'contagem', 'Lançamentos acima de 3 desvios'),
  ('qualidade_mes', 'valor_fora_do_padrao', 2, 'reais', 'Valor desses lançamentos'),
  ('natureza_mes', 'custos_fixos', 1, 'reais', 'Custos fixos'),
  ('natureza_mes', 'custos_variaveis', 2, 'reais', 'Custos variáveis'),
  ('divida_mes', 'linha', 1, NULL, 'Linha da dívida'),
  ('divida_mes', 'saldo', 2, 'reais', 'Saldo devedor'),
  ('divida_mes', 'juros_pagos', 3, 'reais', 'Juros pagos no mês'),
  ('caixa_diario', 'dia', 1, NULL, 'Data'),
  ('caixa_diario', 'entradas', 2, 'reais', 'Entradas de caixa'),
  ('caixa_diario', 'saidas', 3, 'reais', 'Saídas de caixa'),
  ('balanco_mes', 'patrimonio_liquido', 1, 'reais', 'SEM DADO nesta base: o razão não tem saldo de abertura. ROE, ROA, ROIC e liquidez não têm resposta'),
  ('balanco_mes', 'divida_curto_prazo', 2, 'reais', 'Dívida de curto prazo — esta tem dado'),
  ('balanco_mes', 'divida_longo_prazo', 3, 'reais', 'Dívida de longo prazo — esta tem dado'),
  ('balanco_mes', 'juros_pagos', 4, 'reais', 'Juros pagos — este tem dado')
ON CONFLICT (objeto, coluna) DO NOTHING;

GRANT SELECT ON ALL TABLES IN SCHEMA amanna_chat TO amanna_chat_ro;
