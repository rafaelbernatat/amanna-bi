/**
 * `npm run dados:ensaio -- [--so-migrar] [--pasta=<dir>] [--recarregar]`
 *
 * A carga inteira num Postgres em processo (PGlite), sem banco externo: aplica
 * a migração, carrega docs/dados/*.csv, roda as conferências do dicionário e
 * imprime o relatório. Persiste em `--pasta` (padrão: .ensaio/pglite, ignorado
 * pelo git) para as próximas execuções não recarregarem tudo; `--recarregar`
 * força a carga mesmo com a pasta preenchida.
 *
 * É o que prova, na máquina de quem desenvolve, que o SQL de D-DADOS está
 * certo antes de existir o projeto Supabase (H-65).
 */

import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { carregarBase } from "./carga.ts";
import { conferirBase, relatorioDeConferencia } from "./conferencia.ts";
import { criarClientePglite } from "./pglite.ts";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

function argumento(nome: string): string | undefined {
  const achado = process.argv.find((a) => a.startsWith(`--${nome}=`));
  return achado?.slice(nome.length + 3);
}

const pasta = resolve(RAIZ, argumento("pasta") ?? ".ensaio/pglite");
const jaExistia = existsSync(pasta);
mkdirSync(pasta, { recursive: true });

const soMigrar = process.argv.includes("--so-migrar");
const recarregar = process.argv.includes("--recarregar");
const inicio = Date.now();

const cliente = await criarClientePglite(pasta);
try {
  const carregar = !jaExistia || recarregar;
  const resultado = await carregarBase(cliente, {
    pastaDosCsvs: resolve(RAIZ, "docs", "dados"),
    pastaDoSql: resolve(RAIZ, "ferramentas", "dados", "sql"),
    soMigrar: soMigrar || !carregar,
    registrar: (m) => {
      console.log(m);
    },
  });
  if (!carregar && !soMigrar) {
    console.log(`base já carregada em ${pasta}; use --recarregar para refazer`);
  }
  if (!soMigrar) {
    console.log("\n" + relatorioDeConferencia(await conferirBase(cliente)));
  }
  const segundos = Math.round((Date.now() - inicio) / 1000);
  console.log(
    `\nensaio ${resultado.versao}: ${String(resultado.tabelas)} tabelas, ` +
      `${String(resultado.linhas)} linhas, ${String(segundos)} s, em ${pasta}`,
  );
} finally {
  await cliente.encerrar();
}
