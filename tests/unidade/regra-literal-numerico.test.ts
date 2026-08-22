import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

// @ts-expect-error — plugin local em .mjs, sem tipos declarados.
import painel from "../../ferramentas/eslint/sem-literal-numerico.mjs";

/**
 * A regra de AST de T-141.
 *
 * O achado 5 do Anexo D lista os KPIs que o protótipo escreveu à mão. Este
 * teste prova três coisas: que a regra aponta os cinco literais reais, que ela
 * deixa geometria e valor lido em paz, e que a única saída é a allowlist.
 */

const RAIZ = process.cwd();
const EXEMPLO = join("tests", "exemplos", "literais-do-prototipo.ts");

const OPCOES = {
  formatadores: ["formatarValor", "formatarMesAno"],
  camposDeKpi: ["value", "valor", "delta", "rodape"],
  allowlist: ["META_DE_TURNOVER", "meta"],
};

async function analisar(codigo: string, opcoes: unknown = OPCOES) {
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ["**/*.ts"],
        languageOptions: {
          parser: (await import("@typescript-eslint/parser")).default,
        },
        plugins: { painel: painel as never },
        rules: { "painel/sem-literal-numerico": ["error", opcoes] },
      },
    ],
  });
  const [resultado] = await eslint.lintText(codigo, { filePath: "exemplo.ts" });
  return resultado?.messages ?? [];
}

/** O trecho de código apontado, para conferir o número exato. */
function valoresApontados(
  mensagens: Awaited<ReturnType<typeof analisar>>,
  codigo: string,
): string[] {
  const linhas = codigo.split("\n");
  return mensagens.map((m) => {
    const linha = linhas[m.line - 1] ?? "";
    return linha.slice(m.column - 1, (m.endColumn ?? m.column) - 1);
  });
}

describe("Os cinco literais reais do protótipo (Anexo D, achado 5)", () => {
  const codigo = readFileSync(join(RAIZ, EXEMPLO), "utf8");

  it("o arquivo de exemplo existe e traz os cinco números", () => {
    for (const numero of ["74", "54.3", "4.1", "40.0", "-0.7"]) {
      expect(codigo, `${numero} sumiu do exemplo`).toContain(numero);
    }
  });

  it("a regra aponta exatamente os cinco, e nada mais", async () => {
    const mensagens = await analisar(codigo);
    const apontados = valoresApontados(mensagens, codigo);

    expect(apontados.sort()).toEqual(["-0.7", "4.1", "40.0", "54.3", "74"]);
  });

  it("cada apontamento diz por que, citando o requisito", async () => {
    const mensagens = await analisar(codigo);
    expect(mensagens).toHaveLength(5);
    for (const m of mensagens) {
      expect(m.message).toMatch(/RF-07/);
      expect(m.severity, "a regra precisa ser erro, nao aviso").toBe(2);
    }
  });
});

describe("O que a regra precisa deixar em paz", () => {
  it("geometria e índice de vetor não são valor de negócio", async () => {
    const mensagens = await analisar(
      "export const g = { largura: 74, altura: 216, span: 4 };\n" +
        'export const p = ["jan", "fev"][0];\n',
    );
    expect(mensagens).toEqual([]);
  });

  it("valor lido da camada de dados atravessa o formatador", async () => {
    const mensagens = await analisar(
      "declare function formatarValor(v: number, u: string): string;\n" +
        "export const f = (lido: number) => formatarValor(lido, 'pct');\n",
    );
    expect(mensagens).toEqual([]);
  });

  it("a allowlist nomeada libera a meta vinda do catálogo", async () => {
    const comAllowlist = await analisar(
      "declare function formatarValor(v: number, u: string): string;\n" +
        "const META_DE_TURNOVER = 14;\n" +
        "export const m = formatarValor(META_DE_TURNOVER, 'pct');\n",
    );
    expect(comAllowlist).toEqual([]);
  });

  it("o mesmo KPI reprova quando o nome sai da allowlist", async () => {
    const codigo =
      "export const META_DE_TURNOVER = { label: 'meta', value: 14 };\n";

    const liberado = await analisar(codigo);
    expect(liberado, "a allowlist nomeada nao liberou").toEqual([]);

    const reprovado = await analisar(codigo, { ...OPCOES, allowlist: [] });
    expect(
      reprovado,
      "sem a allowlist o mesmo literal precisa ser apontado",
    ).toHaveLength(1);
  });

  it("literal cru no formatador e reprovado com ou sem allowlist", async () => {
    const codigo =
      "declare function formatarValor(v: number, u: string): string;\n" +
      "export const m = formatarValor(14, 'pct');\n";
    expect(await analisar(codigo)).toHaveLength(1);
    expect(await analisar(codigo, { ...OPCOES, allowlist: [] })).toHaveLength(
      1,
    );
  });
});

describe("A regra pega o número no campo de KPI", () => {
  it.each([
    ["value", "export const k = { label: 'x', value: 4.1 };"],
    ["delta", "export const k = { label: 'x', delta: -0.7 };"],
    ["rodape", "export const k = { label: 'x', rodape: 12 };"],
  ])("campo %s com número fixo é reprovado", async (_campo, codigo) => {
    const mensagens = await analisar(codigo);
    expect(mensagens).toHaveLength(1);
    expect(mensagens[0]?.message).toMatch(/Anexo D/);
  });

  it("o mesmo campo vindo de variável passa", async () => {
    const mensagens = await analisar(
      "export const montar = (lido: number) => ({ label: 'x', value: lido });",
    );
    expect(mensagens).toEqual([]);
  });
});
