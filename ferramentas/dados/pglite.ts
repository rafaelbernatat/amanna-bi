/**
 * Um `ClientePostgres` sobre o PGlite: Postgres em processo, para o ensaio.
 *
 * Não há Docker nem `psql` na máquina de quem desenvolve, e a carga de verdade
 * precisa de um projeto Supabase que só uma pessoa cria (H-65). O PGlite
 * executa o mesmo SQL — migração, views, conferências — dentro do processo, e
 * é o que permite provar a carga e o adaptador de warehouse antes de o banco
 * existir. Ferramenta e teste: o produto nunca importa este módulo.
 *
 * O contrato é o mesmo de `src/acesso/postgres/cliente.ts`: `consultar`,
 * `transacao` e `encerrar`. Consulta sem parâmetro vai por `exec`, que aceita
 * vários comandos numa string só — é como os arquivos de migração chegam.
 */

import { PGlite } from "@electric-sql/pglite";

import type { ClientePostgres } from "@/acesso/postgres/cliente";

/** Datas e instantes viram texto, como o driver `pg` do produto entrega. */
function normalizar(linha: Record<string, unknown>): Record<string, unknown> {
  const saida: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(linha)) {
    saida[chave] =
      valor instanceof Date ? valor.toISOString().slice(0, 10) : valor;
  }
  return saida;
}

function envolver(banco: PGlite, dentroDeTransacao: boolean): ClientePostgres {
  return {
    async consultar<T>(sql: string, parametros?: readonly unknown[]) {
      if (parametros === undefined || parametros.length === 0) {
        const resultados = await banco.exec(sql);
        const ultimo = resultados[resultados.length - 1];
        return (ultimo?.rows ?? []).map((l) =>
          normalizar(l as Record<string, unknown>),
        ) as readonly T[];
      }
      const resultado = await banco.query(sql, [...parametros]);
      return resultado.rows.map((l) =>
        normalizar(l as Record<string, unknown>),
      ) as readonly T[];
    },
    async transacao<T>(f: (c: ClientePostgres) => Promise<T>) {
      if (dentroDeTransacao) return f(envolver(banco, true));
      await banco.exec("BEGIN");
      try {
        const saida = await f(envolver(banco, true));
        await banco.exec("COMMIT");
        return saida;
      } catch (erro) {
        await banco.exec("ROLLBACK");
        throw erro;
      }
    },
    async encerrar() {
      if (!dentroDeTransacao) await banco.close();
    },
  };
}

/**
 * Um banco em processo. Sem `pasta`, vive só em memória e morre no `encerrar`;
 * com `pasta`, persiste em disco — é como o ensaio da base inteira sobrevive
 * entre execuções sem recarregar 82 MB a cada vez.
 */
export async function criarClientePglite(
  pasta?: string,
): Promise<ClientePostgres> {
  const banco = pasta === undefined ? new PGlite() : new PGlite(pasta);
  await banco.waitReady;
  return envolver(banco, false);
}
