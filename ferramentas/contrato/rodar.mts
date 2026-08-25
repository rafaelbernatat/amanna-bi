/**
 * O comando da suíte de contrato (T-121).
 *
 *   npx tsx ferramentas/contrato/rodar.mts --source=fixtures
 *   npx tsx ferramentas/contrato/rodar.mts --source=warehouse
 *
 * O RF-21 é o motivo de o comando existir com essa forma: **a suíte passa
 * idêntica nos dois modos**. Trocar a fonte não muda o arquivo de casos, não
 * muda a matriz e não muda as regras — muda só quem responde às quatro portas.
 * Se a suíte precisasse de um caso a mais no warehouse, ela deixaria de provar
 * o que existe para provar.
 *
 * ## O que acontece hoje com `--source=warehouse`
 *
 * O adaptador de warehouse é da Fase 2 e ainda não está registrado. O comando
 * **aceita** o modo, pede a fonte pela fábrica, e falha com `FonteInvalida`
 * dizendo "modo válido, mas sem implementação registrada".
 *
 * Isso é diferente de recusar o flag: o caminho está montado e é o mesmo. No
 * dia em que o adaptador entrar, nada aqui muda — e é exatamente essa a
 * promessa do RF-21 que a Fase 2 vai cobrar.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";

import { dimensoesProvisorias } from "../../src/acesso/dimensoes-provisorias.ts";
import {
  FONTES,
  FonteInvalida,
  obterFonteDeDados,
} from "../../src/acesso/fabrica.ts";
import "../../src/acesso/registrar.ts";
import "../../src/acesso/contrato/registrar.ts";
import { matrizDeRecortes } from "../../src/semantica/recortes.ts";
import {
  relatorioEmTexto,
  rodarSuite,
  SuiteSemRegra,
} from "../../src/acesso/contrato/suite.ts";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CASOS = resolve(RAIZ, "tests", "contrato", "casos.yaml");
const MATRIZ = resolve(RAIZ, "tests", "contrato", "matriz-recortes.yaml");

/* ------------------------------------------------------------------ *
 * Os argumentos
 * ------------------------------------------------------------------ */

function lerFonteDoArgumento(): string {
  const arg = process.argv.find((a) => a.startsWith("--source="));
  if (arg === undefined) {
    console.error(
      `Falta --source. Modos: ${FONTES.join(", ")}.\n\n` +
        "O flag é obrigatório de propósito: um padrão silencioso faria a suíte\n" +
        "rodar em fixtures quando alguém quis warehouse, e passar.",
    );
    process.exit(1);
  }
  const fonte = arg.slice("--source=".length);
  if (!FONTES.some((f) => f === fonte)) {
    console.error(`Modo '${fonte}' não existe. Modos: ${FONTES.join(", ")}.`);
    process.exit(1);
  }
  return fonte;
}

/* ------------------------------------------------------------------ *
 * A matriz, lida do arquivo assinado
 * ------------------------------------------------------------------ */

/**
 * Os recortes que a suíte roda.
 *
 * Vêm do **arquivo**, e não da função que o gerou. A diferença importa: o
 * arquivo é o que alguém assina (H-05), e rodar direto da função faria a
 * assinatura descrever uma cobertura e a execução usar outra.
 *
 * Um teste confere que os dois concordam; aqui, o arquivo manda.
 */
function recortesDaMatriz(): ReturnType<typeof matrizDeRecortes> {
  const documento: unknown = parse(readFileSync(MATRIZ, "utf8"));
  const bruto = (documento as { recortes?: unknown }).recortes;
  if (!Array.isArray(bruto)) {
    console.error(
      "tests/contrato/matriz-recortes.yaml não tem lista de recortes.\n" +
        "Rode 'npm run matriz'.",
    );
    process.exit(1);
  }

  return bruto.filter(
    (r: { cobertura?: string }) => r.cobertura !== "amostrada",
  ) as ReturnType<typeof matrizDeRecortes>;
}

/* ------------------------------------------------------------------ *
 * A execução
 * ------------------------------------------------------------------ */

const fonteEscolhida = lerFonteDoArgumento();

/*
 * O arquivo de casos é lido antes de qualquer coisa, e é o **mesmo** nos dois
 * modos. Ler aqui, e não dentro de cada regra, é o que garante isso: uma regra
 * que carregasse os próprios casos poderia carregar casos diferentes por fonte,
 * e o RF-21 deixaria de ser verificável.
 */
let casos: unknown;
try {
  casos = parse(readFileSync(CASOS, "utf8"));
} catch {
  console.error(
    "tests/contrato/casos.yaml não existe ou não é YAML válido.\n" +
      "É o arquivo que as duas fontes compartilham (RF-21).",
  );
  process.exit(1);
}

const quantosCasos = Array.isArray((casos as { casos?: unknown }).casos)
  ? ((casos as { casos: unknown[] }).casos.length ?? 0)
  : 0;

const matriz = recortesDaMatriz();
const ano = dimensoesProvisorias().ano?.[0] ?? "";

console.log(
  `suíte de contrato · ${fonteEscolhida} · ${String(matriz.length)} recortes · ` +
    `${String(quantosCasos)} casos`,
);

/*
 * Erro esperado vira mensagem; erro inesperado vira pilha.
 *
 * Fonte sem implementação e suíte sem regra são estados PREVISTOS deste
 * comando hoje — um porque o warehouse é da Fase 2, outro porque as regras
 * chegam com T-122 e T-159. Despejar pilha de Node num estado previsto faz
 * quem roda achar que quebrou algo, e o próximo passo vira depurar em vez de
 * ler.
 */
try {
  const fonte = await obterFonteDeDados({ DATA_SOURCE: fonteEscolhida });
  const relatorio = await rodarSuite(fonte, fonteEscolhida, matriz, ano);
  console.log(relatorioEmTexto(relatorio));
  if (relatorio.falhas.length > 0) process.exit(1);
} catch (erro) {
  const previsto =
    erro instanceof FonteInvalida || erro instanceof SuiteSemRegra;
  if (!previsto) throw erro;

  console.error("");
  console.error(erro instanceof Error ? erro.message : String(erro));
  if (erro instanceof FonteInvalida) {
    console.error("");
    console.error(
      "O adaptador de warehouse é da Fase 2. O caminho já é o mesmo: no dia",
    );
    console.error(
      "em que ele for registrado, nada neste comando muda — que é a promessa",
    );
    console.error("do RF-21 que a Fase 2 vai cobrar.");
  }
  process.exit(1);
}

/** Só para o teste: a matriz que o comando usaria. */
export { matrizDeRecortes };
