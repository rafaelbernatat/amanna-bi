/**
 * Grava a matriz de autorizacao expandida (T-173).
 *
 * Mesmo padrao do schema de painel: o arquivo e **derivado**, versionado, e o
 * `--check` reprova no CI se divergir. A razao e a mesma -- uma matriz de
 * acesso escrita a mao envelhece, e envelhece em silencio.
 *
 * O que este arquivo entrega que o codigo sozinho nao entrega: a matriz pode
 * ser lida e revisada **sem executar nada**, e uma mudanca de regra aparece
 * como diff numa revisao em vez de como comportamento novo em producao.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { format, resolveConfig } from "prettier";
import { createJiti } from "jiti";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DESTINO = resolve(RAIZ, "contratos", "autorizacao.json");

const jiti = createJiti(import.meta.url, {
  alias: {
    "@/seguranca": resolve(RAIZ, "src", "seguranca"),
    "@/semantica": resolve(RAIZ, "src", "semantica"),
    "@/apresentacao": resolve(RAIZ, "src", "apresentacao"),
    "@/acesso": resolve(RAIZ, "src", "acesso"),
  },
});

const { matrizExpandida, EXCECOES } = await jiti.import(
  resolve(RAIZ, "src", "seguranca", "autorizacao.ts"),
);

const linhas = matrizExpandida();

/* Agrupado por perfil: 355 linhas soltas ninguem revisa; 5 blocos, sim. */
const porPerfil = {};
for (const l of linhas) {
  porPerfil[l.perfil] ??= {};
  porPerfil[l.perfil][l.tela] ??= {};
  porPerfil[l.perfil][l.tela][l.painel] = l.acesso;
}

const documento = {
  origem: "src/seguranca/autorizacao.ts (T-173) — derivado, nao editar a mao",
  regra: "PRD secao 11: concessao por modulo; excecoes explicitas com motivo",
  excecoes: EXCECOES,
  totais: Object.fromEntries(
    Object.entries(porPerfil).map(([perfil, telas]) => [
      perfil,
      Object.values(telas).reduce(
        (n, paineis) =>
          n + Object.values(paineis).filter((a) => a !== "nenhum").length,
        0,
      ),
    ]),
  ),
  matriz: porPerfil,
};

const opcoes = await resolveConfig(DESTINO);
const gerado = await format(`${JSON.stringify(documento, null, 2)}\n`, {
  ...opcoes,
  filepath: DESTINO,
  parser: "json",
});

if (process.argv.includes("--check")) {
  let versionado;
  try {
    versionado = readFileSync(DESTINO, "utf8");
  } catch {
    console.error(
      "contratos/autorizacao.json nao existe. Rode 'npm run autorizacao'.",
    );
    process.exit(1);
  }
  if (versionado !== gerado) {
    console.error(
      "A matriz de autorizacao versionada divergiu das regras da secao 11.\n" +
        "Rode 'npm run autorizacao' e inclua contratos/autorizacao.json no commit.\n" +
        "Quem enxerga o que precisa aparecer em revisao, nao em producao.",
    );
    process.exit(1);
  }
  console.log(`matriz em dia · ${linhas.length} pares perfil x painel`);
} else {
  writeFileSync(DESTINO, gerado, "utf8");
  console.log(
    `contratos/autorizacao.json gravado · ${linhas.length} pares perfil x painel`,
  );
}
