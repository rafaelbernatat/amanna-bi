/**
 * **Isto não é a defesa.**
 *
 * A defesa é o papel `amanna_chat_ro`, que não tem GRANT em `amanna` e cujas
 * conexões vêm de `DATABASE_URL_CHAT`. Isto é um *lint*: ele recusa cedo o que
 * o banco recusaria depois, para devolver ao modelo uma mensagem com que ele
 * consiga se corrigir dentro do laço, em vez de um erro de Postgres.
 *
 * Se algum dia alguém apagar o papel e mantiver este arquivo, o produto fica
 * aberto. A ordem importa: papel primeiro, esquema segundo, isto terceiro.
 *
 * ## O que o embrulho já garante
 *
 * A consulta do modelo é executada dentro de
 * `SELECT * FROM ( <sql> ) AS resultado LIMIT $1`. Ali `;`, `SET`, `COPY` e
 * todo DDL são **erro de sintaxe**, e o parâmetro obriga o protocolo estendido,
 * onde o Postgres recusa mais de um comando por instrução. Este módulo não
 * precisa ser a barreira; precisa ser educado.
 */

/** O que o modelo pode mandar, e por que não pode mandar o resto. */
export type Recusa = { readonly motivo: string };

/** Quanto SQL é SQL demais para uma pergunta de chat. */
export const TAMANHO_MAXIMO_DA_CONSULTA = 4_000;

/**
 * As funções e formas que não têm uso legítimo numa pergunta de painel.
 *
 * `set_config` e a família `query_to_*` estão aqui porque são a escapada
 * medida em `012_chat_sql.sql`: elas planejam em execução, depois de uma
 * mudança de papel. O banco já as revoga; recusar aqui poupa a ida.
 */
const PROIBIDAS: readonly (readonly [RegExp, string])[] = [
  [/\bset_config\s*\(/i, "set_config"],
  [/\bquery_to_(?:xml|json|xmlschema)\s*\(/i, "query_to_xml"],
  [/\bpg_sleep(?:_for|_until)?\s*\(/i, "pg_sleep"],
  [/\bpg_read_(?:file|binary_file)\s*\(/i, "pg_read_file"],
  [/\bpg_ls_dir\s*\(/i, "pg_ls_dir"],
  [/\bpg_stat_file\s*\(/i, "pg_stat_file"],
  [/\blo_(?:import|export)\s*\(/i, "lo_import"],
  [/\bpg_terminate_backend\s*\(/i, "pg_terminate_backend"],
  [/\bdblink\w*\s*\(/i, "dblink"],
  [/\bcopy\b/i, "COPY"],
  [/\binformation_schema\b/i, "information_schema"],
  [/\bpg_catalog\b/i, "pg_catalog"],
  [/\bpg_settings\b/i, "pg_settings"],
];

/**
 * O SQL sem comentários e sem o conteúdo das aspas.
 *
 * É sobre este texto que os padrões correm: um `-- copy` num comentário não é
 * um COPY, e `WHERE historico ILIKE '%copy%'` também não.
 */
function semRuido(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/"(?:[^"]|"")*"/g, '""');
}

/**
 * Confere a consulta antes de mandá-la ao banco.
 *
 * `null` quer dizer "pode ir". A mensagem da recusa é escrita para o modelo
 * ler e tentar de novo, e não para um log.
 */
export function conferirConsulta(sql: string): Recusa | null {
  const bruto = sql.trim();
  if (bruto === "") return { motivo: "a consulta veio vazia" };
  if (bruto.length > TAMANHO_MAXIMO_DA_CONSULTA) {
    return {
      motivo: `a consulta tem ${String(bruto.length)} caracteres; o máximo é ${String(TAMANHO_MAXIMO_DA_CONSULTA)}`,
    };
  }

  const limpo = semRuido(bruto);

  if (!/^\s*(?:select|with)\b/i.test(limpo)) {
    return {
      motivo:
        "só SELECT: a consulta precisa começar com SELECT ou WITH. Não há " +
        "INSERT, UPDATE, DELETE nem DDL nesta porta",
    };
  }
  if (limpo.replace(/;\s*$/, "").includes(";")) {
    return {
      motivo: "uma consulta por vez: tire o ';' do meio da consulta",
    };
  }
  for (const [padrao, nome] of PROIBIDAS) {
    if (padrao.test(limpo)) {
      return {
        motivo: `'${nome}' não está disponível nesta porta; leia as views de amanna_chat`,
      };
    }
  }
  return null;
}
