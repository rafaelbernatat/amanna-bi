-- As views de RH, na forma exata dos tipos `Linha*` de src/acesso/calculo/linhas.ts.
--
-- Cada coluna é o nome do campo em snake_case; `mes` é a competência,
-- `entidade` é o grupo do filtro (`unidade-sp` / `demais-unidades`), `area` é
-- o `area_slug` do centro de custo e `modalidade` é o código do produto.
--
-- Regra 4 da seção 9.2: taxa nenhuma sai daqui. Absenteísmo, eNPS e
-- engajamento entram como numerador e denominador; quem divide é o motor, uma
-- vez só, sobre o recorte.

-- Apoio ---------------------------------------------------------------------

-- O código do produto para um valor da base, pelo mapa de 004.
CREATE OR REPLACE FUNCTION amanna.codigo(p_dominio text, p_valor text)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT codigo FROM amanna.map_codigo
  WHERE dominio = p_dominio AND valor_origem = p_valor
$$;

-- As faixas do cadastro, com os mesmos códigos de vw_dim_*.
CREATE OR REPLACE FUNCTION amanna.faixa_etaria(p_idade numeric)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_idade < 25 THEN '18-24'
    WHEN p_idade < 35 THEN '25-34'
    WHEN p_idade < 45 THEN '35-44'
    WHEN p_idade < 55 THEN '45-54'
    ELSE '55-mais' END
$$;

CREATE OR REPLACE FUNCTION amanna.faixa_tempo_de_casa(p_anos numeric)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_anos < 1 THEN 'menos-de-1-ano'
    WHEN p_anos < 3 THEN '1-3-anos'
    WHEN p_anos < 5 THEN '3-5-anos'
    WHEN p_anos < 10 THEN '5-10-anos'
    ELSE '10-mais-anos' END
$$;

CREATE OR REPLACE FUNCTION amanna.faixa_salarial(p_salario numeric)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_salario < 3000 THEN 'ate-3k'
    WHEN p_salario < 6000 THEN '3-6k'
    WHEN p_salario < 10000 THEN '6-10k'
    WHEN p_salario < 18000 THEN '10-18k'
    WHEN p_salario < 30000 THEN '18-30k'
    ELSE 'acima-30k' END
$$;

-- Os meses carregados, com o fim do mês e os dias úteis do calendário.
CREATE OR REPLACE VIEW amanna.v_meses AS
SELECT competencia,
       MIN(data) AS inicio_do_mes,
       MAX(data) AS fim_do_mes,
       COUNT(*) FILTER (WHERE dia_util = 'S') AS dias_uteis
FROM amanna.dim_calendario
GROUP BY competencia;

-- A entidade como o filtro a vê.
CREATE OR REPLACE VIEW amanna.v_entidade AS
SELECT id_entidade, grupo_filtro AS entidade, entidade AS nome
FROM amanna.dim_entidade;

-- O centro de custo com a área em código.
CREATE OR REPLACE VIEW amanna.v_centro AS
SELECT id_centro_custo, area_slug AS area, centro_custo
FROM amanna.dim_centro_custo;

-- Quem recebeu folha em cada competência, já com a célula do grão resolvida.
--
-- É a definição de quadro que reconcilia com o gabarito (1.235,4 FTE em
-- dez/2026). A alternativa — ativos em 31/12 — dá 1.223,4 e está na pauta de
-- H-08 (D-DADOS).
CREATE OR REPLACE VIEW amanna.v_pagos AS
SELECT f.competencia,
       f.matricula,
       e.entidade,
       c.area,
       amanna.codigo('modalidade', f.modalidade) AS modalidade,
       f.fte,
       f.salario_base,
       f.horas_extras, f.adicional_noturno, f.periculosidade,
       f.verbas_rescisorias, f.total_provisoes,
       f.total_encargos, f.total_beneficios, f.desconto_vt, f.coparticipacao_saude,
       f.comissao, f.bonus, f.plr,
       col.data_nascimento, col.data_admissao, col.jornada_semanal,
       col.escolaridade, col.genero, col.uf,
       m.fim_do_mes, m.dias_uteis
FROM amanna.folha_pagamento f
JOIN amanna.v_entidade e USING (id_entidade)
JOIN amanna.v_centro c USING (id_centro_custo)
JOIN amanna.colaboradores col USING (matricula)
JOIN amanna.v_meses m USING (competencia);

-- vw_fato_rh_mes -------------------------------------------------------------

CREATE OR REPLACE VIEW amanna.vw_fato_rh_mes AS
WITH quadro AS (
  SELECT competencia, entidade, area, modalidade,
         SUM(fte) AS headcount_fte,
         SUM(fte) AS elegiveis,
         SUM(EXTRACT(YEAR FROM AGE(fim_do_mes, data_nascimento))) AS soma_de_idade,
         SUM((fim_do_mes - data_admissao) / 365.25) AS soma_de_tempo_de_casa,
         SUM(salario_base + horas_extras + adicional_noturno + periculosidade
             + verbas_rescisorias + total_provisoes) AS salarios,
         SUM(total_encargos) AS encargos,
         SUM(total_beneficios - desconto_vt - coparticipacao_saude) AS beneficios,
         SUM(comissao + bonus + plr) AS variavel,
         SUM(COALESCE(jornada_semanal, 44) / 5.0 * dias_uteis) AS horas_previstas
  FROM amanna.v_pagos
  GROUP BY 1, 2, 3, 4
),
movimento AS (
  SELECT mp.competencia, e.entidade, c.area,
         amanna.codigo('modalidade', col.modalidade) AS modalidade,
         COUNT(*) FILTER (WHERE mp.evento = 'Admissão') AS admissoes,
         COUNT(*) FILTER (WHERE mp.evento = 'Desligamento') AS desligamentos,
         COALESCE(SUM((mp.data - col.data_admissao) / 365.25)
                  FILTER (WHERE mp.evento = 'Desligamento'), 0) AS soma_de_tempo_ate_a_saida
  FROM amanna.movimentacao_pessoal mp
  JOIN amanna.colaboradores col USING (matricula)
  JOIN amanna.v_entidade e ON e.id_entidade = col.id_entidade
  JOIN amanna.v_centro c ON c.id_centro_custo = col.id_centro_custo
  GROUP BY 1, 2, 3, 4
),
ausencias AS (
  SELECT p.competencia, e.entidade, c.area,
         amanna.codigo('modalidade', p.modalidade) AS modalidade,
         SUM(p.horas_perdidas) AS horas_ausentes
  FROM amanna.ponto_ausencias p
  JOIN amanna.v_entidade e ON e.id_entidade = p.id_entidade
  JOIN amanna.v_centro c ON c.id_centro_custo = p.id_centro_custo
  GROUP BY 1, 2, 3, 4
),
clima AS (
  SELECT p.competencia, e.entidade, c.area,
         amanna.codigo('modalidade', p.modalidade) AS modalidade,
         COUNT(*) AS respondentes,
         COUNT(*) FILTER (WHERE p.enps_nota >= 9) AS promotores,
         COUNT(*) FILTER (WHERE p.enps_nota BETWEEN 7 AND 8) AS neutros,
         COUNT(*) FILTER (WHERE p.enps_nota <= 6) AS detratores,
         SUM((p.dim_lideranca + p.dim_reconhecimento + p.dim_carreira + p.dim_remuneracao
              + p.dim_ambiente + p.dim_carga + p.dim_comunicacao + p.dim_autonomia
              + p.dim_proposito + p.dim_ferramentas) / 10.0) AS pontos_de_engajamento
  FROM amanna.pesquisa_engajamento p
  JOIN amanna.v_entidade e ON e.id_entidade = p.id_entidade
  JOIN amanna.v_centro c ON c.id_centro_custo = p.id_centro_custo
  GROUP BY 1, 2, 3, 4
),
treino AS (
  SELECT t.competencia, e.entidade, c.area,
         amanna.codigo('modalidade', t.modalidade_colaborador) AS modalidade,
         COUNT(DISTINCT t.matricula) AS participantes_de_treinamento
  FROM amanna.treinamento_participacoes t
  JOIN amanna.v_entidade e ON e.id_entidade = t.id_entidade
  JOIN amanna.v_centro c ON c.id_centro_custo = t.id_centro_custo
  GROUP BY 1, 2, 3, 4
),
chaves AS (
  SELECT competencia, entidade, area, modalidade FROM quadro
  UNION SELECT competencia, entidade, area, modalidade FROM movimento
  UNION SELECT competencia, entidade, area, modalidade FROM ausencias
  UNION SELECT competencia, entidade, area, modalidade FROM clima
  UNION SELECT competencia, entidade, area, modalidade FROM treino
)
SELECT k.competencia AS mes,
       k.entidade, k.area, k.modalidade,
       COALESCE(q.headcount_fte, 0) AS headcount_fte,
       COALESCE(mv.admissoes, 0) AS admissoes,
       COALESCE(mv.desligamentos, 0) AS desligamentos,
       COALESCE(q.salarios, 0) + COALESCE(q.encargos, 0)
         + COALESCE(q.beneficios, 0) + COALESCE(q.variavel, 0) AS folha_reais,
       COALESCE(q.salarios, 0) AS salarios,
       COALESCE(q.encargos, 0) AS encargos,
       COALESCE(q.beneficios, 0) AS beneficios,
       COALESCE(q.variavel, 0) AS variavel,
       COALESCE(q.elegiveis, 0) AS elegiveis,
       COALESCE(q.soma_de_idade, 0) AS soma_de_idade,
       COALESCE(q.soma_de_tempo_de_casa, 0) AS soma_de_tempo_de_casa,
       COALESCE(mv.soma_de_tempo_ate_a_saida, 0) AS soma_de_tempo_ate_a_saida,
       COALESCE(tr.participantes_de_treinamento, 0) AS participantes_de_treinamento,
       -- Custo modelado: nulo até H-52. Ver vw_fato_turnover_custo.
       NULL::numeric AS custo_de_reposicao,
       NULL::numeric AS custo_de_desligamento,
       COALESCE(q.horas_previstas, 0) AS horas_previstas,
       COALESCE(a.horas_ausentes, 0) AS horas_ausentes,
       COALESCE(cl.respondentes, 0) AS respondentes,
       COALESCE(cl.promotores, 0) AS promotores,
       COALESCE(cl.neutros, 0) AS neutros,
       COALESCE(cl.detratores, 0) AS detratores,
       COALESCE(cl.pontos_de_engajamento, 0) AS pontos_de_engajamento
FROM chaves k
LEFT JOIN quadro q USING (competencia, entidade, area, modalidade)
LEFT JOIN movimento mv USING (competencia, entidade, area, modalidade)
LEFT JOIN ausencias a USING (competencia, entidade, area, modalidade)
LEFT JOIN clima cl USING (competencia, entidade, area, modalidade)
LEFT JOIN treino tr USING (competencia, entidade, area, modalidade);

-- vw_fato_rh_perfil ----------------------------------------------------------
--
-- Uma linha por célula × dimensão × valor, com o quadro em FTE. Cada dimensão
-- soma o mesmo quadro: é a invariante que o teste de reconciliação confere.

CREATE OR REPLACE VIEW amanna.vw_fato_rh_perfil AS
WITH p AS (
  SELECT competencia, entidade, area, modalidade, fte,
         EXTRACT(YEAR FROM AGE(fim_do_mes, data_nascimento)) AS idade,
         (fim_do_mes - data_admissao) / 365.25 AS anos_de_casa,
         salario_base, escolaridade, genero, uf
  FROM amanna.v_pagos
)
SELECT competencia AS mes, entidade, area, modalidade,
       'faixa_etaria' AS dimensao, amanna.faixa_etaria(idade) AS valor, SUM(fte) AS headcount_fte
FROM p GROUP BY 1, 2, 3, 4, 6
UNION ALL
SELECT competencia, entidade, area, modalidade,
       'tempo_de_casa', amanna.faixa_tempo_de_casa(anos_de_casa), SUM(fte)
FROM p GROUP BY 1, 2, 3, 4, 6
UNION ALL
SELECT competencia, entidade, area, modalidade,
       'escolaridade', amanna.codigo('escolaridade', escolaridade), SUM(fte)
FROM p GROUP BY 1, 2, 3, 4, 6
UNION ALL
SELECT competencia, entidade, area, modalidade,
       'uf', uf, SUM(fte)
FROM p GROUP BY 1, 2, 3, 4, 6
UNION ALL
SELECT competencia, entidade, area, modalidade,
       'faixa_salarial', amanna.faixa_salarial(salario_base), SUM(fte)
FROM p GROUP BY 1, 2, 3, 4, 6
UNION ALL
SELECT competencia, entidade, area, modalidade,
       'genero', amanna.codigo('genero', genero), SUM(fte)
FROM p GROUP BY 1, 2, 3, 4, 6;

-- vw_fato_vagas --------------------------------------------------------------
--
-- Grão mês × área. Abertas contam pelo mês de abertura; fechadas, pelo mês de
-- fechamento; canceladas e congeladas não têm data de fechamento na base e
-- contam pelo mês de abertura. Em andamento é estoque: aberta até o fim do
-- mês e sem fechamento até lá.

CREATE OR REPLACE VIEW amanna.vw_fato_vagas AS
WITH v AS (
  -- `vagas_recrutamento.area` é o nome por extenso; a área em código vem do
  -- centro de custo, e é a única que sai daqui.
  SELECT vg.id_vaga, vg.competencia_abertura, vg.data_abertura, vg.data_fechamento,
         vg.status, vg.motivo, vg.custo_total, vg.dias_para_fechar,
         vg.candidaturas, vg.triagem, vg.entrevistas, vg.propostas, vg.contratacoes,
         c.area, to_char(vg.data_fechamento, 'YYYY-MM') AS mes_fechamento
  FROM amanna.vagas_recrutamento vg
  JOIN amanna.v_centro c USING (id_centro_custo)
),
chaves AS (
  SELECT m.competencia AS mes, a.area
  FROM amanna.v_meses m CROSS JOIN (SELECT DISTINCT area FROM v) a
),
abertas AS (
  SELECT competencia_abertura AS mes, area,
         COUNT(*) AS abertas,
         COUNT(*) FILTER (WHERE status = 'Cancelada') AS canceladas,
         SUM(candidaturas) AS candidaturas, SUM(triagem) AS triagem,
         SUM(entrevistas) AS entrevistas, SUM(propostas) AS propostas,
         SUM(contratacoes) AS contratados
  FROM v GROUP BY 1, 2
),
fechadas AS (
  SELECT mes_fechamento AS mes, area,
         COUNT(*) AS fechadas,
         SUM(custo_total) AS custo_de_recrutamento,
         SUM(dias_para_fechar) AS dias_somados
  FROM v WHERE status = 'Fechada' AND mes_fechamento IS NOT NULL
  GROUP BY 1, 2
),
em_andamento AS (
  SELECT m.competencia AS mes, v.area, COUNT(*) AS em_andamento
  FROM amanna.v_meses m
  JOIN v ON v.data_abertura <= m.fim_do_mes
        AND (v.data_fechamento IS NULL OR v.data_fechamento > m.fim_do_mes)
        AND v.status <> 'Cancelada'
  GROUP BY 1, 2
)
SELECT k.mes, k.area,
       COALESCE(ab.abertas, 0) AS abertas,
       COALESCE(ea.em_andamento, 0) AS em_andamento,
       COALESCE(fe.fechadas, 0) AS fechadas,
       COALESCE(ab.canceladas, 0) AS canceladas,
       COALESCE(fe.custo_de_recrutamento, 0) AS custo_de_recrutamento,
       COALESCE(fe.dias_somados, 0) AS dias_somados,
       COALESCE(ab.candidaturas, 0) AS candidaturas,
       COALESCE(ab.triagem, 0) AS triagem,
       COALESCE(ab.entrevistas, 0) AS entrevistas,
       COALESCE(ab.propostas, 0) AS propostas,
       COALESCE(ab.contratados, 0) AS contratados
FROM chaves k
LEFT JOIN abertas ab USING (mes, area)
LEFT JOIN fechadas fe USING (mes, area)
LEFT JOIN em_andamento ea USING (mes, area);

-- vw_fato_vagas_fonte --------------------------------------------------------

CREATE OR REPLACE VIEW amanna.vw_fato_vagas_fonte AS
SELECT cd.competencia AS mes, c.area,
       amanna.codigo('fonte_candidato', cd.fonte) AS fonte,
       COUNT(*) AS contratados
FROM amanna.candidaturas cd
JOIN amanna.vagas_recrutamento vg USING (id_vaga)
JOIN amanna.v_centro c ON c.id_centro_custo = vg.id_centro_custo
WHERE cd.etapa_final = 'Contratado'
GROUP BY 1, 2, 3;

-- vw_fato_treinamento --------------------------------------------------------

CREATE OR REPLACE VIEW amanna.vw_fato_treinamento AS
SELECT p.competencia AS mes, c.area,
       amanna.codigo('trilha', p.categoria) AS trilha,
       amanna.codigo('modalidade_treinamento', t.modalidade) AS modalidade_de_trilha,
       SUM(p.horas_realizadas) AS horas,
       SUM(p.custo) AS investimento_reais,
       COUNT(*) AS trilhas_iniciadas,
       COUNT(*) FILTER (WHERE p.status = 'Concluído') AS trilhas_concluidas,
       COUNT(DISTINCT p.matricula) AS participantes
FROM amanna.treinamento_participacoes p
JOIN amanna.treinamento_turmas t USING (id_turma)
JOIN amanna.v_centro c ON c.id_centro_custo = p.id_centro_custo
GROUP BY 1, 2, 3, 4;

-- vw_fato_rh_desligamento ----------------------------------------------------

CREATE OR REPLACE VIEW amanna.vw_fato_rh_desligamento AS
WITH d AS (
  SELECT mp.competencia, mp.data, mp.tipo,
         e.entidade, c.area,
         amanna.codigo('modalidade', col.modalidade) AS modalidade,
         col.genero, col.data_nascimento
  FROM amanna.movimentacao_pessoal mp
  JOIN amanna.colaboradores col USING (matricula)
  JOIN amanna.v_entidade e ON e.id_entidade = col.id_entidade
  JOIN amanna.v_centro c ON c.id_centro_custo = col.id_centro_custo
  WHERE mp.evento = 'Desligamento'
)
SELECT competencia AS mes, entidade, area, modalidade,
       'tipo' AS dimensao, amanna.codigo('tipo_desligamento', tipo) AS valor,
       COUNT(*) AS desligamentos
FROM d GROUP BY 1, 2, 3, 4, 6
UNION ALL
SELECT competencia, entidade, area, modalidade,
       'genero', amanna.codigo('genero', genero), COUNT(*)
FROM d GROUP BY 1, 2, 3, 4, 6
UNION ALL
SELECT competencia, entidade, area, modalidade,
       'faixa_etaria', amanna.faixa_etaria(EXTRACT(YEAR FROM AGE(data, data_nascimento))), COUNT(*)
FROM d GROUP BY 1, 2, 3, 4, 6;

-- vw_fato_turnover_custo -----------------------------------------------------
--
-- Rescisão sai da folha e recrutamento de reposição sai das vagas fechadas por
-- substituição: os dois são lançamento. Ramp-up e produtividade perdida são
-- custo modelado e dependem de param_turnover (H-52); sem parâmetro, a linha
-- existe com valor nulo — o painel mostra o componente e diz que não sabe.

CREATE OR REPLACE VIEW amanna.vw_fato_turnover_custo AS
WITH chaves AS (
  SELECT DISTINCT competencia AS mes, entidade, area FROM amanna.v_pagos
),
rescisao AS (
  SELECT competencia AS mes, entidade, area, SUM(verbas_rescisorias) AS valor
  FROM amanna.v_pagos GROUP BY 1, 2, 3
),
recrutamento AS (
  SELECT to_char(vg.data_fechamento, 'YYYY-MM') AS mes, e.entidade, c.area,
         SUM(vg.custo_total) AS valor
  FROM amanna.vagas_recrutamento vg
  JOIN amanna.v_entidade e USING (id_entidade)
  JOIN amanna.v_centro c USING (id_centro_custo)
  WHERE vg.status = 'Fechada' AND vg.motivo = 'Substituição' AND vg.data_fechamento IS NOT NULL
  GROUP BY 1, 2, 3
),
saidas AS (
  SELECT mp.competencia AS mes, e.entidade, c.area,
         COUNT(*) AS desligados,
         AVG(col.salario_base) AS salario_medio
  FROM amanna.movimentacao_pessoal mp
  JOIN amanna.colaboradores col USING (matricula)
  JOIN amanna.v_entidade e ON e.id_entidade = col.id_entidade
  JOIN amanna.v_centro c ON c.id_centro_custo = col.id_centro_custo
  WHERE mp.evento = 'Desligamento'
  GROUP BY 1, 2, 3
),
modelado AS (
  SELECT k.mes, k.entidade, k.area, p.componente,
         CASE WHEN p.meses IS NULL OR p.fracao_produtividade IS NULL THEN NULL
              ELSE COALESCE(s.desligados, 0) * COALESCE(s.salario_medio, 0) * p.meses * p.fracao_produtividade END AS valor
  FROM chaves k
  CROSS JOIN amanna.param_turnover p
  LEFT JOIN saidas s USING (mes, entidade, area)
)
SELECT k.mes, k.entidade, k.area, 'rescisao' AS componente, COALESCE(r.valor, 0) AS valor
FROM chaves k LEFT JOIN rescisao r USING (mes, entidade, area)
UNION ALL
SELECT k.mes, k.entidade, k.area, 'recrutamento', COALESCE(rc.valor, 0)
FROM chaves k LEFT JOIN recrutamento rc USING (mes, entidade, area)
UNION ALL
SELECT mes, entidade, area, componente, valor FROM modelado;
