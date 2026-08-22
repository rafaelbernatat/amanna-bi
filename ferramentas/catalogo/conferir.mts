/**
 * Confere o catálogo de métricas na build (T-112).
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
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
console.log(`catálogo em ordem · ${total} métrica${total === 1 ? "" : "s"}`);
