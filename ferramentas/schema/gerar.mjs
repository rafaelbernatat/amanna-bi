/**
 * Gera o JSON Schema do envelope de painel a partir dos tipos (T-102).
 *
 * O schema é **derivado**, nunca escrito à mão. Schema escrito à mão é schema
 * que envelhece: alguém acrescenta um campo ao tipo, esquece o schema, e o
 * contrato publicado passa a descrever um produto que não existe mais. Aqui a
 * fonte é `src/semantica/painel.ts` e o arquivo versionado é consequência.
 *
 *   node ferramentas/schema/gerar.mjs           grava contratos/painel.schema.json
 *   node ferramentas/schema/gerar.mjs --check   reprova se o versionado divergir
 *
 * O modo `--check` roda no CI. É ele que faz a promessa valer: mudar o tipo sem
 * regerar o schema quebra a build, com a instrução de como consertar.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { format, resolveConfig } from "prettier";
import { createGenerator } from "ts-json-schema-generator";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ORIGEM = resolve(RAIZ, "src", "semantica", "painel.ts");
const DESTINO = resolve(RAIZ, "contratos", "painel.schema.json");
const TIPO = "PanelResponse";

/** Os três campos que nenhuma forma pode omitir (PR-3 e seção 10.2). */
const OBRIGATORIOS_EM_TODA_FORMA = ["unit", "formula", "asOf"];

/**
 * Gera, e formata com o Prettier do projeto.
 *
 * A formatação não é enfeite: o `--check` compara byte a byte, e o `npm run
 * format` do repositório passa por `contratos/`. Sem esta passagem os dois
 * discordariam do mesmo arquivo — o gerador gravaria de um jeito, o Prettier
 * reescreveria de outro, e o CI reprovaria uma árvore que ninguém mexeu.
 */
async function gerar() {
  const schema = createGenerator({
    path: ORIGEM,
    tsconfig: resolve(RAIZ, "tsconfig.json"),
    type: TIPO,
    // O typecheck completo já roda em `npm run typecheck`; repeti-lo aqui
    // dobraria o tempo da build para conferir a mesma coisa.
    skipTypeCheck: true,
    additionalProperties: false,
  }).createSchema(TIPO);

  const bruto = `${JSON.stringify(schema, null, 2)}\n`;
  const opcoes = await resolveConfig(DESTINO);
  return format(bruto, { ...opcoes, filepath: DESTINO, parser: "json" });
}

/**
 * A guarda que o schema sozinho não daria.
 *
 * O gerador é fiel aos tipos, mas fidelidade não é o mesmo que correção: se
 * alguém tornar `formula` opcional no tipo, o schema gerado continuará válido e
 * continuará batendo com o versionado. Esta conferência é sobre o **conteúdo**,
 * e é ela que sustenta a parte do aceite que diz "ou se faltar unit, formula ou
 * asOf".
 */
function conferirCamposObrigatorios(texto) {
  const schema = JSON.parse(texto);
  const uniao = schema.definitions?.[TIPO]?.anyOf;
  if (!Array.isArray(uniao) || uniao.length === 0) {
    return [`${TIPO} não é uma união de variantes no schema gerado.`];
  }

  const problemas = [];
  for (const membro of uniao) {
    const nome = String(membro.$ref ?? "")
      .split("/")
      .pop();
    const variante = nome ? schema.definitions?.[nome] : undefined;
    if (variante === undefined) {
      problemas.push(`variante '${nome}' referenciada mas não definida.`);
      continue;
    }
    const exigidos = variante.required ?? [];
    for (const campo of [...OBRIGATORIOS_EM_TODA_FORMA, "forma"]) {
      if (!exigidos.includes(campo)) {
        problemas.push(`${nome} não exige '${campo}'.`);
      }
    }
  }
  return problemas;
}

const gerado = await gerar();

const problemas = conferirCamposObrigatorios(gerado);
if (problemas.length > 0) {
  console.error("O envelope de painel perdeu um campo obrigatório:\n");
  for (const p of problemas) console.error(`  · ${p}`);
  console.error(
    "\nTodo painel declara unidade, fórmula e data de fechamento (PR-3, seção 10.2).",
  );
  process.exit(1);
}

if (process.argv.includes("--check")) {
  let versionado;
  try {
    versionado = readFileSync(DESTINO, "utf8");
  } catch {
    console.error(
      `contratos/painel.schema.json não existe. Rode 'npm run schema' e versione o arquivo.`,
    );
    process.exit(1);
  }
  if (versionado !== gerado) {
    console.error(
      "O schema versionado divergiu dos tipos de src/semantica/painel.ts.\n" +
        "Rode 'npm run schema' e inclua contratos/painel.schema.json no commit.\n" +
        "O schema é o contrato publicado: divergir dele é publicar um produto que não existe.",
    );
    process.exit(1);
  }
  console.log(
    `schema em dia · ${JSON.parse(gerado).definitions[TIPO].anyOf.length} formas`,
  );
} else {
  writeFileSync(DESTINO, gerado, "utf8");
  console.log(
    `contratos/painel.schema.json gravado · ${JSON.parse(gerado).definitions[TIPO].anyOf.length} formas`,
  );
}
