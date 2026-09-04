import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Arquitetura do desenho, depois da revisao de D4 (T-129).
 *
 * O PRD deixou de proibir biblioteca de graficos, mas nao deixou de exigir que
 * o trabalho pesado fique no servidor. O que estes testes sustentam:
 *
 *   1. so os componentes de grafico e o chat sao de cliente — a fronteira
 *      `"use client"` nao vaza para o resto da apresentacao;
 *   2. nenhum componente de grafico le dado, calcula ou formata (principio PR-1);
 *   3. nosso codigo nao mede largura por conta propria — quem mede e o
 *      `ResponsiveContainer`, dentro da biblioteca, e a caixa ja esta reservada.
 *
 * O chat entrou na fronteira de cliente em 2026-09-03 (decisao
 * D-CHAT-conversa-flutuante): uma conversa e estado que muda a cada tecla e
 * sobrevive a navegacao, e nao ha como faze-la no servidor sem virar sessao.
 * O que continua valendo para ele e o mesmo que vale para os graficos: nao le
 * dado, nao calcula, nao importa recharts. O numero nasce na rota, no
 * servidor, e o chat so desenha o que volta.
 */

const RAIZ = process.cwd();
const APRESENTACAO = join(RAIZ, "src", "apresentacao");
const GRAFICOS = join("src", "apresentacao", "graficos");
const CHAT = join("src", "apresentacao", "chat");

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
 * Explicar por escrito por que o codigo nao mede largura e util, e nao pode ser
 * o que reprova o teste: o que importa e a chamada, nao a mencao.
 */
function codigoSemComentarios(caminho: string): string {
  return readFileSync(join(RAIZ, caminho), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const ARQUIVOS = varrer(APRESENTACAO).map((c) => relative(RAIZ, c));
const DE_GRAFICO = ARQUIVOS.filter((c) => c.startsWith(GRAFICOS + sep));
const FORA_DE_GRAFICO = ARQUIVOS.filter((c) => !c.startsWith(GRAFICOS + sep));
/** Os dois lugares onde `"use client"` e permitido: graficos e chat. */
const FORA_DA_FRONTEIRA_DE_CLIENTE = ARQUIVOS.filter(
  (c) => !c.startsWith(GRAFICOS + sep) && !c.startsWith(CHAT + sep),
);

describe("A fronteira de cliente fica contida nos graficos e no chat", () => {
  it("existem arquivos de apresentacao para inspecionar", () => {
    expect(ARQUIVOS.length).toBeGreaterThan(5);
    expect(DE_GRAFICO.length).toBeGreaterThan(1);
    expect(ARQUIVOS.some((c) => c.startsWith(CHAT + sep))).toBe(true);
  });

  it("nenhum arquivo fora de graficos e do chat declara 'use client'", () => {
    const vazando = FORA_DA_FRONTEIRA_DE_CLIENTE.filter((c) =>
      /^\s*["']use client["']/m.test(readFileSync(join(RAIZ, c), "utf8")),
    );
    expect(vazando).toEqual([]);
  });

  it("nenhum arquivo fora de graficos importa recharts", () => {
    const vazando = FORA_DE_GRAFICO.filter((c) =>
      /from\s+["']recharts["']/.test(codigoSemComentarios(c)),
    );
    expect(vazando).toEqual([]);
  });

  it("o nucleo de dominio nao importa recharts nem React", () => {
    const fonte = codigoSemComentarios(join(GRAFICOS, "nucleo.ts"));
    expect(fonte).not.toMatch(/from\s+["']recharts["']/);
    expect(fonte).not.toMatch(/from\s+["']react["']/);
  });
});

describe("Nenhum componente de grafico le dado, calcula ou formata", () => {
  /** Principio PR-1: o grafico recebe serie pronta e desenha. */
  const PROIBIDOS = [
    { nome: "fetch", padrao: /\bfetch\s*\(/ },
    { nome: "Intl", padrao: /\bIntl\s*\./ },
    { nome: "toLocaleString", padrao: /\.toLocaleString\s*\(/ },
    { nome: "toFixed", padrao: /\.toFixed\s*\(/ },
    {
      nome: "getKpis/getPanel/getMetric",
      padrao: /\bget(Kpis|Panel|Metric)\s*\(/,
    },
  ] as const;

  it.each(PROIBIDOS)("nenhum grafico usa $nome", ({ padrao }) => {
    const infratores = DE_GRAFICO.filter((c) =>
      padrao.test(codigoSemComentarios(c)),
    );
    expect(infratores).toEqual([]);
  });
});

describe("Medicao de largura fica na biblioteca, nao no nosso codigo", () => {
  const PROIBIDOS = [
    { nome: "ResizeObserver", padrao: /\bResizeObserver\b/ },
    { nome: "offsetWidth", padrao: /\.offsetWidth\b/ },
    { nome: "clientWidth", padrao: /\.clientWidth\b/ },
    { nome: "getBoundingClientRect", padrao: /\.getBoundingClientRect\s*\(/ },
    { nome: "window.innerWidth", padrao: /\bwindow\s*\.\s*innerWidth\b/ },
    { nome: "getComputedStyle", padrao: /\bgetComputedStyle\s*\(/ },
  ] as const;

  it.each(PROIBIDOS)(
    "nenhum arquivo de apresentacao usa $nome",
    ({ padrao }) => {
      const infratores = ARQUIVOS.filter((c) =>
        padrao.test(codigoSemComentarios(c)),
      );
      expect(infratores).toEqual([]);
    },
  );

  it("a caixa do grafico reserva altura explicita antes de montar", () => {
    const fonte = readFileSync(
      join(RAIZ, GRAFICOS, "CaixaDeGrafico.tsx"),
      "utf8",
    );
    expect(fonte).toMatch(/height:\s*altura/);
    expect(fonte).toMatch(/minHeight:\s*altura/);
  });
});
