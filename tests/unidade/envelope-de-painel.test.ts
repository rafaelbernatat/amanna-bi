/**
 * O envelope de painel nas doze formas (T-102).
 *
 * O que estes testes protegem, e por que cada um existe:
 *
 * 1. **As doze formas do Anexo A.1 estão cobertas** — nem onze, nem treze. O
 *    vocabulário visual é fechado por decisão de produto; sem contagem, ele
 *    fecha só no texto do PRD.
 * 2. **Cada forma tem um exemplo que o schema aceita.** Os exemplos são JSON em
 *    disco, e não literais TypeScript, de propósito: um literal seria conferido
 *    pelo compilador antes de chegar no schema, e o teste passaria mesmo com o
 *    schema quebrado. Em JSON, o único juiz é o schema — que é o que qualquer
 *    consumidor fora do TypeScript vai usar.
 * 3. **Nenhuma forma pode omitir `unit`, `formula` ou `asOf`** — e o schema de
 *    fato recusa quando falta, o que é o que separa este teste de um vácuo.
 */

import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import Ajv from "ajv";
import { describe, expect, it } from "vitest";

import { FORMAS, formaValida, QUANTIDADE_DE_FORMAS } from "@/semantica/painel";

const RAIZ = resolve(__dirname, "..", "..");
const CAMINHO_SCHEMA = resolve(RAIZ, "contratos", "painel.schema.json");
const PASTA_EXEMPLOS = resolve(RAIZ, "contratos", "exemplos");

const schema: Record<string, unknown> = JSON.parse(
  readFileSync(CAMINHO_SCHEMA, "utf8"),
) as Record<string, unknown>;

// `strict: false` porque o gerador emite `description` em todo lugar, e o modo
// estrito do Ajv reclama de vocabulário que não afeta validação.
const valida = new Ajv({ allErrors: true, strict: false }).compile(schema);

function lerExemplo(nome: string): unknown {
  return JSON.parse(
    readFileSync(resolve(PASTA_EXEMPLOS, `${nome}.json`), "utf8"),
  );
}

describe("o vocabulário visual do Anexo A.1", () => {
  it("tem exatamente doze formas, contadas e não escritas", () => {
    expect(QUANTIDADE_DE_FORMAS).toBe(12);
    expect(new Set(FORMAS).size).toBe(FORMAS.length);
  });

  it("recusa forma fora do vocabulário", () => {
    expect(formaValida("barras")).toBe(true);
    expect(formaValida("pizza")).toBe(false);
    expect(formaValida("BARRAS")).toBe(false);
    expect(formaValida("")).toBe(false);
  });

  it("tem uma variante no schema para cada forma, e nenhuma a mais", () => {
    const definicoes = schema["definitions"] as Record<
      string,
      { properties?: { forma?: { const?: string } } }
    >;
    const uniao = (
      definicoes["PanelResponse"] as unknown as {
        anyOf: readonly { $ref: string }[];
      }
    ).anyOf;

    const formasNoSchema = uniao.map((membro) => {
      const nome = membro.$ref.split("/").pop() ?? "";
      const variante = definicoes[nome];
      return variante?.properties?.forma?.const;
    });

    expect([...formasNoSchema].sort()).toEqual([...FORMAS].sort());
  });
});

describe("os exemplos do contrato", () => {
  it("são um por forma, sem sobra nem falta", () => {
    const arquivos = readdirSync(PASTA_EXEMPLOS)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""));

    expect(arquivos.sort()).toEqual([...FORMAS].sort());
  });

  it.each(FORMAS)("%s: o exemplo é aceito pelo schema", (forma) => {
    const exemplo = lerExemplo(forma);
    const ok = valida(exemplo);
    // Sem esta linha o erro seria só "esperava true", e achar o campo errado
    // num envelope de trinta linhas vira caça ao tesouro.
    expect(valida.errors ?? [], JSON.stringify(valida.errors, null, 2)).toEqual(
      [],
    );
    expect(ok).toBe(true);
  });

  it.each(FORMAS)("%s: o exemplo declara a própria forma", (forma) => {
    expect((lerExemplo(forma) as { forma: string }).forma).toBe(forma);
  });

  it.each(FORMAS)(
    "%s: o exemplo traz unit, formula e asOf preenchidos",
    (forma) => {
      const e = lerExemplo(forma) as Record<string, unknown>;
      expect(e["unit"]).toBeTypeOf("string");
      expect(e["formula"]).toBeTypeOf("string");
      expect(String(e["formula"]).length).toBeGreaterThan(0);
      expect(e["asOf"]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    },
  );
});

describe("o schema reprova envelope malformado", () => {
  /**
   * A parte que prova que o teste acima não é vácuo.
   *
   * Um schema com `additionalProperties: false` e `required` completo só vale
   * alguma coisa se de fato recusar. Cada mutação abaixo é um erro que já
   * apareceu em painel de BI de verdade.
   */
  const base = lerExemplo("barras") as Record<string, unknown>;

  const mutacoes: readonly [string, () => unknown][] = [
    ["sem unit", () => ({ ...base, unit: undefined })],
    ["sem formula", () => ({ ...base, formula: undefined })],
    ["sem asOf", () => ({ ...base, asOf: undefined })],
    ["sem forma", () => ({ ...base, forma: undefined })],
    ["forma inexistente", () => ({ ...base, forma: "pizza" })],
    ["unidade fora do enum", () => ({ ...base, unit: "reais" })],
    ["total como texto formatado", () => ({ ...base, total: "R$ 56 mi" })],
    [
      "cor no envelope",
      // O hex é o objeto do teste: prova que o envelope recusa cor, que é
      // decisão de tema (T-124) e não de dado. A regra está certa em apontá-lo
      // — a dispensa é nominal e vale só para esta linha.
      // eslint-disable-next-line no-restricted-syntax -- ver acima
      () => ({ ...base, color: "#c0392b" }),
    ],
    [
      "série sem papel",
      () => ({ ...base, series: [{ name: "Desvio", values: [1] }] }),
    ],
    [
      "carga de outra forma",
      () => ({ ...base, fatias: [{ nome: "A", valor: 1 }] }),
    ],
  ];

  it.each(mutacoes)("recusa: %s", (_nome, construir) => {
    const bruto = construir() as Record<string, unknown>;
    // `undefined` não sobrevive a JSON — é assim que um campo some de verdade
    // quando um adaptador esquece de preenchê-lo.
    const comoChegaria: unknown = JSON.parse(JSON.stringify(bruto));
    expect(valida(comoChegaria)).toBe(false);
  });

  it("aceita o envelope intacto — senão as recusas acima não provariam nada", () => {
    expect(valida(JSON.parse(JSON.stringify(base)))).toBe(true);
  });
});

/**
 * A conferência "o schema versionado bate com os tipos" **não** mora aqui.
 *
 * Gerar o schema custa ~13s: percorre o programa TypeScript inteiro. Rodar isso
 * a cada `npm test` multiplicaria por quinze uma suíte de um segundo, para
 * conferir o que já é conferido em dois lugares mais baratos:
 *
 * - no commit, pelo lint-staged, quando `src/semantica/painel.ts` muda;
 * - no CI, no job `build`, que começa por `npm run schema:check`.
 *
 * O que sobra aqui é o que é barato e vale a cada rodada: que o schema
 * versionado cobre as doze formas e recusa envelope malformado.
 */
