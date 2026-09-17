-- As views financeiras, na forma exata dos tipos `Linha*`.
--
-- A DRE sai do razão, e não de `vw_fato_fin_mes.csv`: o razão fecha em zero e
-- é a origem de tudo (dicionário, seção Conferência). Os sinais seguem o
-- motor: `resultado_financeiro` e `nao_operacional` são **positivos quando
-- despesa**, porque entram na ponte como dedução.

-- vw_fato_fin_mes ------------------------------------------------------------

CREATE OR REPLACE VIEW amanna.vw_fato_fin_mes AS
WITH dre AS (
  SELECT r.competencia, e.entidade,
         COALESCE(SUM(credito - debito) FILTER (WHERE r.linha_dre = 'Receita bruta'), 0) AS receita_bruta,
         COALESCE(SUM(debito - credito) FILTER (WHERE r.linha_dre = 'Deduções'), 0) AS deducoes,
         COALESCE(SUM(debito - credito) FILTER (WHERE r.linha_dre = 'CMV'), 0) AS cmv,
         COALESCE(SUM(debito - credito) FILTER (WHERE r.linha_dre = 'Despesas operacionais'), 0) AS despesas_operacionais,
         COALESCE(SUM(debito - credito) FILTER (WHERE r.linha_dre = 'Depreciação e amortização'), 0) AS depreciacao_e_amortizacao,
         COALESCE(SUM(debito - credito) FILTER (WHERE r.linha_dre = 'Resultado financeiro'), 0) AS resultado_financeiro,
         COALESCE(SUM(debito - credito) FILTER (WHERE r.linha_dre = 'IRPJ e CSLL'), 0) AS nao_operacional
  FROM amanna.razao_contabil r
  JOIN amanna.v_entidade e USING (id_entidade)
  GROUP BY 1, 2
),
caixa AS (
  SELECT mc.competencia, e.entidade,
         SUM(entrada) AS entradas_de_caixa,
         SUM(saida) AS saidas_de_caixa,
         COALESCE(SUM(entrada - saida) FILTER (WHERE classe_fluxo = 'Operacional'), 0) AS fco,
         COALESCE(SUM(saida - entrada) FILTER (WHERE classe_fluxo = 'Investimento'), 0) AS capex,
         COALESCE(SUM(saida - entrada) FILTER (WHERE classe_fluxo = 'Financiamento'), 0) AS financiamento
  FROM amanna.movimento_caixa mc
  JOIN amanna.v_entidade e USING (id_entidade)
  GROUP BY 1, 2
),
-- Uma conta bancária por entidade (verificado na base): o último `saldo_apos`
-- do mês é o saldo. O grupo soma as entidades dele.
saldo AS (
  SELECT competencia, entidade, SUM(saldo_apos) AS saldo_de_caixa
  FROM (
    SELECT DISTINCT ON (mc.competencia, mc.id_entidade)
           mc.competencia, e.entidade, mc.saldo_apos
    FROM amanna.movimento_caixa mc
    JOIN amanna.v_entidade e USING (id_entidade)
    ORDER BY mc.competencia, mc.id_entidade, mc.data DESC, mc.id DESC
  ) ultimo
  GROUP BY 1, 2
),
notas AS (
  SELECT n.competencia, e.entidade, COUNT(*) AS notas_emitidas
  FROM amanna.notas_fiscais_saida n
  JOIN amanna.v_entidade e USING (id_entidade)
  WHERE n.status = 'Autorizada'
  GROUP BY 1, 2
),
-- O estoque no fechamento, pela convenção declarada em param_estoque:
-- PME × (CMV dos últimos doze meses, anualizado) ÷ 365. Sem a linha de
-- parâmetro, NULL — e o motor propaga a ausência até PME, ciclo e NCG.
pme AS (
  SELECT valor::numeric AS dias FROM amanna.param_estoque WHERE chave = 'pme_dias'
),
estoque AS (
  SELECT d.competencia, d.entidade,
         (SELECT dias FROM pme) / 365.0
           * SUM(a.cmv) * 12.0 / COUNT(*) AS estoque
  FROM dre d
  JOIN dre a ON a.entidade = d.entidade
            AND a.competencia <= d.competencia
            AND a.competencia > to_char(to_date(d.competencia, 'YYYY-MM') - INTERVAL '12 months', 'YYYY-MM')
  GROUP BY 1, 2
)
SELECT d.competencia AS mes,
       d.entidade,
       d.receita_bruta,
       d.deducoes,
       d.receita_bruta - d.deducoes AS receita_liquida,
       d.cmv,
       d.despesas_operacionais,
       d.depreciacao_e_amortizacao,
       d.resultado_financeiro,
       d.nao_operacional,
       COALESCE(c.fco, 0) AS fco,
       COALESCE(c.capex, 0) AS capex,
       COALESCE(c.financiamento, 0) AS financiamento,
       COALESCE(c.entradas_de_caixa, 0) AS entradas_de_caixa,
       COALESCE(c.saidas_de_caixa, 0) AS saidas_de_caixa,
       es.estoque,
       ant.receita_liquida AS receita_liquida_ano_anterior,
       COALESCE(n.notas_emitidas, 0) AS notas_emitidas,
       COALESCE(s.saldo_de_caixa, 0) AS saldo_de_caixa
FROM dre d
LEFT JOIN caixa c USING (competencia, entidade)
LEFT JOIN saldo s USING (competencia, entidade)
LEFT JOIN notas n USING (competencia, entidade)
LEFT JOIN estoque es USING (competencia, entidade)
LEFT JOIN LATERAL (
  -- O mesmo mês do ano anterior. Nulo em 2025: não há 2024 carregado.
  SELECT a.receita_bruta - a.deducoes AS receita_liquida
  FROM dre a
  WHERE a.entidade = d.entidade
    AND a.competencia = (LEFT(d.competencia, 4)::int - 1)::text || RIGHT(d.competencia, 3)
) ant ON true;

-- vw_fato_caixa_diario -------------------------------------------------------

CREATE OR REPLACE VIEW amanna.vw_fato_caixa_diario AS
SELECT mc.data AS dia, mc.competencia AS mes, e.entidade,
       SUM(entrada) AS entradas, SUM(saida) AS saidas
FROM amanna.movimento_caixa mc
JOIN amanna.v_entidade e USING (id_entidade)
GROUP BY 1, 2, 3;

-- vw_fato_orcamento ----------------------------------------------------------

CREATE OR REPLACE VIEW amanna.vw_fato_orcamento AS
SELECT o.competencia AS mes, e.entidade, o.id_centro_custo AS centro_de_custo,
       SUM(o.valor_orcado) AS orcado, SUM(o.valor_realizado) AS realizado
FROM amanna.orcamento o
JOIN amanna.v_entidade e USING (id_entidade)
GROUP BY 1, 2, 3;

-- vw_fato_contas -------------------------------------------------------------
--
-- O aging é recalculado no fechamento de **cada** mês: um título em aberto no
-- fim de março está numa faixa em março e noutra em abril. A coluna
-- `faixa_aging` da base é o estado final do título, e não serve para o mês.

CREATE OR REPLACE VIEW amanna.vw_fato_contas AS
WITH receber AS (
  SELECT m.competencia, e.entidade, t.id_cliente AS contraparte,
         CASE WHEN t.data_vencimento >= m.fim_do_mes THEN 'a-vencer'
              WHEN m.fim_do_mes - t.data_vencimento <= 30 THEN '1-30d'
              WHEN m.fim_do_mes - t.data_vencimento <= 60 THEN '31-60d'
              WHEN m.fim_do_mes - t.data_vencimento <= 90 THEN '61-90d'
              ELSE 'mais-90d' END AS faixa_de_aging,
         SUM(t.valor_titulo) AS a_receber
  FROM amanna.contas_receber t
  JOIN amanna.v_meses m ON t.data_emissao <= m.fim_do_mes
                       AND (t.data_recebimento IS NULL OR t.data_recebimento > m.fim_do_mes)
  JOIN amanna.v_entidade e ON e.id_entidade = t.id_entidade
  GROUP BY 1, 2, 3, 4
),
pagar AS (
  SELECT m.competencia, e.entidade, t.id_fornecedor AS contraparte,
         CASE WHEN t.data_vencimento >= m.fim_do_mes THEN 'a-vencer'
              WHEN m.fim_do_mes - t.data_vencimento <= 30 THEN '1-30d'
              WHEN m.fim_do_mes - t.data_vencimento <= 60 THEN '31-60d'
              WHEN m.fim_do_mes - t.data_vencimento <= 90 THEN '61-90d'
              ELSE 'mais-90d' END AS faixa_de_aging,
         SUM(t.valor_titulo) AS a_pagar
  FROM amanna.contas_pagar t
  JOIN amanna.v_meses m ON t.data_emissao <= m.fim_do_mes
                       AND (t.data_pagamento IS NULL OR t.data_pagamento > m.fim_do_mes)
  JOIN amanna.v_entidade e ON e.id_entidade = t.id_entidade
  GROUP BY 1, 2, 3, 4
)
SELECT competencia AS mes, entidade, faixa_de_aging, contraparte,
       a_receber, 0::numeric AS a_pagar
FROM receber
UNION ALL
SELECT competencia, entidade, faixa_de_aging, contraparte,
       0::numeric, a_pagar
FROM pagar;

-- vw_fato_saida_categoria ----------------------------------------------------
--
-- Toda saída de caixa cai numa natureza, e a soma das naturezas é a saída do
-- mês (H-56). Título pago classifica pela conta contábil dele (map_codigo);
-- folha, impostos, juros e investimento são reconhecidos pelo lançamento.

CREATE OR REPLACE VIEW amanna.vw_fato_saida_categoria AS
WITH s AS (
  SELECT mc.competencia, e.entidade, mc.saida,
         CASE
           WHEN mc.classe_fluxo = 'Investimento' THEN amanna.codigo('natureza_de_saida', 'capex')
           WHEN mc.classe_fluxo = 'Financiamento' AND mc.historico ILIKE '%juros%' THEN amanna.codigo('natureza_de_saida', 'juros')
           WHEN mc.classe_fluxo = 'Financiamento' THEN amanna.codigo('natureza_de_saida', 'outras')
           WHEN mc.historico ILIKE '%folha%' OR mc.documento LIKE 'PG%' THEN amanna.codigo('natureza_de_saida', 'folha')
           WHEN cp.conta LIKE '2.1.3.%' OR cp.conta LIKE '7.%' THEN amanna.codigo('natureza_de_saida', 'impostos')
           ELSE COALESCE(amanna.codigo('natureza_de_saida', cp.conta), amanna.codigo('natureza_de_saida', 'outras'))
         END AS categoria
  FROM amanna.movimento_caixa mc
  JOIN amanna.v_entidade e USING (id_entidade)
  LEFT JOIN amanna.contas_pagar cp ON cp.id_titulo = mc.documento
  WHERE mc.saida > 0
)
SELECT competencia AS mes, entidade, categoria, SUM(saida) AS valor
FROM s
GROUP BY 1, 2, 3;

-- vw_fato_faturamento_cliente ------------------------------------------------
--
-- A carteira inteira, com os dez maiores marcados. `receita` é o valor líquido
-- das notas autorizadas (fecha com a receita líquida do razão); a margem de
-- contribuição vem dos itens.

CREATE OR REPLACE VIEW amanna.vw_fato_faturamento_cliente AS
WITH nf AS (
  SELECT n.competencia, e.entidade, n.id_cliente, n.id_nf, n.valor_liquido
  FROM amanna.notas_fiscais_saida n
  JOIN amanna.v_entidade e USING (id_entidade)
  WHERE n.status = 'Autorizada'
),
margem AS (
  SELECT id_nf, SUM(margem_contribuicao) AS margem
  FROM amanna.itens_nota_saida
  GROUP BY 1
),
principais AS (
  SELECT id_cliente FROM nf GROUP BY 1 ORDER BY SUM(valor_liquido) DESC LIMIT 10
)
SELECT nf.competencia AS mes, nf.entidade, nf.id_cliente AS cliente,
       amanna.codigo('rating', c.rating_credito) AS rating,
       amanna.codigo('segmento', c.segmento) AS segmento,
       (nf.id_cliente IN (SELECT id_cliente FROM principais)) AS principal,
       SUM(nf.valor_liquido) AS receita,
       COALESCE(SUM(m.margem), 0) AS margem_base
FROM nf
JOIN amanna.dim_cliente c USING (id_cliente)
LEFT JOIN margem m USING (id_nf)
GROUP BY 1, 2, 3, 4, 5, 6;

-- vw_fato_dre_conta_mes ------------------------------------------------------
--
-- O razão no grão área × mês, por conta e centro de custo, para o ranking do
-- chat. `valor` tem o sinal do efeito sobre o resultado: receita positiva,
-- custo e despesa negativos. Nenhuma linha desce a pessoa.

CREATE OR REPLACE VIEW amanna.vw_fato_dre_conta_mes AS
SELECT r.competencia AS mes, e.entidade,
       COALESCE(c.area, '') AS area,
       COALESCE(r.id_centro_custo, '') AS centro_de_custo,
       r.conta,
       dc.conta_descricao,
       dc.linha_dre,
       SUM(r.credito - r.debito) AS valor
FROM amanna.razao_contabil r
JOIN amanna.v_entidade e USING (id_entidade)
JOIN amanna.dim_conta_contabil dc USING (conta)
LEFT JOIN amanna.v_centro c USING (id_centro_custo)
WHERE dc.demonstrativo = 'DRE'
GROUP BY 1, 2, 3, 4, 5, 6, 7;
