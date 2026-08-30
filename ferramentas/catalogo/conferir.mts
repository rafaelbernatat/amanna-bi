/**
 * Confere o catálogo de métricas na build, e o derruba em TypeScript (T-112,
 * T-120).
 *
 * O aceite é explícito: "catálogo inválido quebra o build, não o runtime".
 * Catálogo inválido em produção é tela que sobe e mente. Na build, é uma
 * mensagem para quem está editando o arquivo, no momento em que está editando.
 *
 *   npx tsx ferramentas/catalogo/conferir.mts
 *
 * Roda no `npm run build`, junto da conferência do schema de painel. As duas
 * ficam antes do `next build` de propósito: falhar em dois segundos é melhor
 * que falhar depois de compilar treze rotas.
 *
 * A validação em si mora em `src/semantica/catalogo.ts`, e é a **mesma** que o
 * runtime usaria. Duas implementações — uma para a build, outra para o produto
 * — divergiriam, e a que divergisse seria justamente a que não roda no CI.
 *
 * ## Por que também gera
 *
 * `getMetric` precisa do catálogo **em execução** — unidade, fórmula, sentido e
 * agregação de cada métrica saem de lá. Ler o YAML em runtime funcionaria em
 * desenvolvimento e falharia em produção, onde o arquivo não entra no pacote.
 *
 * Então o YAML vira um módulo TypeScript, do mesmo jeito que
 * `contratos/painel.schema.json` vira schema: **derivado, nunca escrito à
 * mão**. O modo `--check` compara byte a byte e reprova se o gerado estiver
 * atrasado — é ele que impede alguém editar o YAML, esquecer de regerar, e o
 * produto continuar servindo a definição antiga.
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { format, resolveConfig } from "prettier";
import { parse } from "yaml";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CAMINHO = resolve(RAIZ, "catalogo", "metricas.yaml");

import { conferirCatalogo } from "../../src/semantica/catalogo.ts";

let texto;
try {
  texto = readFileSync(CAMINHO, "utf8");
} catch {
  console.error(
    `catalogo/metricas.yaml não existe. O produto não sobe sem catálogo (seção 9.4).`,
  );
  process.exit(1);
}

let documento;
try {
  documento = parse(texto);
} catch (e) {
  console.error(`catalogo/metricas.yaml não é YAML válido:\n  ${e.message}`);
  process.exit(1);
}

const problemas = conferirCatalogo(documento);

if (problemas.length > 0) {
  console.error("O catálogo de métricas não passou na conferência:\n");
  for (const p of problemas) {
    console.error(`  · ${p.metrica}.${p.campo}: ${p.problema}`);
  }
  console.error(
    "\nA seção 9.4 do PRD trata o catálogo como decisão registrada de " +
      "Controladoria e RH. Entrada incompleta é decisão que ninguém tomou.",
  );
  process.exit(1);
}

const total = Object.keys(documento).length;

/* ------------------------------------------------------------------ *
 * O módulo derivado
 * ------------------------------------------------------------------ */

const DESTINO = resolve(RAIZ, "src", "semantica", "catalogo-gerado.ts");

const CABECALHO = `/**
 * O catálogo de métricas, em TypeScript (T-120).
 *
 * **GERADO. Não edite.** A fonte é \`catalogo/metricas.yaml\`, que é o arquivo
 * que Controladoria e RH revisam (seção 9.4). Para mudar uma métrica, mude o
 * YAML e rode \`npm run catalogo\`.
 *
 * Existe porque \`getMetric\` precisa do catálogo em execução, e o YAML não
 * entra no pacote de produção. \`npm run catalogo:check\` roda na build e
 * reprova se este arquivo estiver atrasado em relação ao YAML — sem isso,
 * editar a definição de uma métrica e esquecer de regerar deixaria o produto
 * servindo a definição antiga, em silêncio.
 */

import type { Metrica } from "@/semantica/catalogo";

export const CATALOGO_GERADO: Readonly<Record<string, Metrica>> =`;

const ordenadas = Object.keys(documento).sort();
const corpo: Record<string, unknown> = {};
for (const id of ordenadas) {
  const m = documento[id];
  corpo[id] = {
    id,
    rotulo: m.rotulo,
    fonte: m.fonte,
    formula: m.formula,
    unidade: m.unidade,
    agg: m.agg,
    sentido: m.sentido,
    meta: m.meta ?? null,
    grao_minimo: m.grao_minimo,
    sinonimos: m.sinonimos,
    decisao: m.decisao ?? null,
  };
}

/**
 * A identidade do catálogo que gerou este arquivo (T-149).
 *
 * Digest do conteúdo normalizado — as mesmas 68 métricas com os mesmos campos
 * dão sempre a mesma versão, e mudar uma fórmula muda a versão.
 *
 * Do conteúdo, e não do texto do YAML: comentário reescrito e linha em branco
 * a mais não são mudança de definição, e uma versão que mudasse com eles
 * ensinaria a ignorar a mudança de versão.
 */
const VERSAO = createHash("sha256")
  .update(JSON.stringify(corpo))
  .digest("hex")
  .slice(0, 12);

const bruto = `${CABECALHO} ${JSON.stringify(corpo, null, 2)};

/** Quantas métricas o catálogo tem. Contado, nunca escrito. */
export const QUANTIDADE_DE_METRICAS = ${String(ordenadas.length)};

/**
 * Qual catálogo produziu um número (T-149).
 *
 * Viaja em \`getMeta().versaoDoCatalogo\`, para que "o número mudou" e "a
 * definição mudou" deixem de ser indistinguíveis. T-155 troca isto por versão
 * semântica com changelog; até lá é a identidade do conteúdo.
 */
export const VERSAO_DO_CATALOGO = "${VERSAO}";
`;

const config = await resolveConfig(DESTINO);
const gerado = await format(bruto, { ...config, filepath: DESTINO });

const conferindo = process.argv.includes("--check");

if (conferindo) {
  let atual = "";
  try {
    atual = readFileSync(DESTINO, "utf8");
  } catch {
    atual = "";
  }
  if (atual !== gerado) {
    console.error(
      "src/semantica/catalogo-gerado.ts está atrasado em relação ao YAML.\n" +
        "Rode 'npm run catalogo' e inclua o arquivo no commit.\n\n" +
        "Sem esta conferência, editar a definição de uma métrica e esquecer de\n" +
        "regerar deixaria o produto servindo a definição antiga, em silêncio.",
    );
    process.exit(1);
  }
} else {
  writeFileSync(DESTINO, gerado);
}

console.log(
  `catálogo em ordem · ${total} métrica${total === 1 ? "" : "s"}` +
    (conferindo ? " · módulo derivado em dia" : " · módulo derivado gravado"),
);
