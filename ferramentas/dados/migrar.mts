/**
 * Aplica as migracoes SQL no banco, sem tocar em dado.
 *
 * `npm run dados:carregar -- --so-migrar` faz o mesmo, mas exige o ambiente
 * montado na mao; este script le o `.env.local` como o resto das ferramentas
 * deveria ler, e diz o que encontrou antes e depois.
 *
 *   npx tsx ferramentas/dados/migrar.mts
 *
 * Usa `DATABASE_URL_CARGA` quando existe (modo sessao), senao `DATABASE_URL`.
 * As migracoes sao idempotentes: rodar de novo nao estraga nada.
 */

import { join } from "node:path";

// `@next/env` e CommonJS: o named export nao atravessa o ESM.
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const { criarCliente, caDoAmbiente } =
  await import("../../src/acesso/postgres/cliente");
const { aplicarMigracoes } = await import("./carga");

const url = process.env["DATABASE_URL_CARGA"] ?? process.env["DATABASE_URL"];
if (url === undefined || url.trim() === "") {
  throw new Error("nem DATABASE_URL_CARGA nem DATABASE_URL configuradas");
}
const ca = caDoAmbiente();
const cliente = criarCliente(url, ca === undefined ? {} : { ca });

async function views(): Promise<number> {
  const linhas = await cliente.consultar<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM information_schema.views
     WHERE table_schema = 'amanna_chat'`,
  );
  return linhas[0]?.n ?? 0;
}

try {
  console.log(`amanna_chat antes: ${String(await views())} views`);
  const arquivos = await aplicarMigracoes(
    cliente,
    join(process.cwd(), "ferramentas", "dados", "sql"),
    (m) => {
      console.log(`  ${m}`);
    },
  );
  console.log(`\n${String(arquivos.length)} migracoes aplicadas`);
  console.log(`amanna_chat depois: ${String(await views())} views`);
} finally {
  await cliente.encerrar();
}
