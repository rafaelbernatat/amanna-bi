import { describe, expect, it } from "vitest";

import {
  conferirConsulta,
  TAMANHO_MAXIMO_DA_CONSULTA,
} from "@/acesso/postgres/sql-guarda";

/**
 * O lint da consulta (T-450).
 *
 * **Isto não é a defesa**, e o teste existe também para dizer isso: a defesa é
 * o papel `amanna_chat_ro`, provado em `chat-sql-migracao.test.ts`. O que se
 * prova aqui é que a recusa chega cedo e com uma mensagem que o modelo
 * consegue usar — e, tão importante quanto, que uma consulta legítima passa.
 */

describe("o que o lint recusa", () => {
  it.each([
    ["vazio", "   ", /vazia/],
    ["um UPDATE", "UPDATE folha SET salario_base = 1", /só SELECT/],
    ["um DELETE", "DELETE FROM folha", /só SELECT/],
    ["um DDL", "CREATE TABLE x (a int)", /só SELECT/],
    ["um COPY", "COPY folha TO '/tmp/x'", /só SELECT/],
    ["dois comandos", "SELECT 1; SELECT 2", /uma consulta por vez/],
    ["set_config", "SELECT set_config('role','postgres',false)", /set_config/],
    [
      "query_to_xml",
      "SELECT query_to_xml('SELECT 1', false, false, '')",
      /query_to_xml/,
    ],
    ["pg_sleep", "SELECT pg_sleep(30)", /pg_sleep/],
    ["pg_read_file", "SELECT pg_read_file('/etc/passwd')", /pg_read_file/],
    [
      "o catálogo do Postgres",
      "SELECT * FROM information_schema.columns",
      /information_schema/,
    ],
  ])("recusa %s", (_, sql, mensagem) => {
    expect(conferirConsulta(sql)?.motivo).toMatch(mensagem);
  });

  it("recusa a consulta longa demais", () => {
    const longa = `SELECT ${"a".repeat(TAMANHO_MAXIMO_DA_CONSULTA)}`;
    expect(conferirConsulta(longa)?.motivo).toMatch(/máximo/);
  });
});

describe("o que o lint deixa passar", () => {
  it.each([
    ["um SELECT simples", "SELECT nome, custo_total_empresa FROM folha"],
    [
      "um WITH",
      "WITH t AS (SELECT conta, SUM(valor) AS v FROM lancamento GROUP BY conta) SELECT * FROM t ORDER BY v DESC",
    ],
    [
      "um ponto e vírgula no fim, que é hábito e não ataque",
      "SELECT conta FROM lancamento;",
    ],
    [
      "a palavra proibida dentro de um literal",
      "SELECT historico FROM lancamento WHERE historico ILIKE '%copy%'",
    ],
    [
      "a palavra proibida dentro de um comentário",
      "-- não é um copy de verdade\nSELECT conta FROM lancamento",
    ],
    [
      "uma junção com agregação e filtro por mês",
      `SELECT l.conta_descricao AS conta, SUM(l.valor) AS total
       FROM lancamento l WHERE l.mes = '2026-06'
       GROUP BY 1 ORDER BY 2 DESC LIMIT 5`,
    ],
  ])("deixa passar %s", (_, sql) => {
    expect(conferirConsulta(sql)).toBeNull();
  });
});
