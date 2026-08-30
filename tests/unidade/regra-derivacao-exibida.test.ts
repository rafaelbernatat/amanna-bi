/**
 * A regra de AST de T-134: a tela não deriva o número que exibe.
 *
 * Achado 3 do Anexo D: no protótipo `fctx()` devolve multiplicadores e a tela
 * multiplica o valor lido antes de mostrar — filtrar virou escalar. O achado 4
 * é a consequência: KPI e painel reconciliavam porque escalavam pelo mesmo
 * fator, não porque somavam o mesmo dado.
 *
 * O que este arquivo prova:
 *
 * 1. o achado 3 escrito em TypeScript **reprova**, nas sete formas em que ele
 *    aparece — inclusive as que T-141 deixa passar de propósito, e inclusive
 *    quando passa por um atalho local que embrulha o formatador;
 * 2. o contraexemplo de geometria **passa**, senão a regra proibiria desenhar e
 *    seria desligada na primeira semana;
 * 3. a apresentação e as rotas do produto estão limpas hoje;
 * 4. as duas derivações liberadas **seriam** reprovadas sem a lista — que é o
 *    que prova que a lista está segurando alguma coisa, e não decorando;
 * 5. toda entrada da lista traz motivo escrito.
 */

import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

// @ts-expect-error — regra local em .mjs, sem tipos declarados.
import plugin from "../../ferramentas/eslint/sem-derivacao-exibida.mjs";
// @ts-expect-error — lista local em .mjs, sem tipos declarados.
import { DERIVACOES } from "../../ferramentas/eslint/lista-de-derivacoes.mjs";

const RAIZ = process.cwd();
const ACHADO_3 = join("tests", "exemplos", "derivacao-na-tela.ts");
const GEOMETRIA = join("tests", "exemplos", "geometria-legitima.ts");

type Entrada = { readonly funcao: string; readonly motivo: string };
const LISTA = DERIVACOES as readonly Entrada[];

/**
 * Uma instância de ESLint por conjunto de opções, reaproveitada.
 *
 * Mesma razão dos testes de T-141 e T-181: montar uma por chamada custa mais de
 * um segundo, e sob a carga paralela do vitest o caso estoura o limite. Teste
 * intermitente reprova sem haver defeito, e ensina a ignorar vermelho.
 */
const INSTANCIAS = new Map<string, ESLint>();

async function eslintPara(opcoes: unknown): Promise<ESLint> {
  const chave = JSON.stringify(opcoes ?? {});
  const existente = INSTANCIAS.get(chave);
  if (existente !== undefined) return existente;

  const eslint = new ESLint({
    cwd: RAIZ,
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ["**/*.ts", "**/*.tsx"],
        languageOptions: {
          parser: (await import("@typescript-eslint/parser")).default,
        },
        plugins: { painel: plugin as never },
        rules: { "painel/sem-derivacao-exibida": ["error", opcoes ?? {}] },
      },
    ],
  });
  INSTANCIAS.set(chave, eslint);
  return eslint;
}

async function apontar(
  alvos: readonly string[],
  opcoes: unknown = {},
): Promise<readonly { arquivo: string; linha: number; expressao: string }[]> {
  const eslint = await eslintPara(opcoes);
  const resultados = await eslint.lintFiles(alvos.map((a) => join(RAIZ, a)));
  return resultados.flatMap((r) =>
    r.messages.map((m) => ({
      arquivo: relative(RAIZ, r.filePath).replace(/\\/g, "/"),
      linha: m.line,
      expressao: /A expressão '(.+?)' faz conta/.exec(m.message)?.[1] ?? "?",
    })),
  );
}

/** Os arquivos de tela: apresentação e rotas. */
function varrer(pasta: string): string[] {
  const achados: string[] = [];
  for (const nome of readdirSync(pasta)) {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) achados.push(...varrer(caminho));
    else if (/\.tsx?$/.test(nome)) achados.push(relative(RAIZ, caminho));
  }
  return achados;
}

const CODIGO_DE_TELA = [
  ...varrer(join(RAIZ, "src", "apresentacao")),
  ...varrer(join(RAIZ, "src", "app")),
];

describe("o achado 3 do Anexo D reprova", () => {
  it("1. as sete formas de escalar o valor na tela são apontadas", async () => {
    const achados = await apontar([ACHADO_3]);

    // Sete casos escritos no exemplo, um por forma de derivar.
    expect(achados).toHaveLength(7);

    const expressoes = achados.map((a) => a.expressao);
    expect(expressoes).toContain("lido.total * ENTIDADE_SP");
    expect(expressoes).toContain("lido.total * fator");
    expect(expressoes).toContain("lido.total - lido.anterior");
    expect(expressoes).toContain("lido.total / lido.anterior");
  });

  it("1b. o atalho local que embrulha o formatador nao escapa", async () => {
    const achados = await apontar([ACHADO_3]);
    /*
     * A apresentacao chama `texto(v, u)`, e `texto` chama `formatarValor`. Uma
     * regra que olhasse so o nome configurado deixaria passar o achado 3 por
     * um helper de tres linhas -- foi assim que este caso apareceu, ao tentar
     * provocar o vermelho do teste de comportamento.
     */
    const pelaPonte = achados.filter((a) => a.linha >= 40);
    expect(pelaPonte.length).toBeGreaterThan(0);
  });

  it("2. a conta escondida atrás de ?? não escapa", async () => {
    const achados = await apontar([ACHADO_3]);
    expect(achados.map((a) => a.expressao)).toContain("lido.total * fator");
  });

  it("3. embrulhar a conta numa seta anônima não escapa", async () => {
    const achados = await apontar([ACHADO_3]);
    // O caso 6 do exemplo: a seta dentro de `map` herda o escopo de quem a
    // contém, e a decisão de derivar foi tomada ali.
    const naSeta = achados.filter((a) => a.linha >= 34);
    expect(naSeta.length).toBeGreaterThan(0);
  });
});

describe("geometria não é derivação", () => {
  it("4. o contraexemplo passa inteiro", async () => {
    expect(await apontar([GEOMETRIA])).toEqual([]);
  });
});

describe("o produto está limpo", () => {
  it("5. há código de tela para inspecionar", () => {
    // Um teste de ausência sobre lista vazia passa sempre e não prova nada.
    expect(CODIGO_DE_TELA.length).toBeGreaterThan(20);
  });

  it("6. nenhuma derivação exibida na apresentação nem nas rotas", async () => {
    const achados = await apontar(CODIGO_DE_TELA, {
      formatadores: ["formatarValor", "formatarMesAno"],
      derivacoes: LISTA,
    });
    expect(achados).toEqual([]);
  });
});

describe("a lista de derivações segura alguma coisa", () => {
  it("7. sem a lista, as duas derivações legítimas reprovam", async () => {
    const semLista = await apontar(CODIGO_DE_TELA, {
      formatadores: ["formatarValor", "formatarMesAno"],
      derivacoes: [],
    });

    /*
     * Se este caso passasse com zero, a lista estaria decorando: nada nela
     * estaria sendo dispensado, e o caso 6 ficaria verde por não haver o que
     * apontar — não por a regra estar funcionando.
     */
    expect(semLista.length).toBe(LISTA.length);
    expect(semLista.every((a) => a.arquivo.includes("DesenhoDePainel"))).toBe(
      true,
    );
  });

  it("8. toda entrada declara função e motivo escrito", () => {
    expect(LISTA.length).toBeGreaterThan(0);
    for (const entrada of LISTA) {
      expect(entrada.funcao, "função vazia").not.toBe("");
      // Motivo de uma palavra é dispensa sem razão, que é o que a lista existe
      // para impedir.
      expect(
        entrada.motivo.split(/\s+/).length,
        `motivo curto demais em ${entrada.funcao}`,
      ).toBeGreaterThan(12);
    }
  });
});
