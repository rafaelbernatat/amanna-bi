/**
 * A fórmula é obrigatória e não tem como ser desligada (T-109).
 *
 * Achado 10 do Anexo D: no protótipo, `mostrarMemoria === false` trocava a
 * fórmula por `''` e **nada reclamava** — o tipo era `string`, e string vazia é
 * uma string. O painel continuava na tela, sem a linha que diz como chegou ao
 * número, e o princípio PR-3 virava intenção.
 *
 * Três travas, em camadas diferentes:
 *
 * 1. **tipo** — `Formula` é marcada, e a marca só sai de `formula()`, que
 *    recusa vazio. Não existe literal que satisfaça o tipo.
 * 2. **contrato publicado** — o JSON Schema traz `minLength: 1`, porque a
 *    marca de tipo some na serialização e não diria nada a um consumidor fora
 *    do TypeScript.
 * 3. **repositório** — nenhuma chave capaz de desligar a fórmula existe no
 *    código do produto.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

import {
  formula,
  FormulaVazia,
  formulaValida,
  type Formula,
} from "@/semantica/painel";
import {
  QUANTIDADE_DE_PAINEIS,
  REGISTRO_DE_PAINEIS,
} from "@/semantica/paineis";

const RAIZ = process.cwd();

describe("o construtor de fórmula", () => {
  it("aceita texto de verdade", () => {
    const f: Formula = formula("desvio = realizado - orcado");
    expect(f).toBe("desvio = realizado - orcado");
  });

  it("recusa vazio, espaço e só quebra de linha", () => {
    for (const vazia of ["", " ", "   ", "\n", "\t "]) {
      expect(() => formula(vazia, "orc-desvio")).toThrowError(FormulaVazia);
    }
  });

  it("a mensagem nomeia o painel, porque quem depura precisa saber qual", () => {
    expect(() => formula("", "fin-dre")).toThrowError(/fin-dre/);
  });

  it("formulaValida concorda com o construtor", () => {
    // Duas portas que discordassem dariam um caminho em que `formulaValida`
    // diz sim e `formula()` lança — e alguém trataria isso com try/catch mudo.
    for (const t of ["", " ", "\n", null, undefined, 0, {}]) {
      expect(formulaValida(t)).toBe(false);
    }
    expect(formulaValida("x = y")).toBe(true);
  });
});

describe("o contrato publicado também exige", () => {
  const schema = JSON.parse(
    readFileSync(join(RAIZ, "contratos", "painel.schema.json"), "utf8"),
  ) as { definitions: Record<string, { minLength?: number }> };

  it("Formula tem minLength 1 no JSON Schema", () => {
    // A marca de tipo some na serialização. Sem esta linha, a garantia valeria
    // só de um lado da fronteira.
    expect(schema.definitions["Formula"]?.minLength).toBe(1);
  });

  it("toda variante exige `formula`", () => {
    const defs = schema.definitions as unknown as Record<
      string,
      { required?: string[]; anyOf?: { $ref: string }[] }
    >;
    const uniao = defs["PanelResponse"]?.anyOf ?? [];
    expect(uniao.length).toBe(12);
    for (const membro of uniao) {
      const nome = membro.$ref.split("/").pop() ?? "";
      expect(defs[nome]?.required).toContain("formula");
    }
  });
});

describe("os 71 painéis", () => {
  /**
   * O aceite pede enumerar os 71 e falhar se algum derivado vier sem fórmula.
   *
   * A fórmula de cada painel mora no catálogo (seção 9.4), não no registro —
   * repeti-la nos dois criaria duas fontes para a mesma definição. O que dá
   * para provar aqui, e que é a parte estrutural do aceite, é que **não existe
   * caminho** por onde um painel chegue à tela sem fórmula: o tipo do envelope
   * não aceita, e o schema publicado não aceita.
   *
   * A conferência painel a painel contra fórmulas reais entra quando o catálogo
   * tiver as 36 entradas (H-08) e o adaptador existir.
   */
  it("são 71, e o registro segue conferido contra o Anexo A", () => {
    expect(QUANTIDADE_DE_PAINEIS).toBe(71);
    expect(REGISTRO_DE_PAINEIS.length).toBe(71);
  });

  it("nenhum deles poderia ser servido sem fórmula", () => {
    // A prova estrutural: montar um envelope sem fórmula não compila, e com
    // fórmula vazia não passa pelo construtor. Aqui se exercita o segundo.
    for (const p of REGISTRO_DE_PAINEIS) {
      expect(() => formula("", p.id)).toThrowError(FormulaVazia);
    }
  });
});

/* ------------------------------------------------------------------ *
 * A chave que desliga a fórmula
 * ------------------------------------------------------------------ */

function arquivosDe(pasta: string): readonly string[] {
  const saida: string[] = [];
  for (const nome of readdirSync(pasta)) {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) saida.push(...arquivosDe(caminho));
    else saida.push(caminho);
  }
  return saida;
}

function rel(c: string): string {
  return relative(RAIZ, c).split(sep).join("/");
}

/**
 * O protótipo é a **evidência** do achado 10, e por isso não é editado.
 *
 * `public/design/Dashboard BI v2.dc.html` é o artefato entregue na Fase 0 e a
 * referência contra a qual o porte das primitivas é conferido (T-164, T-165).
 * Apagar `mostrarMemoria` de lá faria três coisas ruins de uma vez: mudaria a
 * linha de base do porte, mexeria à mão num arquivo com metadados de
 * ferramenta de design, e apagaria a prova de que o achado existia.
 *
 * A exceção é nominal e única. Ver H-47.
 */
const EXCECAO = "public/design/Dashboard BI v2.dc.html";

describe("nenhuma chave desliga a fórmula", () => {
  const CODIGO = [
    ...arquivosDe(join(RAIZ, "src")),
    ...arquivosDe(join(RAIZ, "tests")),
    ...arquivosDe(join(RAIZ, "ferramentas")),
    ...arquivosDe(join(RAIZ, "contratos")),
  ];

  it("a varredura enxerga o código — senão não prova nada", () => {
    expect(CODIGO.length).toBeGreaterThan(30);
  });

  it("`mostrarMemoria` não existe no código do produto", () => {
    const ocorrencias = CODIGO.filter((c) =>
      /mostrarMemoria/.test(readFileSync(c, "utf8")),
    )
      .map(rel)
      // Este próprio arquivo cita o nome ao explicar por que ele não existe.
      .filter((c) => !c.endsWith("formula-obrigatoria.test.ts"));

    expect(ocorrencias).toEqual([]);
  });

  it("nenhuma outra chave com a mesma função foi inventada", () => {
    // A propriedade sairia e voltaria com outro nome se ninguém olhasse. Os
    // padrões abaixo cobrem as formas prováveis de a mesma ideia reaparecer.
    const padroes = [
      /\bmostrarFormula\b/,
      /\bocultarFormula\b/,
      /\besconderFormula\b/,
      /\bexibirMemoria\b/,
      /\bshowFormula\b/,
    ];
    const infratores: string[] = [];
    for (const c of CODIGO) {
      if (rel(c).endsWith("formula-obrigatoria.test.ts")) continue;
      const texto = readFileSync(c, "utf8");
      for (const p of padroes) {
        if (p.test(texto)) infratores.push(`${rel(c)} ← ${p}`);
      }
    }
    expect(infratores).toEqual([]);
  });

  it("o protótipo continua trazendo a chave, e isso é deliberado", () => {
    /*
     * A exceção precisa ser verificada, não presumida.
     *
     * Se um dia o protótipo for regerado sem `mostrarMemoria`, este teste
     * falha — e a exceção sai junto, em vez de ficar para trás como um
     * comentário descrevendo um mundo que mudou.
     */
    const prototipo = readFileSync(join(RAIZ, EXCECAO), "utf8");
    expect(prototipo).toContain("mostrarMemoria");
  });
});
