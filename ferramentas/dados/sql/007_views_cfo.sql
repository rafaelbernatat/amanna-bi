-- As views das perguntas de CFO: balanço, dívida, natureza das contas e
-- qualidade do razão. É aqui que a base Amanna mais fica devendo — e as views
-- dizem isso com NULL, nunca com zero (D-DADOS, seção "o que não é derivável").

-- vw_fato_divida_mes ---------------------------------------------------------
--
-- A base traz um único snapshot por contrato (saldo em 2026-12). O saldo dos
-- outros meses é **modelado** pelo método declarado em param_divida:
-- `ancora-linear` parte do snapshot e soma uma parcela linear por mês até
-- dezembro de 2026, limitada ao principal. Antes da contratação o saldo é
-- zero de verdade. Os juros do mês vêm do razão (6.1.1.001) e são repartidos
-- pelas linhas na proporção do saldo, por entidade — a soma das linhas é o
-- razão, por construção.

CREATE OR REPLACE VIEW amanna.vw_fato_divida_mes AS
WITH metodo AS (
  SELECT valor FROM amanna.param_divida WHERE chave = 'metodo'
),
contratos AS (
  SELECT em.id_contrato, em.id_entidade, e.entidade,
         amanna.codigo('linha_de_credito', em.modalidade) AS linha,
         em.principal, em.parcelas, em.data_contratacao, em.data_vencimento,
         em.saldo_devedor_2026_12
  FROM amanna.emprestimos em
  JOIN amanna.v_entidade e USING (id_entidade)
),
saldo AS (
  SELECT c.id_contrato, c.id_entidade, c.entidade, c.linha, m.competencia,
         CASE
           WHEN c.data_contratacao > m.fim_do_mes THEN 0
           WHEN m.competencia = '2026-12' THEN c.saldo_devedor_2026_12
           WHEN (SELECT valor FROM metodo) = 'ancora-linear' THEN
             LEAST(c.principal,
                   c.saldo_devedor_2026_12 + (c.principal / c.parcelas)
                     * ((2026 - EXTRACT(YEAR FROM m.fim_do_mes)) * 12 + 12 - EXTRACT(MONTH FROM m.fim_do_mes)))
           ELSE NULL
         END AS saldo,
         CASE WHEN c.data_vencimento <= m.fim_do_mes + INTERVAL '12 months' THEN 'curto' ELSE 'longo' END AS prazo
  FROM contratos c
  CROSS JOIN amanna.v_meses m
),
juros AS (
  SELECT r.competencia, r.id_entidade, SUM(r.debito - r.credito) AS juros
  FROM amanna.razao_contabil r
  WHERE r.conta = '6.1.1.001'
  GROUP BY 1, 2
),
por_contrato AS (
  SELECT s.competencia, s.entidade, s.linha, s.prazo, s.saldo,
         CASE WHEN SUM(s.saldo) OVER (PARTITION BY s.competencia, s.id_entidade) > 0
              THEN s.saldo / SUM(s.saldo) OVER (PARTITION BY s.competencia, s.id_entidade) * COALESCE(j.juros, 0)
              ELSE 0 END AS juros_pagos
  FROM saldo s
  LEFT JOIN juros j ON j.competencia = s.competencia AND j.id_entidade = s.id_entidade
)
SELECT competencia AS mes, entidade, linha, prazo,
       CASE WHEN bool_or(saldo IS NULL) THEN NULL ELSE SUM(saldo) END AS saldo,
       SUM(juros_pagos) AS juros_pagos
FROM por_contrato
GROUP BY 1, 2, 3, 4;

-- vw_fato_balanco_mes --------------------------------------------------------
--
-- Só o que a base sustenta. O razão não tem saldo de abertura e só doze contas
-- patrimoniais se movimentam: patrimônio líquido, ativo, passivo, imobilizado e
-- aplicações não têm como fechar e ficam NULL. Vencidos vêm dos títulos, dívida
-- vem de vw_fato_divida_mes, juros e impostos sobre o lucro vêm do razão.
-- O caixa de financiamento traz só juros, tarifas e rendimento: não há
-- amortização nem captação na base — a primeira fica NULL, a segunda é zero.

CREATE OR REPLACE VIEW amanna.vw_fato_balanco_mes AS
WITH chaves AS (
  SELECT m.competencia, ent.entidade
  FROM amanna.v_meses m
  CROSS JOIN (SELECT DISTINCT entidade FROM amanna.v_entidade) ent
),
vencido AS (
  SELECT mes AS competencia, entidade,
         COALESCE(SUM(a_receber) FILTER (WHERE faixa_de_aging <> 'a-vencer'), 0) AS a_receber_vencido,
         COALESCE(SUM(a_pagar) FILTER (WHERE faixa_de_aging <> 'a-vencer'), 0) AS a_pagar_vencido
  FROM amanna.vw_fato_contas
  GROUP BY 1, 2
),
divida AS (
  SELECT mes AS competencia, entidade,
         COALESCE(SUM(saldo) FILTER (WHERE prazo = 'curto'), 0) AS curto,
         COALESCE(SUM(saldo) FILTER (WHERE prazo = 'longo'), 0) AS longo,
         bool_or(saldo IS NULL) AS sem_saldo
  FROM amanna.vw_fato_divida_mes
  GROUP BY 1, 2
),
razao AS (
  SELECT r.competencia, e.entidade,
         COALESCE(SUM(debito - credito) FILTER (WHERE conta = '6.1.1.001'), 0) AS juros_pagos,
         COALESCE(SUM(debito - credito) FILTER (WHERE conta LIKE '7.%'), 0) AS impostos_sobre_lucro
  FROM amanna.razao_contabil r
  JOIN amanna.v_entidade e USING (id_entidade)
  GROUP BY 1, 2
)
SELECT k.competencia AS mes, k.entidade,
       NULL::numeric AS patrimonio_liquido,
       NULL::numeric AS ativo_total,
       NULL::numeric AS ativo_circulante,
       NULL::numeric AS passivo_circulante,
       NULL::numeric AS imobilizado,
       NULL::numeric AS aplicacoes_financeiras,
       CASE WHEN d.sem_saldo THEN NULL ELSE COALESCE(d.curto, 0) END AS divida_curto_prazo,
       CASE WHEN d.sem_saldo THEN NULL ELSE COALESCE(d.longo, 0) END AS divida_longo_prazo,
       NULL::numeric AS estoque_sem_giro,
       COALESCE(v.a_receber_vencido, 0) AS a_receber_vencido,
       COALESCE(v.a_pagar_vencido, 0) AS a_pagar_vencido,
       NULL::numeric AS mutuo_com_socios,
       COALESCE(r.juros_pagos, 0) AS juros_pagos,
       COALESCE(r.impostos_sobre_lucro, 0) AS impostos_sobre_lucro,
       NULL::numeric AS amortizacao_de_divida,
       0::numeric AS captacao,
       0::numeric AS distribuicao_a_socios
FROM chaves k
LEFT JOIN vencido v USING (competencia, entidade)
LEFT JOIN divida d USING (competencia, entidade)
LEFT JOIN razao r USING (competencia, entidade);

-- vw_fato_natureza_mes -------------------------------------------------------
--
-- Fixo × variável pela classificação conta a conta de param_natureza_conta.
-- Conta de custo ou despesa sem classificação deixa o mês em NULL: ausência de
-- decisão não é custo zero.

CREATE OR REPLACE VIEW amanna.vw_fato_natureza_mes AS
WITH l AS (
  SELECT r.competencia, e.entidade, r.debito - r.credito AS valor, p.natureza
  FROM amanna.razao_contabil r
  JOIN amanna.v_entidade e USING (id_entidade)
  JOIN amanna.dim_conta_contabil dc USING (conta)
  LEFT JOIN amanna.param_natureza_conta p USING (conta)
  WHERE dc.linha_dre IN ('CMV', 'Despesas operacionais')
)
SELECT competencia AS mes, entidade,
       CASE WHEN bool_or(natureza IS NULL) THEN NULL
            ELSE COALESCE(SUM(valor) FILTER (WHERE natureza = 'variavel'), 0) END AS custos_variaveis,
       CASE WHEN bool_or(natureza IS NULL) THEN NULL
            ELSE COALESCE(SUM(valor) FILTER (WHERE natureza = 'fixo'), 0) END AS custos_fixos
FROM l
GROUP BY 1, 2;

-- vw_fato_qualidade_mes ------------------------------------------------------
--
-- Testes de exceção sobre o razão, cada um com a regra escrita aqui:
--   fora do padrão      valor acima de média + 3 desvios da conta no mês
--   conta parada        lançamento numa conta sem movimento nos 6 meses anteriores
--   recorrente sem      conta com movimento em cada um dos 6 meses anteriores e nenhum no mês
--   estorno             par no mesmo lote e conta com débito e crédito espelhados
--   competência anterior data do lançamento posterior à competência
--   duplicado           mesma conta, documento, data e valor mais de uma vez
--   inconsistente       linha da DRE do lançamento diferente da do plano de contas
-- Os dois testes de "6 meses" só valem quando há 6 meses carregados antes.
-- Conta genérica exige uma lista que ninguém declarou: fica NULL.

CREATE OR REPLACE VIEW amanna.vw_fato_qualidade_mes AS
WITH l AS (
  SELECT r.id_lancamento, r.lote, r.competencia, r.id_entidade, e.entidade, r.conta,
         r.debito, r.credito, GREATEST(r.debito, r.credito) AS valor,
         r.documento_numero, r.data, r.id_centro_custo, r.parceiro_tipo,
         to_char(r.data, 'YYYY-MM') AS mes_da_data,
         r.linha_dre AS linha_do_lancamento,
         dc.linha_dre AS linha_do_plano,
         dc.demonstrativo
  FROM amanna.razao_contabil r
  JOIN amanna.v_entidade e USING (id_entidade)
  LEFT JOIN amanna.dim_conta_contabil dc USING (conta)
),
padrao AS (
  SELECT competencia, id_entidade, conta, AVG(valor) AS media, STDDEV_SAMP(valor) AS desvio
  FROM l GROUP BY 1, 2, 3
),
meses_conta AS (
  SELECT DISTINCT competencia, id_entidade, conta FROM l
),
historico AS (
  SELECT m.competencia, ent.id_entidade, c.conta,
         EXISTS (SELECT 1 FROM meses_conta x
                 WHERE x.competencia = m.competencia AND x.id_entidade = ent.id_entidade AND x.conta = c.conta) AS neste_mes,
         (SELECT COUNT(*) FROM meses_conta x JOIN amanna.v_meses mx ON mx.competencia = x.competencia
          WHERE x.id_entidade = ent.id_entidade AND x.conta = c.conta
            AND mx.fim_do_mes < m.inicio_do_mes
            AND mx.fim_do_mes >= m.inicio_do_mes - INTERVAL '6 months') AS meses_com_movimento,
         (SELECT COUNT(*) FROM amanna.v_meses mx
          WHERE mx.fim_do_mes < m.inicio_do_mes
            AND mx.fim_do_mes >= m.inicio_do_mes - INTERVAL '6 months') AS meses_carregados
  FROM amanna.v_meses m
  CROSS JOIN (SELECT DISTINCT id_entidade FROM l) ent
  CROSS JOIN (SELECT DISTINCT conta FROM l) c
),
marcados AS (
  SELECT l.*,
         (p.desvio IS NOT NULL AND p.desvio > 0 AND l.valor > p.media + 3 * p.desvio) AS fora_do_padrao,
         (h.meses_carregados = 6 AND h.meses_com_movimento = 0) AS em_conta_parada,
         (l.mes_da_data > l.competencia) AS de_competencia_anterior,
         (l.linha_do_lancamento IS DISTINCT FROM l.linha_do_plano) AS inconsistente,
         (l.id_centro_custo IS NULL OR l.id_centro_custo = '') AS sem_centro,
         (l.demonstrativo = 'DRE' AND l.linha_do_plano IS NULL) AS sem_natureza,
         (l.parceiro_tipo IN ('Sócio', 'Parte relacionada')) AS partes_relacionadas
  FROM l
  LEFT JOIN padrao p ON p.competencia = l.competencia AND p.id_entidade = l.id_entidade AND p.conta = l.conta
  LEFT JOIN historico h ON h.competencia = l.competencia AND h.id_entidade = l.id_entidade AND h.conta = l.conta
),
estornos AS (
  SELECT a.competencia, a.entidade, COUNT(*) AS pares, SUM(a.valor) AS valor
  FROM l a
  JOIN l b ON a.lote = b.lote AND a.conta = b.conta
          AND a.debito = b.credito AND a.credito = b.debito
          AND a.id_lancamento < b.id_lancamento
  WHERE a.valor > 0
  GROUP BY 1, 2
),
duplicados AS (
  SELECT competencia, entidade, SUM(n - 1) AS repetidos, SUM(valor * (n - 1)) AS valor
  FROM (
    SELECT competencia, entidade, conta, documento_numero, data, valor, COUNT(*) AS n
    FROM l GROUP BY 1, 2, 3, 4, 5, 6 HAVING COUNT(*) > 1
  ) d
  GROUP BY 1, 2
),
recorrentes AS (
  SELECT h.competencia, e.entidade,
         COUNT(*) FILTER (WHERE NOT h.neste_mes AND h.meses_carregados = 6 AND h.meses_com_movimento = 6) AS contas_recorrentes_sem_lancamento
  FROM historico h
  JOIN amanna.v_entidade e USING (id_entidade)
  GROUP BY 1, 2
),
por_mes AS (
  SELECT competencia, entidade,
         COUNT(*) AS lancamentos,
         COUNT(*) FILTER (WHERE fora_do_padrao) AS lancamentos_fora_do_padrao,
         COUNT(*) FILTER (WHERE em_conta_parada) AS lancamentos_em_conta_parada,
         COUNT(*) FILTER (WHERE de_competencia_anterior) AS lancamentos_de_competencia_anterior,
         COUNT(DISTINCT conta) FILTER (WHERE inconsistente) AS contas_com_classificacao_inconsistente,
         SUM(valor) AS valor_total,
         COALESCE(SUM(valor) FILTER (WHERE fora_do_padrao), 0) AS valor_fora_do_padrao,
         COALESCE(SUM(valor) FILTER (WHERE de_competencia_anterior), 0) AS valor_de_competencia_anterior,
         COALESCE(SUM(valor) FILTER (WHERE sem_centro), 0) AS valor_sem_centro_de_custo,
         COALESCE(SUM(valor) FILTER (WHERE sem_natureza), 0) AS valor_sem_natureza,
         COALESCE(SUM(valor) FILTER (WHERE inconsistente), 0) AS valor_em_classificacao_inconsistente,
         COALESCE(SUM(valor) FILTER (WHERE partes_relacionadas), 0) AS movimentacao_com_partes_relacionadas
  FROM marcados
  GROUP BY 1, 2
)
SELECT pm.competencia AS mes, pm.entidade,
       pm.lancamentos,
       pm.lancamentos_fora_do_padrao,
       pm.lancamentos_em_conta_parada,
       COALESCE(es.pares, 0) AS pares_de_estorno,
       pm.lancamentos_de_competencia_anterior,
       COALESCE(du.repetidos, 0) AS lancamentos_duplicados,
       COALESCE(rc.contas_recorrentes_sem_lancamento, 0) AS contas_recorrentes_sem_lancamento,
       pm.contas_com_classificacao_inconsistente,
       pm.valor_total,
       pm.valor_fora_do_padrao,
       COALESCE(es.valor, 0) AS valor_de_estornos,
       pm.valor_de_competencia_anterior,
       COALESCE(du.valor, 0) AS valor_duplicado,
       pm.valor_sem_centro_de_custo,
       NULL::numeric AS valor_em_conta_generica,
       pm.valor_sem_natureza,
       pm.valor_em_classificacao_inconsistente,
       pm.movimentacao_com_partes_relacionadas
FROM por_mes pm
LEFT JOIN estornos es USING (competencia, entidade)
LEFT JOIN duplicados du USING (competencia, entidade)
LEFT JOIN recorrentes rc USING (competencia, entidade);
