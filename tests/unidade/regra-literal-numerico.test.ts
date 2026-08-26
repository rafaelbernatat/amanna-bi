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

/**
 * Uma instancia de ESLint por conjunto de opcoes, reaproveitada.
 *
 * Criar uma por chamada custava ~1,2 s cada, e sob a carga paralela do vitest
 * as 12 chamadas estouravam o limite de 5 s do caso — o teste ficava
 * intermitente, passando sozinho e falhando na suite inteira. Teste
 * intermitente e veneno num portao de CI: reprova sem haver defeito, e ensina
 * a ignorar vermelho.
 */
const INSTANCIAS = new Map<string, ESLint>();

async function eslintPara(opcoes: unknown): Promise<ESLint> {
  const chave = JSON.stringify(opcoes);
  const existente = INSTANCIAS.get(chave);
  if (existente !== undefined) return existente;

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
  INSTANCIAS.set(chave, eslint);
  return eslint;
}

async function analisar(codigo: string, opcoes: unknown = OPCOES) {
  const eslint = await eslintPara(opcoes);
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

/*
 * O caminho indireto, que a primeira versao da regra nao via.
 *
 * O aceite de T-141 diz "qualquer literal numerico que ALCANCE o modulo de
 * formatacao". Alcancar nao e o mesmo que estar escrito no argumento: quando o
 * valor lido e nulo, o numero do `??` e exatamente o que o formatador recebe.
 * O primeiro cartao de KPI de verdade (T-131) trouxe o caso pronto --
 * `formatarValor(kpi.value ?? 0, kpi.unit)` -- e a regra deixou passar.
 */
describe("A regra segue o literal que chega por caminho indireto", () => {
  const DECLARACAO = `
declare function formatarValor(v: number, u: string): string;
declare const lido: number | null;
declare const lidoFirme: number;
declare const serie: readonly number[];
`;

  const comDeclaracao = (expressao: string) =>
    `${DECLARACAO}export const m = ${expressao};
`;

  it.each([
    ["o fallback de ??", "formatarValor(lido ?? 0, 'pct')", "0"],
    ["o fallback de ||", "formatarValor(lido || 40, 'pct')", "40"],
    ["o lado direito de &&", "formatarValor(lido && 12, 'pct')", "12"],
    ["um ramo de ternario", "formatarValor(lido ? lido : 4.1, 'pct')", "4.1"],
    ["um literal negativo", "formatarValor(lido ?? -0.7, 'pp')", "-0.7"],
  ])("%s e apontado", async (_caso, expressao, esperado) => {
    const mensagens = await analisar(comDeclaracao(expressao));
    expect(mensagens).toHaveLength(1);
    expect(mensagens[0]?.message).toContain(esperado);
    expect(mensagens[0]?.message).toMatch(/formatador/);
  });

  it("ternario com numero dos dois lados da dois erros, um por numero", async () => {
    const mensagens = await analisar(
      comDeclaracao("formatarValor(lido ? 12 : 40, 'pct')"),
    );
    expect(mensagens).toHaveLength(2);
    const juntas = mensagens.map((m) => m.message).join(" ");
    expect(juntas).toContain("12");
    expect(juntas).toContain("40");
  });

  it("o campo de KPI tambem: value com fallback escrito a mao e reprovado", async () => {
    const mensagens = await analisar(
      comDeclaracao("{ label: 'x', value: lido ?? 0 }"),
    );
    expect(mensagens).toHaveLength(1);
    expect(mensagens[0]?.message).toMatch(/Anexo D/);
  });

  it("o embrulho do TypeScript nao esconde o literal", async () => {
    const mensagens = await analisar(
      comDeclaracao("formatarValor(74 as number, 'pct')"),
    );
    expect(mensagens).toHaveLength(1);
    expect(mensagens[0]?.message).toContain("74");
  });

  /*
   * O outro lado da linha, e a razao de a regra parar onde para.
   *
   * Ela desce por operador que ENTREGA o valor, nao por operador que o calcula
   * ou o compara. Sem estes casos, "reforcar a regra" viraria "proibir
   * aritmetica", e quem programa esconderia o fator numa constante de nome
   * vazio: o numero continuaria ali, agora disfarcado, e a regra estaria pior
   * do que antes por parecer mais forte.
   */
  it.each([
    ["fator de escala", "formatarValor(lidoFirme * 100, 'pct')"],
    ["divisor", "formatarValor(lidoFirme / 1000, 'BRL_mi')"],
    [
      "limiar de comparacao",
      "formatarValor(lidoFirme > 0 ? lidoFirme : lidoFirme, 'pct')",
    ],
    ["indice de vetor", "formatarValor(serie[2] as number, 'pct')"],
  ])("%s continua passando", async (_caso, expressao) => {
    expect(await analisar(comDeclaracao(expressao))).toEqual([]);
  });
});
