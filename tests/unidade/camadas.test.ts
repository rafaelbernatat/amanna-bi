import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * As tres camadas da secao 8.1 do PRD existem e continuam existindo.
 *
 * E o caso mais barato que prova o runner de verdade: se alguem apagar ou
 * renomear uma camada, o comando fica vermelho.
 */
const RAIZ = process.cwd();

const CAMADAS = [
  { pasta: "src/apresentacao", papel: "telas, paineis, filtros e chat" },
  { pasta: "src/semantica", papel: "catalogo de metricas" },
  { pasta: "src/acesso", papel: "adaptador de dados" },
] as const;

describe("As tres camadas da secao 8.1 do PRD", () => {
  it.each(CAMADAS)("a camada $pasta existe ($papel)", ({ pasta }) => {
    const caminho = join(RAIZ, pasta);
    expect(existsSync(caminho), `${pasta} nao existe`).toBe(true);
    expect(statSync(caminho).isDirectory(), `${pasta} nao e pasta`).toBe(true);
  });

  it("cada camada declara sua carta de responsabilidade", () => {
    for (const { pasta } of CAMADAS) {
      expect(existsSync(join(RAIZ, pasta, "README.md")), pasta).toBe(true);
    }
  });
});
