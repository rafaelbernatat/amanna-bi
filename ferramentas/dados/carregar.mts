/**
 * `npm run dados:carregar -- [--so-migrar] [--so=tabela,tabela] [--versao=...]`
 *
 * Carrega docs/dados/*.csv no Postgres de DATABASE_URL_CARGA (ou, na falta
 * dela, DATABASE_URL) e registra a rodada em amanna.carga. Ver carga.ts.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { criarCliente } from "../../src/acesso/postgres/cliente.ts";
import { carregarBase } from "./carga.ts";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

function argumento(nome: string): string | undefined {
  const achado = process.argv.find((a) => a.startsWith(`--${nome}=`));
  return achado?.slice(nome.length + 3);
}

const url = process.env["DATABASE_URL_CARGA"] ?? process.env["DATABASE_URL"];
if (url === undefined || url.trim() === "") {
  console.error(
    "Falta DATABASE_URL_CARGA (ou DATABASE_URL). A carga precisa de uma conexão " +
      "em modo sessão ou transação; nenhuma das duas está no ambiente.",
  );
  process.exit(1);
}

const cliente = criarCliente(url, { max: 1 });
const inicio = Date.now();

try {
  const somente = argumento("so");
  const versao = argumento("versao");
  const resultado = await carregarBase(cliente, {
    pastaDosCsvs: resolve(RAIZ, "docs", "dados"),
    pastaDoSql: resolve(RAIZ, "ferramentas", "dados", "sql"),
    soMigrar: process.argv.includes("--so-migrar"),
    ...(somente === undefined ? {} : { somente: somente.split(",") }),
    ...(versao === undefined ? {} : { versao }),
    registrar: (m) => {
      console.log(m);
    },
  });
  const segundos = Math.round((Date.now() - inicio) / 1000);
  console.log(
    `\ncarga ${resultado.versao}: ${String(resultado.tabelas)} tabelas, ` +
      `${String(resultado.linhas)} linhas, ${String(segundos)} s`,
  );
} finally {
  await cliente.encerrar();
}
