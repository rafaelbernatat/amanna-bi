import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import {
  AREAS,
  AGREGACOES,
  ENTIDADES,
  MODALIDADES,
  PERIODOS,
  QUERY_PADRAO,
  UNIDADES,
  type Query,
} from "@/semantica/contrato";
import { anoValido, type Dimensoes } from "@/semantica/recortes";

/**
 * O contrato de dados de T-101.
 *
 * Duas garantias, e o aceite nomeia as duas: o contrato não conhece a interface,
 * e `Query` aceita exatamente o vocabulário da seção 6.2 do PRD — com o ano
 * fora do tipo, por D-P8.
 *
 * Os `@ts-expect-error` abaixo **são** o teste de tipo: se o domínio afrouxar e
 * o literal inválido passar a compilar, o próprio `@ts-expect-error` vira erro
 * ("unused"), e `npm run typecheck` reprova. Não é comentário decorativo.
 */

describe("Query aceita exatamente o vocabulário da seção 6.2", () => {
  it("os quatro domínios fechados têm o tamanho que o PRD declara", () => {
    expect(PERIODOS).toHaveLength(4);
    expect(ENTIDADES).toHaveLength(3);
    expect(AREAS).toHaveLength(8);
    expect(MODALIDADES).toHaveLength(4);
  });

  it("nenhum valor repetido dentro de um domínio", () => {
    for (const [nome, dominio] of [
      ["periodo", PERIODOS],
      ["entidade", ENTIDADES],
      ["area", AREAS],
      ["modalidade", MODALIDADES],
    ] as const) {
      expect(new Set(dominio).size, `${nome} tem valor repetido`).toBe(
        dominio.length,
      );
    }
  });

  it("o recorte padrão é o consolidado da tabela 6.2", () => {
    expect(QUERY_PADRAO.periodo).toBe("12-meses");
    expect(QUERY_PADRAO.entidade).toBe("consolidado");
    expect(QUERY_PADRAO.area).toBe("todas");
    expect(QUERY_PADRAO.modalidade).toBe("todas");
  });

  it("todo valor de cada domínio é aceito pelo tipo", () => {
    for (const periodo of PERIODOS) {
      for (const entidade of ENTIDADES) {
        const q: Query = { ...QUERY_PADRAO, periodo, entidade };
        expect(q.periodo).toBe(periodo);
      }
    }
    for (const area of AREAS) {
      for (const modalidade of MODALIDADES) {
        const q: Query = { ...QUERY_PADRAO, area, modalidade };
        expect(q.area).toBe(area);
      }
    }
  });

  it("literal fora do domínio não compila (teste de tipo)", () => {
    // Se qualquer um destes passar a compilar, o @ts-expect-error fica sem uso
    // e o typecheck reprova — que é exatamente o alarme que se quer.
    // @ts-expect-error periodo fora dos 4 da seção 6.2
    const periodoInvalido: Query = { ...QUERY_PADRAO, periodo: "3 meses" };
    // @ts-expect-error entidade fora das 3 (a v1.0 do PRD listava 'Matriz')
    const entidadeInvalida: Query = { ...QUERY_PADRAO, entidade: "Matriz" };
    // @ts-expect-error area fora das 8
    const areaInvalida: Query = { ...QUERY_PADRAO, area: "Juridico" };
    // @ts-expect-error modalidade fora das 4
    const modalidadeInvalida: Query = { ...QUERY_PADRAO, modalidade: "Campo" };
    // @ts-expect-error filtro que nao existe no recorte
    const chaveExtra: Query = { ...QUERY_PADRAO, centroDeCusto: "CC-01" };

    expect([
      periodoInvalido,
      entidadeInvalida,
      areaInvalida,
      modalidadeInvalida,
      chaveExtra,
    ]).toHaveLength(5);
  });
});

describe("O ano ficou fora do tipo, por D-P8", () => {
  const DIMENSOES: Dimensoes = {
    periodo: [...PERIODOS],
    ano: ["2026", "2025"],
    entidade: [...ENTIDADES],
    area: [...AREAS],
    modalidade: [...MODALIDADES],
  };

  it("um ano que ainda não existe compila — o tipo não é a trava", () => {
    // Isto precisa compilar: e a diferenca entre 'carregar 2027 na replica' e
    // 'editar o tipo, recompilar e reimplantar' (D-P8).
    const q: Query = { ...QUERY_PADRAO, ano: "2027" };
    expect(q.ano).toBe("2027");
  });

  it("quem recusa o ano é o dado declarado em getMeta, não o tipo", () => {
    expect(anoValido(DIMENSOES, "2026")).toBe(true);
    expect(anoValido(DIMENSOES, "2027")).toBe(false);
    // Carregar o ano na réplica passa a aceitá-lo, sem tocar em código.
    expect(anoValido({ ...DIMENSOES, ano: ["2027"] }, "2027")).toBe(true);
  });
});

describe("Unidade e agregação são enums fechados (seção 9.2)", () => {
  it("as cinco unidades e as três agregações do PRD", () => {
    expect([...UNIDADES]).toEqual(["BRL_mi", "pct", "pp", "dias", "FTE"]);
    expect([...AGREGACOES]).toEqual(["sum", "last", "ratio"]);
  });
});

/**
 * Teste de grafo: o contrato não conhece a interface.
 *
 * O aceite pede que ele "não importe React nem Next". Vale para o módulo do
 * contrato e para toda a camada semântica — se o catálogo passar a depender de
 * React, o adaptador deixa de ser substituível e PR-1 cai junto.
 */
describe("Grafo: a camada semântica não importa React nem Next", () => {
  const RAIZ = process.cwd();

  function varrer(pasta: string): string[] {
    const achados: string[] = [];
    for (const nome of readdirSync(pasta)) {
      const caminho = join(pasta, nome);
      if (statSync(caminho).isDirectory()) achados.push(...varrer(caminho));
      else if (/\.tsx?$/.test(nome)) achados.push(caminho);
    }
    return achados;
  }

  const ARQUIVOS = varrer(join(RAIZ, "src", "semantica")).map((c) =>
    relative(RAIZ, c),
  );

  /** Import de verdade, não menção em comentário. */
  function importaDe(caminho: string, modulo: RegExp): boolean {
    const codigo = readFileSync(join(RAIZ, caminho), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    return new RegExp(
      String.raw`(?:from|import|require\()\s*["']` + modulo.source,
    ).test(codigo);
  }

  it("existem arquivos da camada semântica para inspecionar", () => {
    expect(ARQUIVOS.length).toBeGreaterThan(1);
    expect(ARQUIVOS.some((c) => c.endsWith("contrato.ts"))).toBe(true);
  });

  it.each([
    ["react", /react/],
    ["react-dom", /react-dom/],
    ["next", /next/],
    ["recharts", /recharts/],
  ])("nenhum arquivo importa %s", (_nome, modulo) => {
    const infratores = ARQUIVOS.filter((c) => importaDe(c, modulo));
    expect(infratores).toEqual([]);
  });

  it("nenhum arquivo da camada semântica é componente de cliente", () => {
    const vazando = ARQUIVOS.filter((c) =>
      /^\s*["']use client["']/m.test(readFileSync(join(RAIZ, c), "utf8")),
    );
    expect(vazando).toEqual([]);
  });
});
