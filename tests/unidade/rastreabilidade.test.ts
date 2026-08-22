import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A convencao de referencia do backlog (T-013).
 *
 * `P1` significava duas coisas: a decisao pendente P1 da secao 18 do PRD e o
 * principio de produto P1 da secao 2. Depois de T-013 o backlog escreve
 * `D-P1..D-P8` para decisao e `PR-1..PR-4` para principio. Estes testes existem
 * para que a convencao nao regrida em silencio na proxima tarefa que editar um
 * campo `PRD:`.
 */

/** Tarefa da Fase 0 que decide cada uma das 8 decisoes pendentes. */
const DECIDE: Readonly<Record<string, string>> = {
  "1": "T-003",
  "2": "T-007",
  "3": "T-008",
  "4": "T-009",
  "5": "T-010",
  "6": "T-011",
  "7": "T-012",
  "8": "T-002",
};

type Tarefa = { id: string; prd: string };

function lerTarefas(): Tarefa[] {
  const texto = readFileSync(join(process.cwd(), "TASKS.md"), "utf8");
  const tarefas: Tarefa[] = [];
  let atual: Tarefa | undefined;

  for (const linha of texto.split("\n")) {
    const cabecalho = /^- \[[ X~]\] \*\*(T-[\d.]+)\*\*/.exec(linha);
    if (cabecalho?.[1] !== undefined) {
      atual = { id: cabecalho[1], prd: "" };
      tarefas.push(atual);
      continue;
    }
    if (atual && linha.trimStart().startsWith("\u00b7 **PRD:**")) {
      atual.prd = linha.trim();
    }
  }
  return tarefas;
}

const TAREFAS = lerTarefas();

/** `P3` nu, mas nao o `P3` que faz parte de `D-P3`. */
const TOKEN_AMBIGUO = /(^|[^-A-Za-z])P[1-8]\b/;

describe("Convencao de referencia nos campos PRD: do backlog", () => {
  it("o backlog tem tarefas com campo PRD: para inspecionar", () => {
    expect(TAREFAS.length).toBeGreaterThan(200);
    expect(TAREFAS.filter((t) => t.prd !== "").length).toBe(TAREFAS.length);
  });

  it("nenhum campo PRD: usa P<n> sem prefixo", () => {
    const ambiguas = TAREFAS.filter((t) => TOKEN_AMBIGUO.test(t.prd)).map(
      (t) => `${t.id}: ${t.prd}`,
    );
    expect(ambiguas).toEqual([]);
  });

  it.each(Object.keys(DECIDE))(
    "D-P%s e decidida por exatamente uma tarefa e aplicada por ao menos uma",
    (numero) => {
      const tarefaQueDecide = DECIDE[numero];
      const marca = new RegExp(String.raw`\bD-P` + numero + String.raw`\b`);
      const citam = TAREFAS.filter((t) => marca.test(t.prd)).map((t) => t.id);

      expect(citam, `D-P${numero} nao e citada por ninguem`).toContain(
        tarefaQueDecide,
      );
      const aplicam = citam.filter((id) => id !== tarefaQueDecide);
      expect(
        aplicam.length,
        `D-P${numero} nao e aplicada por nenhuma tarefa`,
      ).toBeGreaterThan(0);
    },
  );

  it.each(["1", "2", "3", "4"])(
    "PR-%s e citado por ao menos uma tarefa",
    (numero) => {
      const marca = new RegExp(String.raw`\bPR-` + numero + String.raw`\b`);
      const citam = TAREFAS.filter((t) => marca.test(t.prd)).map((t) => t.id);
      expect(citam.length, `PR-${numero} nao e citado`).toBeGreaterThan(0);
    },
  );
});
