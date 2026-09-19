-- 012 · O esquema que o chat consulta, e o papel que só o enxerga (T-449)
--
-- Produto decidiu em 2026-09-19 que o chat responde qualquer pergunta sobre os
-- dados, consultando o banco — inclusive "os nomes dos colaboradores mais
-- caros". Isso reverte duas frases da seção 7.5 do PRD ("sem SQL gerado por
-- modelo" e "sem acesso a linha individual"), e a reversão vem com uma tranca
-- nova, que é este arquivo.
--
-- ## A defesa é o papel, e só o papel
--
-- `amanna_chat_ro` tem GRANT em `amanna_chat` e **nenhum** em `amanna`. As
-- views são `security_definer` por padrão (é o padrão do Postgres, e não se
-- mexe nele aqui): elas leem `amanna` por dentro, e quem as usa não alcança as
-- tabelas cruas. Coluna proibida não é desencorajada — é inalcançável, e um
-- teste sobre `information_schema` prova isso sem carregar um CSV.
--
-- `SET LOCAL ROLE` **não** serviria, e isto foi medido: dentro de uma
-- transação somente-leitura, `set_config('role', <session_user>, false)` volta
-- à role autenticada, e `query_to_xml` planeja a consulta interna depois da
-- escalada. Por isso o produto abre uma **conexão separada**, autenticada como
-- este papel (`DATABASE_URL_CHAT`), e por isso as revogações abaixo existem.
--
-- ## O que fica de fora, e não é esquecimento
--
-- `ponto_ausencias` carrega `cid`, diagnóstico por pessoa nomeada.
-- `pesquisa_engajamento` carrega eNPS e comentário aberto por matrícula, numa
-- pesquisa prometida como anônima. `candidaturas` carrega pretensão salarial e
-- motivo de reprova de quem nem é empregado. Nenhum dos três cabe em "nome e
-- custo", e nenhum tem view aqui.

CREATE SCHEMA IF NOT EXISTS amanna_chat;

-- ------------------------------------------------------------------
-- O papel
-- ------------------------------------------------------------------

-- `NOLOGIN`: a senha é posta fora daqui, por quem provisiona. Uma senha neste
-- arquivo seria pega pelo gitleaks do CI, e com razão.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'amanna_chat_ro') THEN
    CREATE ROLE amanna_chat_ro NOLOGIN;
  END IF;
END
$$;

-- Os tetos moram no papel: valem quando o pooler abre a conexão, mesmo que o
-- nosso código esqueça o `SET LOCAL`. `search_path` sem `amanna` faz
-- `FROM razao_contabil` dar "relation does not exist" em vez de depender de
-- não haver GRANT.
ALTER ROLE amanna_chat_ro SET default_transaction_read_only = on;
ALTER ROLE amanna_chat_ro SET statement_timeout = '5s';
ALTER ROLE amanna_chat_ro SET idle_in_transaction_session_timeout = '10s';
ALTER ROLE amanna_chat_ro SET search_path = amanna_chat, pg_catalog;

REVOKE ALL ON SCHEMA public FROM amanna_chat_ro;
GRANT USAGE ON SCHEMA amanna_chat TO amanna_chat_ro;

-- ------------------------------------------------------------------
-- As funções que derrubam a tranca
-- ------------------------------------------------------------------
--
-- `set_config` devolve a sessão à role autenticada; `query_to_xml` e a família
-- planejam uma consulta em tempo de execução, depois da escalada; `pg_sleep`
-- queima o tempo da transação. Revogadas de PUBLIC e **devolvidas** às roles
-- do Supabase que precisam delas — o PostgREST usa `set_config` a cada pedido,
-- e sem a devolução a Data API para de funcionar de um jeito que parecerá não
-- ter relação com este arquivo.

DO $$
DECLARE
  f text;
  r text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'pg_catalog.set_config(text,text,boolean)',
    'pg_catalog.query_to_xml(text,boolean,boolean,text)',
    'pg_catalog.query_to_json(text,boolean,boolean,text)',
    'pg_catalog.query_to_xmlschema(text,boolean,boolean,text)',
    'pg_catalog.pg_sleep(double precision)',
    'pg_catalog.pg_sleep_for(interval)',
    'pg_catalog.pg_sleep_until(timestamp with time zone)'
  ] LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', f);
    EXCEPTION WHEN undefined_function THEN
      NULL;  -- a versão do Postgres não tem essa assinatura
    END;
    FOREACH r IN ARRAY ARRAY[
      'postgres', 'authenticator', 'anon', 'authenticated', 'service_role',
      'supabase_admin', 'supabase_auth_admin', 'supabase_storage_admin'
    ] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
        BEGIN
          EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO %I', f, r);
        EXCEPTION WHEN undefined_function THEN
          NULL;
        END;
      END IF;
    END LOOP;
  END LOOP;
END
$$;

-- ------------------------------------------------------------------
-- O escopo de perfil, como predicado
-- ------------------------------------------------------------------
--
-- A consulta do modelo agrega, e a coluna de recorte pode nem estar na saída:
-- filtrar o resultado não funciona, e por isso o filtro é **na fonte**. O
-- escopo da sessão viaja em três GUCs postas por `SET LOCAL` — o comando, que
-- a revogação de função não alcança e que é erro de sintaxe dentro da
-- subconsulta em que a consulta do modelo é embrulhada.
--
-- **Fail-closed**: GUC ausente ou vazia devolve falso, e a view não mostra
-- linha nenhuma. Um caminho que esqueça de pôr o escopo lê zero linhas, e um
-- teste prova isso.

-- `p_modulo` nulo quer dizer "qualquer módulo concedido": é o caso das views
-- de dimensão, que dizem só como um código se chama e servem aos três
-- módulos. Continua fail-closed — sem nenhum módulo concedido, nada passa.
CREATE OR REPLACE FUNCTION amanna_chat.no_escopo(
  p_entidade text,
  p_area text,
  p_modulo text
) RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    -- módulo: 'rh', 'fin' ou 'int', como MODULOS_POR_PERFIL declara
    CASE
      WHEN p_modulo IS NULL
        THEN coalesce(current_setting('amanna.escopo_modulos', true), '') <> ''
      ELSE p_modulo = ANY (string_to_array(coalesce(current_setting('amanna.escopo_modulos', true), ''), ','))
    END
    AND (
      /*
       * 'consolidado' concedido alarga para todas as entidades, e isto é
       * literal: o consolidado **é** a soma delas, e quem pode ver a soma
       * pode ver as parcelas que a compõem. Os códigos de entidade da base
       * são `unidade-sp` e `demais-unidades`; sem esta linha, um perfil de
       * diretoria (que recebe `consolidado`) leria zero linhas.
       */
      p_entidade IS NULL
      OR 'consolidado' = ANY (string_to_array(coalesce(current_setting('amanna.escopo_entidades', true), ''), ','))
      OR p_entidade = ANY (string_to_array(coalesce(current_setting('amanna.escopo_entidades', true), ''), ','))
    )
    AND (
      p_area IS NULL
      OR 'todas' = ANY (string_to_array(coalesce(current_setting('amanna.escopo_areas', true), ''), ','))
      OR p_area = ANY (string_to_array(coalesce(current_setting('amanna.escopo_areas', true), ''), ','))
    );
$$;

-- ------------------------------------------------------------------
-- O razão, lançamento a lançamento
-- ------------------------------------------------------------------
--
-- Larga `usuario` (o operador do ERP é uma pessoa que não está em "nome e
-- custo"), os ids internos e `arquivo_origem`, que é encanamento da carga.
-- `parceiro_nome` fica: cliente e fornecedor são pessoa jurídica, e as oito
-- dimensões de ranking já os expõem desde D-DADOS.

CREATE OR REPLACE VIEW amanna_chat.lancamento AS
SELECT r.id_lancamento,
       r.lote,
       r.data,
       r.competencia AS mes,
       e.entidade,
       e.nome AS entidade_nome,
       r.conta,
       r.conta_descricao,
       r.linha_dre,
       dc.demonstrativo,
       c.area,
       r.centro_custo,
       r.historico,
       r.debito,
       r.credito,
       GREATEST(r.debito, r.credito) AS valor,
       r.documento_tipo,
       r.documento_numero,
       r.nf_numero,
       r.parceiro_tipo,
       r.parceiro_nome,
       r.id_projeto,
       r.status
FROM amanna.razao_contabil r
JOIN amanna.v_entidade e USING (id_entidade)
LEFT JOIN amanna.v_centro c USING (id_centro_custo)
LEFT JOIN amanna.dim_conta_contabil dc USING (conta)
WHERE amanna_chat.no_escopo(e.entidade, c.area, 'fin');

-- As marcas de qualidade, por lançamento.
--
-- É a CTE `marcados` de 007 parada antes do `GROUP BY` final — mas reescrita.
-- A CTE `historico` de 007 é uma junção cruzada de meses × entidades × contas
-- com três subconsultas correlacionadas: paga uma vez por view agregada,
-- tudo bem; paga por lançamento sobre 128 mil linhas, estoura o
-- `statement_timeout` em toda consulta. `fora_do_padrao` vira função de
-- janela, e `em_conta_parada` vira um `NOT EXISTS` sobre um conjunto pequeno.
--
-- `tests/dados/chat-sql-pglite.test.ts` prova que as marcas somam, por mês e
-- entidade, exatamente o que `vw_fato_qualidade_mes` diz: duas definições da
-- mesma marca que divergem são pior que uma.

CREATE OR REPLACE VIEW amanna_chat.lancamento_qualidade AS
WITH l AS (
  SELECT r.id_lancamento, r.lote, r.competencia, r.id_entidade, e.entidade,
         c.area, r.centro_custo, r.conta, r.conta_descricao, r.data,
         r.historico, r.documento_numero, r.parceiro_tipo, r.parceiro_nome,
         GREATEST(r.debito, r.credito) AS valor,
         to_char(r.data, 'YYYY-MM') AS mes_da_data,
         r.linha_dre AS linha_do_lancamento,
         dc.linha_dre AS linha_do_plano,
         dc.demonstrativo
  FROM amanna.razao_contabil r
  JOIN amanna.v_entidade e USING (id_entidade)
  LEFT JOIN amanna.v_centro c USING (id_centro_custo)
  LEFT JOIN amanna.dim_conta_contabil dc USING (conta)
),
meses_conta AS (
  SELECT DISTINCT competencia, id_entidade, conta FROM l
),
-- Quantos meses a base tem antes de cada competência, na janela de seis.
janela AS (
  SELECT m.competencia,
         (SELECT COUNT(*) FROM amanna.v_meses mx
          WHERE mx.fim_do_mes < m.inicio_do_mes
            AND mx.fim_do_mes >= m.inicio_do_mes - INTERVAL '6 months') AS meses_carregados
  FROM amanna.v_meses m
),
/*
 * A marca de conta parada, **por conta e mês**, e não por lançamento.
 *
 * São ~24 meses × as combinações de entidade e conta que existem: alguns
 * milhares de linhas. Avaliada por lançamento, a mesma pergunta rodaria 128
 * mil vezes, e a primeira medida em PGlite levou mais de dez minutos. O
 * `JOIN` abaixo devolve a resposta pronta a cada linha.
 */
parada AS (
  SELECT j.competencia, mc.id_entidade, mc.conta,
         (j.meses_carregados = 6
          AND NOT EXISTS (
            SELECT 1 FROM meses_conta x
            JOIN amanna.v_meses mx ON mx.competencia = x.competencia
            JOIN amanna.v_meses m0 ON m0.competencia = j.competencia
            WHERE x.id_entidade = mc.id_entidade AND x.conta = mc.conta
              AND mx.fim_do_mes < m0.inicio_do_mes
              AND mx.fim_do_mes >= m0.inicio_do_mes - INTERVAL '6 months'
          )) AS em_conta_parada
  FROM janela j
  CROSS JOIN (SELECT DISTINCT id_entidade, conta FROM l) mc
),
com_padrao AS (
  SELECT l.*,
         AVG(l.valor) OVER (PARTITION BY l.competencia, l.id_entidade, l.conta) AS media,
         STDDEV_SAMP(l.valor) OVER (PARTITION BY l.competencia, l.id_entidade, l.conta) AS desvio
  FROM l
)
SELECT p.id_lancamento,
       p.lote,
       p.competencia AS mes,
       p.entidade,
       p.area,
       p.centro_custo,
       p.conta,
       p.conta_descricao,
       p.data,
       p.historico,
       p.documento_numero,
       p.parceiro_tipo,
       p.parceiro_nome,
       p.valor,
       p.linha_do_lancamento,
       p.linha_do_plano,
       (p.desvio IS NOT NULL AND p.desvio > 0 AND p.valor > p.media + 3 * p.desvio) AS fora_do_padrao,
       COALESCE(pa.em_conta_parada, false) AS em_conta_parada,
       (p.mes_da_data > p.competencia) AS de_competencia_anterior,
       (p.linha_do_lancamento IS DISTINCT FROM p.linha_do_plano) AS inconsistente,
       (p.centro_custo IS NULL OR p.centro_custo = '') AS sem_centro_de_custo,
       (p.demonstrativo = 'DRE' AND p.linha_do_plano IS NULL) AS sem_natureza,
       (p.parceiro_tipo IN ('Sócio', 'Parte relacionada')) AS partes_relacionadas
FROM com_padrao p
LEFT JOIN parada pa
  ON pa.competencia = p.competencia
 AND pa.id_entidade = p.id_entidade
 AND pa.conta = p.conta
WHERE amanna_chat.no_escopo(p.entidade, p.area, 'fin');

-- ------------------------------------------------------------------
-- As pessoas: nome, cargo, área e custo
-- ------------------------------------------------------------------
--
-- Fora: `cpf_ficticio`, `data_nascimento`, `faixa_etaria`, `genero`,
-- `escolaridade`, `uf`, `cidade`, `banco`, `sindicato`, `gestor_matricula`,
-- `motivo_desligamento` e `tipo_desligamento`. Nenhum deles é nome, cargo,
-- área ou custo; `motivo_desligamento` é a célula mais cara da base.
--
-- `matricula` fica: é número interno, e sem ele dois homônimos viram um.

CREATE OR REPLACE VIEW amanna_chat.folha AS
SELECT f.competencia AS mes,
       f.matricula,
       f.nome,
       f.cargo,
       f.nivel,
       e.entidade,
       c.area,
       f.centro_custo,
       f.modalidade,
       f.fte,
       f.dias_trabalhados,
       f.salario_base,
       f.horas_extras,
       f.adicional_noturno,
       f.periculosidade,
       f.comissao,
       f.bonus,
       f.plr,
       f.verbas_rescisorias,
       f.provisao_ferias,
       f.provisao_decimo,
       f.total_proventos,
       f.total_descontos,
       f.liquido_a_pagar,
       f.total_encargos,
       f.total_beneficios,
       f.total_provisoes,
       f.custo_total_empresa
FROM amanna.folha_pagamento f
JOIN amanna.v_entidade e USING (id_entidade)
LEFT JOIN amanna.v_centro c USING (id_centro_custo)
WHERE amanna_chat.no_escopo(e.entidade, c.area, 'rh');

CREATE OR REPLACE VIEW amanna_chat.colaborador AS
SELECT co.matricula,
       co.nome,
       co.cargo,
       co.nivel,
       e.entidade,
       c.area,
       co.centro_custo,
       co.modalidade,
       co.tipo_contrato,
       co.jornada_semanal,
       co.fte,
       co.salario_base,
       co.data_admissao,
       co.data_desligamento,
       co.status
FROM amanna.colaboradores co
JOIN amanna.v_entidade e USING (id_entidade)
LEFT JOIN amanna.v_centro c USING (id_centro_custo)
WHERE amanna_chat.no_escopo(e.entidade, c.area, 'rh');

-- ------------------------------------------------------------------
-- O financeiro em detalhe
-- ------------------------------------------------------------------

-- `aprovado_por` fica de fora: é o nome de quem aprovou, e aprovação não é
-- nem cargo nem custo.
CREATE OR REPLACE VIEW amanna_chat.titulo_a_pagar AS
SELECT t.id_titulo, t.competencia AS mes, e.entidade, c.area, c.centro_custo,
       t.fornecedor, t.categoria, t.conta, t.conta_descricao,
       t.data_emissao, t.data_vencimento, t.data_pagamento,
       t.valor_titulo, t.valor_pago, t.dias_para_pagar, t.status
FROM amanna.contas_pagar t
JOIN amanna.v_entidade e USING (id_entidade)
LEFT JOIN amanna.v_centro c USING (id_centro_custo)
WHERE amanna_chat.no_escopo(e.entidade, c.area, 'fin');

CREATE OR REPLACE VIEW amanna_chat.titulo_a_receber AS
SELECT t.id_titulo, t.competencia AS mes, e.entidade, t.cliente,
       t.rating_credito, t.data_emissao, t.data_vencimento, t.data_recebimento,
       t.valor_titulo, t.valor_recebido, t.dias_atraso, t.faixa_aging,
       t.provisao_pdd, t.status
FROM amanna.contas_receber t
JOIN amanna.v_entidade e USING (id_entidade)
WHERE amanna_chat.no_escopo(e.entidade, NULL, 'fin');

CREATE OR REPLACE VIEW amanna_chat.movimento_caixa AS
SELECT m.data, m.competencia AS mes, e.entidade, m.classe_fluxo, m.natureza,
       m.historico, m.documento, m.parceiro, m.entrada, m.saida, m.saldo_apos
FROM amanna.movimento_caixa m
JOIN amanna.v_entidade e USING (id_entidade)
WHERE amanna_chat.no_escopo(e.entidade, NULL, 'fin');

-- ------------------------------------------------------------------
-- As dimensões
-- ------------------------------------------------------------------

CREATE OR REPLACE VIEW amanna_chat.dim_conta AS
SELECT conta, conta_descricao, linha_dre, demonstrativo, natureza
FROM amanna.dim_conta_contabil;

CREATE OR REPLACE VIEW amanna_chat.dim_centro_custo AS
SELECT id_centro_custo, centro_custo, area_slug AS area
FROM amanna.dim_centro_custo
WHERE amanna_chat.no_escopo(NULL, area_slug, NULL);

CREATE OR REPLACE VIEW amanna_chat.dim_entidade AS
SELECT grupo_filtro AS entidade, entidade AS nome
FROM amanna.dim_entidade
WHERE amanna_chat.no_escopo(grupo_filtro, NULL, NULL);

CREATE OR REPLACE VIEW amanna_chat.mes AS
SELECT competencia AS mes, inicio_do_mes, fim_do_mes, dias_uteis
FROM amanna.v_meses;

-- ------------------------------------------------------------------
-- O dicionário
-- ------------------------------------------------------------------
--
-- Tabela semeada, e não uma consulta a `information_schema`. Duas razões: ela
-- carrega a **unidade** de cada coluna, que é o que o chat usa para formatar
-- (um `4329.15` vira `R$ 4.329,15` no nosso código, nunca no do modelo); e a
-- seção 7.4 exige prefixo de prompt byte-estável, que uma consulta ao catálogo
-- do Postgres não dá — a ordem muda, e o cache de prompt cai sem ninguém ver.

CREATE TABLE IF NOT EXISTS amanna_chat.dicionario (
  objeto text NOT NULL,
  coluna text NOT NULL,
  ordem integer NOT NULL,
  unidade text,
  descricao text,
  PRIMARY KEY (objeto, coluna)
);

INSERT INTO amanna_chat.dicionario (objeto, coluna, ordem, unidade, descricao) VALUES
  ('lancamento', 'mes', 1, NULL, 'Competência, AAAA-MM'),
  ('lancamento', 'conta', 2, NULL, 'Conta contábil'),
  ('lancamento', 'conta_descricao', 3, NULL, 'Nome da conta'),
  ('lancamento', 'centro_custo', 4, NULL, 'Centro de custo'),
  ('lancamento', 'area', 5, NULL, 'Área, em código'),
  ('lancamento', 'historico', 6, NULL, 'O histórico escrito do lançamento'),
  ('lancamento', 'parceiro_nome', 7, NULL, 'Cliente ou fornecedor'),
  ('lancamento', 'valor', 8, 'reais', 'O maior entre débito e crédito'),
  ('lancamento', 'debito', 9, 'reais', 'Débito'),
  ('lancamento', 'credito', 10, 'reais', 'Crédito'),
  ('lancamento_qualidade', 'fora_do_padrao', 1, NULL, 'Acima de três desvios da média da conta no mês'),
  ('lancamento_qualidade', 'em_conta_parada', 2, NULL, 'Conta sem movimento nos seis meses anteriores'),
  ('lancamento_qualidade', 'de_competencia_anterior', 3, NULL, 'Lançado depois da competência'),
  ('lancamento_qualidade', 'inconsistente', 4, NULL, 'Linha da DRE diferente da do plano de contas'),
  ('lancamento_qualidade', 'valor', 5, 'reais', 'O maior entre débito e crédito'),
  ('folha', 'mes', 1, NULL, 'Competência, AAAA-MM'),
  ('folha', 'nome', 2, NULL, 'Nome do colaborador'),
  ('folha', 'cargo', 3, NULL, 'Cargo'),
  ('folha', 'area', 4, NULL, 'Área, em código'),
  ('folha', 'centro_custo', 5, NULL, 'Centro de custo'),
  ('folha', 'fte', 6, 'FTE', 'Equivalente de tempo integral'),
  ('folha', 'salario_base', 7, 'reais', 'Salário base do mês'),
  ('folha', 'custo_total_empresa', 8, 'reais', 'Custo total para a empresa'),
  ('folha', 'total_encargos', 9, 'reais', 'Encargos'),
  ('folha', 'total_beneficios', 10, 'reais', 'Benefícios'),
  ('colaborador', 'nome', 1, NULL, 'Nome do colaborador'),
  ('colaborador', 'cargo', 2, NULL, 'Cargo'),
  ('colaborador', 'area', 3, NULL, 'Área, em código'),
  ('colaborador', 'salario_base', 4, 'reais', 'Salário base'),
  ('colaborador', 'status', 5, NULL, 'Ativo ou desligado'),
  ('titulo_a_pagar', 'fornecedor', 1, NULL, 'Fornecedor'),
  ('titulo_a_pagar', 'categoria', 2, NULL, 'Categoria da despesa'),
  ('titulo_a_pagar', 'valor_titulo', 3, 'reais', 'Valor do título'),
  ('titulo_a_pagar', 'valor_pago', 4, 'reais', 'Valor já pago'),
  ('titulo_a_pagar', 'dias_para_pagar', 5, 'dias', 'Dias entre emissão e pagamento'),
  ('titulo_a_receber', 'cliente', 1, NULL, 'Cliente'),
  ('titulo_a_receber', 'valor_titulo', 2, 'reais', 'Valor do título'),
  ('titulo_a_receber', 'valor_recebido', 3, 'reais', 'Valor já recebido'),
  ('titulo_a_receber', 'dias_atraso', 4, 'dias', 'Dias de atraso'),
  ('titulo_a_receber', 'faixa_aging', 5, NULL, 'Faixa de vencimento'),
  ('movimento_caixa', 'classe_fluxo', 1, NULL, 'Operacional, investimento ou financiamento'),
  ('movimento_caixa', 'natureza', 2, NULL, 'Natureza do movimento'),
  ('movimento_caixa', 'entrada', 3, 'reais', 'Entrada de caixa'),
  ('movimento_caixa', 'saida', 4, 'reais', 'Saída de caixa')
ON CONFLICT (objeto, coluna) DO NOTHING;

-- Por último, e idempotente: as views precisam existir para o GRANT pegá-las.
GRANT SELECT ON ALL TABLES IN SCHEMA amanna_chat TO amanna_chat_ro;
