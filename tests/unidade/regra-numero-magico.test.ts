/**
 * A regra de AST de T-181: nenhum número solto nos módulos de KPI e painel.
 *
 * T-141 pega `formatarValor(34.2)`. Não pega o caminho de duas etapas — uma
 * linha declara `const x = 34.2`, outra chama o formatador — e é esse o que
 * aparece em código de verdade, porque ninguém escreve o número dentro da
 * chamada.
 *
 * O que este arquivo prova:
 *
 * 1. o exemplo de duas etapas **reprova**, que é o texto do aceite;
 * 2. o contraexemplo estrutural **passa**, senão a regra proibiria tudo e
 *    seria desligada;
 * 3. os módulos reais do produto estão limpos hoje;
 * 4. a lista branca está vazia — e cresce só por revisão.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

// @ts-expect-error — regra local em .mjs, sem tipos declarados.
import regra from "../../ferramentas/eslint/sem-numero-magico.mjs";

const RAIZ = process.cwd();
const DUAS_ETAPAS = join("tests", "exemplos", "numero-em-duas-etapas.ts");
const ESTRUTURAL = join("tests", "exemplos", "numero-estrutural.ts");

/**
 * Uma instância de ESLint por conjunto de opções, reaproveitada.
 *
 * Mesma razão do teste de T-141: criar uma por chamada custa mais de um
 * segundo, e sob a carga paralela do vitest o caso estoura o limite. Teste
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
        plugins: { painel: { rules: { "sem-numero-magico": regra } } as never },
        rules: { "painel/sem-numero-magico": ["error", opcoes ?? {}] },
      },
    ],
  });
  INSTANCIAS.set(chave, eslint);
  return eslint;
}

async function apontar(
  arquivo: string,
  opcoes: unknown = {},
): Promise<readonly { linha: number; valor: string }[]> {
  const eslint = await eslintPara(opcoes);
  const [r] = await eslint.lintFiles([join(RAIZ, arquivo)]);
  return (r?.messages ?? []).map((m) => ({
    linha: m.line,
    valor: /Número (\S+) solto/.exec(m.message)?.[1] ?? "?",
  }));
}

describe("o exemplo do aceite reprova", () => {
  it("`const x = 34.2` seguido de chamada ao formatador é apontado", async () => {
    const achados = await apontar(DUAS_ETAPAS);
    const valores = achados.map((a) => a.valor);

    // Os dois 34.2 (o de nome curto e o de nome plausível) e o 74 do campo.
    expect(valores.filter((v) => v === "34.2")).toHaveLength(2);
    expect(valores).toContain("74");
  });

  it("aponta exatamente três, e nada mais", async () => {
    // Contar importa: uma regra que aponta o arquivo inteiro não distingue
    // nada, e o número exato é o que prova que ela está lendo o AST.
    expect(await apontar(DUAS_ETAPAS)).toHaveLength(3);
  });

  it("T-141 sozinha não pegaria o de duas etapas", async () => {
    /*
     * A justificativa da tarefa, em teste.
     *
     * Se a regra antiga já bastasse, T-181 não precisaria existir. Aqui se
     * mostra que ela vê **um** literal no arquivo — o `74` encostado no campo —
     * e não vê nenhum dos dois `34.2`, porque nenhum encosta no formatador.
     */
    const { default: pluginAntigo } = await import(
      // @ts-expect-error — plugin local em .mjs, sem tipos declarados.
      "../../ferramentas/eslint/sem-literal-numerico.mjs"
    );
    const eslint = new ESLint({
      cwd: RAIZ,
      overrideConfigFile: true,
      overrideConfig: [
        {
          files: ["**/*.ts"],
          languageOptions: {
            parser: (await import("@typescript-eslint/parser")).default,
          },
          plugins: { painel: pluginAntigo as never },
          rules: {
            "painel/sem-literal-numerico": [
              "error",
              {
                formatadores: ["formatarValor"],
                camposDeKpi: ["value", "valor", "delta", "rodape"],
              },
            ],
          },
        },
      ],
    });
    const [r] = await eslint.lintFiles([join(RAIZ, DUAS_ETAPAS)]);
    const mensagens = r?.messages ?? [];

    expect(mensagens).toHaveLength(1);
    expect(mensagens[0]?.message).toContain("74");
  });
});

describe("o contraexemplo estrutural passa", () => {
  it("span, fontSize, índice e constante MAIÚSCULA não são apontados", async () => {
    // Sem isto, a regra "funcionaria" proibindo tudo — e seria desligada na
    // primeira sexta-feira em que atrapalhasse alguém.
    expect(await apontar(ESTRUTURAL)).toEqual([]);
  });

  it("mas tirar o nome da lista branca faz o mesmo arquivo reprovar", async () => {
    // A prova de que o teste acima passa pela lista branca, e não por acaso.
    const semSpan = await apontar(ESTRUTURAL, {
      estruturais: ["fontSize", "top", "gap", "borderRadius"],
    });
    expect(semSpan.map((a) => a.valor)).toContain("4");
  });

  it("e desligar a constante nomeada também", async () => {
    const semConstante = await apontar(ESTRUTURAL, {
      permiteConstanteNomeada: false,
    });
    expect(semConstante.map((a) => a.valor)).toContain("12");
  });

  it("e desligar o índice também", async () => {
    const semIndice = await apontar(ESTRUTURAL, { permiteIndice: false });
    expect(semIndice.map((a) => a.valor)).toContain("1");
  });
});

describe("os módulos reais do produto", () => {
  const ALVOS = [
    join("src", "semantica", "kpis.ts"),
    join("src", "semantica", "paineis.ts"),
    join("src", "semantica", "painel.ts"),
    join("src", "apresentacao", "graficos", "GraficoDeBarras.tsx"),
    join("src", "apresentacao", "graficos", "GraficoDeBarrasEmpilhadas.tsx"),
    join("src", "apresentacao", "graficos", "GraficoDeLinha.tsx"),
    join("src", "apresentacao", "graficos", "SemDado.tsx"),
    join("src", "apresentacao", "graficos", "CaixaDeGrafico.tsx"),
  ];

  it.each(ALVOS)("%s está limpo", async (arquivo) => {
    expect(await apontar(arquivo)).toEqual([]);
  });
});

describe("a lista branca", () => {
  /**
   * Está vazia, e isso é o resultado, não uma pendência.
   *
   * Os 74 números de `paineis.ts` e os ~56 dos componentes passaram todos por
   * nome estrutural, constante nomeada ou índice. Não foi preciso dispensar
   * nenhum caso individual — o que significa que a regra descreve o código em
   * vez de negociar com ele.
   *
   * O aceite pede que a lista seja "revisada no CI quando cresce": estes dois
   * casos são a revisão. O primeiro lê o valor; o segundo confere que a
   * configuração do produto usa esse valor, e não um literal próprio.
   *
   * ## Por que são dois, e não um
   *
   * Eram um só, que importava `eslint.config.mjs` inteiro para ler um array
   * vazio — e junto vinham `eslint-config-next` e `typescript-eslint`. Sob a
   * carga da suíte esse import chegou a 78 s contra um limite de 30 s, e o
   * caso reprovava sem haver defeito (T-123.1).
   *
   * Separar o valor da fiação não afrouxa nada: cobre mais. Antes, trocar a
   * lista por um literal inline dentro da configuração passava despercebido;
   * agora reprova.
   */
  it("está vazia", async () => {
    // @ts-expect-error — módulo em .mjs, sem tipos declarados.
    const { LISTA_BRANCA } =
      await import("../../ferramentas/eslint/lista-branca-numero-magico.mjs");
    expect(LISTA_BRANCA).toEqual([]);
  });

  it("e é ela que a configuração do produto usa", () => {
    const texto = readFileSync(join(RAIZ, "eslint.config.mjs"), "utf8");

    expect(
      texto,
      "eslint.config.mjs deixou de importar a lista branca",
    ).toContain("lista-branca-numero-magico.mjs");

    const linha = texto
      .split("\n")
      .find((l) => l.includes('"painel/sem-numero-magico"'));
    expect(linha, "o bloco de T-181 sumiu da configuração").toBeDefined();
    expect(linha ?? "", "a lista branca virou literal na configuração").toMatch(
      /allowlist:\s*LISTA_BRANCA/,
    );
  });

  it("toda entrada, se existir, carrega motivo escrito", async () => {
    // A regra recusa entrada sem `motivo` pelo próprio schema; aqui se confirma
    // que o schema é o que se pensa que é.
    const comEntradaMuda = apontar(ESTRUTURAL, {
      allowlist: [{ arquivo: "x.ts", valor: 1 }],
    });
    await expect(comEntradaMuda).rejects.toThrow();
  });
});
