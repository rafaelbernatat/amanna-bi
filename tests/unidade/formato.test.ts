import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

import {
  formatarMesAno,
  formatarValor,
  type Unidade,
} from "@/apresentacao/formato/formato";

/**
 * O modulo unico de formatacao (T-125).
 *
 * A tabela abaixo e o criterio de aceite escrito como dado: 30 casos cobrindo
 * negativo, zero, valor grande e arredondamento nas cinco unidades do contrato.
 */

const TABELA: ReadonlyArray<readonly [number, Unidade, string]> = [
  // BRL_mi — R$ em milhoes com uma casa
  [1200, "BRL_mi", "R$ 1.200,0 mi"],
  [0, "BRL_mi", "R$ 0,0 mi"],
  [-8, "BRL_mi", "-R$ 8,0 mi"],
  [56, "BRL_mi", "R$ 56,0 mi"],
  [200.04, "BRL_mi", "R$ 200,0 mi"],
  [1234567.89, "BRL_mi", "R$ 1.234.567,9 mi"],
  [-0.04, "BRL_mi", "R$ 0,0 mi"],
  [999.96, "BRL_mi", "R$ 1.000,0 mi"],

  // pct — percentual
  [12.4, "pct", "12,4%"],
  [0, "pct", "0,0%"],
  [-3.2, "pct", "-3,2%"],
  [18.44, "pct", "18,4%"],
  [100, "pct", "100,0%"],
  [16.66, "pct", "16,7%"],
  [-12.4, "pct", "-12,4%"],

  // pp — pontos percentuais, sempre com sinal explicito
  [2.1, "pp", "+2,1 p.p."],
  [-1.3, "pp", "-1,3 p.p."],
  [0, "pp", "0,0 p.p."],
  [12.34, "pp", "+12,3 p.p."],
  [-0.04, "pp", "0,0 p.p."],

  // dias — contagem inteira, singular e plural
  [76, "dias", "76 dias"],
  [1, "dias", "1 dia"],
  [0, "dias", "0 dias"],
  [-5, "dias", "-5 dias"],
  [1234, "dias", "1.234 dias"],
  [51.6, "dias", "52 dias"],

  // FTE — contagem inteira
  [1240, "FTE", "1.240 FTE"],
  [0, "FTE", "0 FTE"],
  [-3, "FTE", "-3 FTE"],
  [1240.6, "FTE", "1.241 FTE"],
];

describe("Formatacao pt-BR", () => {
  it("a tabela cobre os 30 casos que o aceite exige", () => {
    expect(TABELA).toHaveLength(30);
    const unidades = new Set(TABELA.map(([, u]) => u));
    expect([...unidades].sort()).toEqual([
      "BRL_mi",
      "FTE",
      "dias",
      "pct",
      "pp",
    ]);
    expect(
      TABELA.some(([v]) => v < 0),
      "sem caso negativo",
    ).toBe(true);
    expect(
      TABELA.some(([v]) => v === 0),
      "sem caso zero",
    ).toBe(true);
    expect(
      TABELA.some(([v]) => v > 1e6),
      "sem valor grande",
    ).toBe(true);
  });

  it.each(TABELA)("formatarValor(%s, %s) = %s", (valor, unidade, esperado) => {
    expect(formatarValor(valor, unidade)).toBe(esperado);
  });

  it("recusa valor nao finito em vez de imprimir NaN", () => {
    expect(() => formatarValor(Number.NaN, "pct")).toThrow(RangeError);
    expect(() => formatarValor(Number.POSITIVE_INFINITY, "BRL_mi")).toThrow(
      RangeError,
    );
  });
});

describe("Data em mes/ano abreviado", () => {
  it.each([
    ["2026-12-31", "dez/2026"],
    ["2026-01-01", "jan/2026"],
    ["2025-06-30", "jun/2025"],
    ["2026-08", "ago/2026"],
  ])("formatarMesAno(%s) = %s", (iso, esperado) => {
    expect(formatarMesAno(iso)).toBe(esperado);
  });

  it("recusa texto que nao e data ISO", () => {
    expect(() => formatarMesAno("31/12/2026")).toThrow(RangeError);
    expect(() => formatarMesAno("2026-13-01")).toThrow(RangeError);
  });
});

describe("Determinismo: o fuso e o idioma do processo nao mudam a saida", () => {
  const fusos = [
    "UTC",
    "America/Sao_Paulo",
    "Pacific/Kiritimati",
    "Etc/GMT+12",
  ];
  const idiomas = ["C", "en_US.UTF-8", "pt_BR.UTF-8", "de_DE.UTF-8"];

  it("a tabela inteira sai igual sob 4 fusos e 4 idiomas", () => {
    const tzOriginal = process.env["TZ"];
    const langOriginal = process.env["LANG"];
    try {
      const saidas = new Set<string>();
      for (const tz of fusos) {
        for (const lang of idiomas) {
          process.env["TZ"] = tz;
          process.env["LANG"] = lang;
          saidas.add(
            TABELA.map(([v, u]) => formatarValor(v, u)).join("|") +
              "||" +
              formatarMesAno("2026-01-01"),
          );
        }
      }
      expect(saidas.size, "a saida mudou com TZ ou LANG").toBe(1);
    } finally {
      if (tzOriginal === undefined) delete process.env["TZ"];
      else process.env["TZ"] = tzOriginal;
      if (langOriginal === undefined) delete process.env["LANG"];
      else process.env["LANG"] = langOriginal;
    }
  });
});

/**
 * Teste de arquitetura: a formatacao mora num lugar so.
 *
 * `Intl`, `toLocaleString` e `toFixed` fora deste modulo sao exatamente como a
 * divergencia de formato volta a aparecer — um painel arredondando por conta
 * propria, contra a regra de contrato 2.
 */
describe("Arquitetura: formatacao so no modulo de formato", () => {
  const RAIZ = process.cwd();
  const MODULO = join("src", "apresentacao", "formato");
  const PROIBIDOS = [
    { nome: "Intl", padrao: /\bIntl\s*\./ },
    { nome: "toLocaleString", padrao: /\.toLocaleString\s*\(/ },
    { nome: "toLocaleDateString", padrao: /\.toLocaleDateString\s*\(/ },
    { nome: "toFixed", padrao: /\.toFixed\s*\(/ },
  ] as const;

  function varrer(pasta: string): string[] {
    const achados: string[] = [];
    for (const nome of readdirSync(pasta)) {
      const caminho = join(pasta, nome);
      if (statSync(caminho).isDirectory()) {
        achados.push(...varrer(caminho));
      } else if (/\.tsx?$/.test(nome)) {
        achados.push(caminho);
      }
    }
    return achados;
  }

  const arquivos = [
    ...varrer(join(RAIZ, "src")),
    ...varrer(join(RAIZ, "tests")),
  ]
    .map((c) => relative(RAIZ, c))
    .filter((c) => !c.startsWith(MODULO + sep));

  it("existem arquivos fora do modulo para inspecionar", () => {
    expect(arquivos.length).toBeGreaterThan(3);
  });

  it.each(PROIBIDOS)(
    "nenhum arquivo fora do modulo usa $nome",
    ({ padrao }) => {
      const infratores = arquivos.filter((caminho) =>
        padrao.test(readFileSync(join(RAIZ, caminho), "utf8")),
      );
      expect(infratores).toEqual([]);
    },
  );
});
