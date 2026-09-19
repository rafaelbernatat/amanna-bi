/**
 * So leitura: o esquema `amanna_chat` existe neste banco?
 *
 * A migracao 012 nao viaja com o deploy — codigo vai pela Vercel, view vai
 * pelo banco. Este script diz em que pe esta o banco apontado por
 * `DATABASE_URL`, antes de alguem perguntar por que a consulta do chat falha.
 *
 *   npx tsx ferramentas/dados/conferir-esquema-chat.mts
 */

// `@next/env` e CommonJS: o named export nao atravessa o ESM, e por isso o
// import e do modulo inteiro. Sem isto o script nao le o `.env.local`, e a
// mesma pegadinha ja custou tempo na carga dos CSVs.
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const { criarCliente, caDoAmbiente } =
  await import("../../src/acesso/postgres/cliente");

const url = process.env["DATABASE_URL"];
if (url === undefined || url.trim() === "") {
  throw new Error("DATABASE_URL nao configurada");
}
const ca = caDoAmbiente();
const cliente = criarCliente(url, ca === undefined ? {} : { ca });

try {
  const views = await cliente.consultar<{ table_name: string }>(
    `SELECT table_name FROM information_schema.views
     WHERE table_schema = 'amanna_chat' ORDER BY table_name`,
  );
  const [amanna] = await cliente.consultar<{ objetos: number }>(
    `SELECT COUNT(*)::int AS objetos FROM information_schema.tables
     WHERE table_schema = 'amanna'`,
  );

  console.log(`esquema amanna: ${String(amanna?.objetos ?? 0)} objetos`);
  console.log(`esquema amanna_chat: ${String(views.length)} views`);
  if (views.length === 0) {
    console.log(
      "\nA consulta do chat nao vai funcionar neste banco. Para criar as views:\n" +
        "  npm run dados:carregar -- --so-migrar",
    );
  } else {
    console.log(views.map((v) => v.table_name).join(", "));
  }
} finally {
  await cliente.encerrar();
}
