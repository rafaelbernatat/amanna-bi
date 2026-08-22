import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Arquitetura do desenho (T-129).
 *
 * Duas garantias que o criterio de aceite nomeia e que so um teste sustenta:
 * nenhuma biblioteca de graficos no `package.json`, e nenhuma medicao de
 * largura no codigo de painel. O prototipo depende de `state.W` — a largura
 * medida da janela — e e exatamente isso que nao pode atravessar para ca.
 */

const RAIZ = process.cwd();

/** Bibliotecas de grafico que o PRD secao 8.2 exclui do projeto. */
const BIBLIOTECAS_DE_GRAFICO = [
  "recharts",
  "chart.js",
  "react-chartjs-2",
  "d3",
  "d3-scale",
  "d3-shape",
  "victory",
  "nivo",
  "@nivo/core",
  "echarts",
  "echarts-for-react",
  "highcharts",
  "plotly.js",
  "react-plotly.js",
  "apexcharts",
  "react-apexcharts",
  "visx",
  "@visx/visx",
  "vega",
  "vega-lite",
  "chartist",
  "britecharts",
  "amcharts",
  "@amcharts/amcharts5",
];

/** Medicao de largura e API de DOM que nao podem existir no desenho. */
const PROIBIDOS = [
  { nome: "ResizeObserver", padrao: /\bResizeObserver\b/ },
  { nome: "offsetWidth", padrao: /\.offsetWidth\b/ },
  { nome: "clientWidth", padrao: /\.clientWidth\b/ },
  { nome: "getBoundingClientRect", padrao: /\.getBoundingClientRect\s*\(/ },
  { nome: "window.innerWidth", padrao: /\bwindow\s*\.\s*innerWidth\b/ },
  { nome: "document.", padrao: /\bdocument\s*\./ },
  { nome: "getComputedStyle", padrao: /\bgetComputedStyle\s*\(/ },
  { nome: "canvas", padrao: /\bgetContext\s*\(\s*["']2d["']/ },
] as const;

function varrer(pasta: string): string[] {
  const achados: string[] = [];
  for (const nome of readdirSync(pasta)) {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) achados.push(...varrer(caminho));
    else if (/\.tsx?$/.test(nome)) achados.push(caminho);
  }
  return achados;
}

/**
 * Le o arquivo sem comentarios.
 *
 * Explicar por escrito por que o codigo nao usa `ResizeObserver` e util, e nao
 * pode ser o que reprova o teste: o que importa e a chamada, nao a mencao.
 */
function codigoSemComentarios(caminho: string): string {
  return readFileSync(join(RAIZ, caminho), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("Nenhuma biblioteca de graficos no projeto", () => {
  const pacote = JSON.parse(
    readFileSync(join(RAIZ, "package.json"), "utf8"),
  ) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const declaradas = [
    ...Object.keys(pacote.dependencies ?? {}),
    ...Object.keys(pacote.devDependencies ?? {}),
  ];

  it("o package.json tem dependencias para inspecionar", () => {
    expect(declaradas.length).toBeGreaterThan(5);
  });

  it("nenhuma das bibliotecas de grafico conhecidas esta declarada", () => {
    const achadas = declaradas.filter((d) =>
      BIBLIOTECAS_DE_GRAFICO.includes(d),
    );
    expect(achadas).toEqual([]);
  });
});

describe("Nenhuma medicao de largura no codigo de apresentacao", () => {
  const arquivos = varrer(join(RAIZ, "src", "apresentacao")).map((c) =>
    relative(RAIZ, c),
  );

  it("existem arquivos de apresentacao para inspecionar", () => {
    expect(arquivos.length).toBeGreaterThan(3);
  });

  it.each(PROIBIDOS)("nenhum arquivo usa $nome", ({ padrao }) => {
    const infratores = arquivos.filter((caminho) =>
      padrao.test(codigoSemComentarios(caminho)),
    );
    expect(infratores).toEqual([]);
  });

  it("o nucleo de geometria nao importa React nem Next", () => {
    const fonte = codigoSemComentarios(
      join("src", "apresentacao", "svg", "nucleo.ts"),
    );
    expect(fonte).not.toMatch(/from\s+["']react["']/);
    expect(fonte).not.toMatch(/from\s+["']next/);
  });
});
