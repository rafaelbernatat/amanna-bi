import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it, beforeEach } from "vitest";

import { UNIDADES, type DataSource, type Unidade } from "@/semantica/contrato";
import {
  SomaInvalida,
  agregar,
  podeSomar,
  variacao,
  type Ponto,
} from "@/semantica/agregacao";
import {
  MOTIVOS_DE_VAZIO,
  comValor,
  dividir,
  exigirValor,
  temValor,
  vazio,
} from "@/semantica/vazio";
import {
  FONTES,
  FonteInvalida,
  fontesRegistradas,
  lerFonte,
  limparRegistro,
  obterFonteDeDados,
  registrarFonte,
} from "@/acesso/fabrica";

/**
 * A fundação da camada de dados: T-104, T-105 e T-106.
 *
 * O fio comum é o mesmo: o número errado precisa ser **impossível de produzir**,
 * não apenas desaconselhado por comentário.
 */

const MES = (mes: string, valor: number | null): Ponto => ({ mes, valor });

/* ---------------------------------------------------------------- *
 * T-105 — vazio explícito com motivo
 * ---------------------------------------------------------------- */

describe("T-105 · recorte vazio é estado, nunca zero", () => {
  it("os quatro motivos do contrato, e só eles", () => {
    expect([...MOTIVOS_DE_VAZIO]).toEqual([
      "sem_dado_no_recorte",
      "grupo_pequeno",
      "fora_do_perfil",
      "fonte_indisponivel",
    ]);
  });

  it.each(MOTIVOS_DE_VAZIO)("o motivo %s viaja junto do vazio", (motivo) => {
    const v = vazio(motivo);
    expect(v.vazio).toBe(true);
    expect(v.motivo).toBe(motivo);
    // Nenhum vazio carrega valor — nem zero, nem herdado, nem média.
    expect(Object.hasOwn(v, "valor")).toBe(false);
  });

  it("nenhum caminho devolve 0 no lugar de vazio", () => {
    const casos = [
      dividir(10, 0),
      dividir(0, 0),
      dividir(Number.NaN, 5),
      agregar([], "sum", "FTE"),
      agregar([MES("dez", null)], "last", "FTE"),
      agregar(
        [{ mes: "jan", valor: null, numerador: null, denominador: null }],
        "ratio",
        "pct",
      ),
    ];
    for (const caso of casos) {
      expect(
        caso.vazio,
        "um caminho devolveu valor onde devia devolver vazio",
      ).toBe(true);
      if (caso.vazio) expect(MOTIVOS_DE_VAZIO).toContain(caso.motivo);
    }
  });

  it("a união discriminada obriga a olhar o vazio antes do valor", () => {
    const t = dividir(10, 0);
    // Sem checar `vazio`, o valor nem existe no tipo — e um `?? 0` nao compila.
    // @ts-expect-error valor não é acessível antes de estreitar a união
    const errado = t.valor;
    expect(errado).toBeUndefined();

    if (temValor(t)) expect.unreachable("divisão por zero não devia ter valor");
  });

  it("exigirValor lança em vez de devolver zero", () => {
    expect(() => exigirValor(dividir(1, 0))).toThrow(/PR-4/);
    expect(exigirValor(comValor(42))).toBe(42);
  });

  it("o atalho para ampliar o recorte viaja quando existe", () => {
    const v = vazio("sem_dado_no_recorte", "todas as áreas");
    expect(v.ampliarPara).toBe("todas as áreas");
    expect(vazio("fora_do_perfil").ampliarPara).toBeUndefined();
  });
});

/* ---------------------------------------------------------------- *
 * T-104 — unidades, agregação e guardas de precisão
 * ---------------------------------------------------------------- */

describe("T-104 · unidade é enum fechado", () => {
  it("as cinco do PRD, e nenhuma outra", () => {
    expect([...UNIDADES]).toEqual(["BRL_mi", "pct", "pp", "dias", "FTE"]);
  });

  it("percentual e ponto percentual não são somáveis", () => {
    expect(podeSomar("pct")).toBe(false);
    expect(podeSomar("pp")).toBe(false);
    for (const u of ["BRL_mi", "dias", "FTE"] as const) {
      expect(podeSomar(u)).toBe(true);
    }
  });
});

describe("T-104 · somar percentual ao longo do período lança", () => {
  const MESES: readonly Ponto[] = [
    MES("out", 1.2),
    MES("nov", 1.4),
    MES("dez", 1.3),
  ];

  it.each(["pct", "pp"] as const)(
    "agg=sum com unidade %s é erro",
    (unidade) => {
      expect(() => agregar(MESES, "sum", unidade)).toThrow(SomaInvalida);
      // A mensagem diz o que fazer no lugar — erro que ensina.
      expect(() => agregar(MESES, "sum", unidade)).toThrow(/ratio/);
    },
  );

  it("as unidades aditivas somam normalmente", () => {
    for (const unidade of ["BRL_mi", "dias", "FTE"] as Unidade[]) {
      const total = agregar(MESES, "sum", unidade);
      expect(temValor(total) && total.valor).toBeCloseTo(3.9, 10);
    }
  });
});

describe("T-104 · ratio recompõe numerador e denominador", () => {
  /** 3 meses de turnover: as taxas mensais não podem ser somadas nem mediadas. */
  const TAXA: readonly Ponto[] = [
    { mes: "out", valor: 10, numerador: 10, denominador: 100 },
    { mes: "nov", valor: 50, numerador: 5, denominador: 10 },
    { mes: "dez", valor: 10, numerador: 1, denominador: 10 },
  ];

  it("divide uma vez só, no fim — não a média das divisões mensais", () => {
    const r = agregar(TAXA, "ratio", "pct");
    // (10+5+1) / (100+10+10) = 16/120 = 0,1333…
    expect(temValor(r) && r.valor).toBeCloseTo(16 / 120, 10);

    // A média das taxas mensais daria (10+50+10)/3 = 23,3 — muito diferente.
    const mediaIngenua = (10 + 50 + 10) / 3 / 100;
    expect(temValor(r) && r.valor).not.toBeCloseTo(mediaIngenua, 3);
  });

  it("denominador total zero devolve vazio, não Infinity nem NaN", () => {
    const semDenominador: readonly Ponto[] = [
      { mes: "out", valor: null, numerador: 5, denominador: 0 },
      { mes: "nov", valor: null, numerador: 3, denominador: 0 },
    ];
    const r = agregar(semDenominador, "ratio", "pct");
    expect(r.vazio).toBe(true);
    if (r.vazio) expect(r.motivo).toBe("sem_dado_no_recorte");
  });
});

describe("T-104 · last devolve o último mês do recorte", () => {
  it("o último, não a soma nem a média", () => {
    const estoque = [MES("out", 1150), MES("nov", 1200), MES("dez", 1240)];
    const r = agregar(estoque, "last", "FTE");
    expect(temValor(r) && r.valor).toBe(1240);
  });

  it("se o último mês não tem dado, a resposta é vazio — não o penúltimo", () => {
    // 'Novembro serve' seria valor herdado de outro recorte (principio PR-4).
    const r = agregar([MES("nov", 1200), MES("dez", null)], "last", "FTE");
    expect(r.vazio).toBe(true);
  });
});

describe("T-104 · variação sai na unidade certa", () => {
  it("taxa varia em pontos percentuais, não em percentual da taxa", () => {
    const v = variacao(comValor(18.4), comValor(14), "pct");
    expect(v.unidade).toBe("pp");
    expect(temValor(v.delta) && v.delta.valor).toBeCloseTo(4.4, 10);
    // Dizer 'subiu 31%' seria a outra leitura, e a errada para uma taxa.
  });

  it("medida aditiva varia em percentual", () => {
    const v = variacao(comValor(1200), comValor(1068), "BRL_mi");
    expect(v.unidade).toBe("pct");
    expect(temValor(v.delta) && v.delta.valor).toBeCloseTo(0.1236, 3);
  });

  it("base zero devolve vazio em vez de variação infinita", () => {
    const v = variacao(comValor(10), comValor(0), "BRL_mi");
    expect(v.delta.vazio).toBe(true);
  });

  it("comparar contra vazio devolve vazio", () => {
    expect(
      variacao(comValor(10), vazio("sem_dado_no_recorte"), "FTE").delta.vazio,
    ).toBe(true);
    expect(
      variacao(vazio("fora_do_perfil"), comValor(10), "FTE").delta.vazio,
    ).toBe(true);
  });
});

describe("T-104 · nenhum arredondamento fora da apresentação", () => {
  it("a agregação preserva as casas que recebeu", () => {
    const r = agregar([MES("jan", 1 / 3), MES("fev", 1 / 3)], "sum", "BRL_mi");
    expect(temValor(r) && r.valor).toBe(2 / 3);
    // Se houvesse arredondamento aqui, 0.6666666666666666 viraria 0.67.
    expect(temValor(r) && String(r.valor).length).toBeGreaterThan(10);
  });

  it("nenhum toFixed, Math.round ou Intl na camada semântica", () => {
    const RAIZ = process.cwd();
    for (const arquivo of [
      "agregacao.ts",
      "vazio.ts",
      "contrato.ts",
      "query.ts",
    ]) {
      const fonte = readFileSync(
        join(RAIZ, "src", "semantica", arquivo),
        "utf8",
      ).replace(/\/\*[\s\S]*?\*\//g, " ");
      expect(fonte, `${arquivo} arredonda`).not.toMatch(/\.toFixed\s*\(/);
      expect(fonte, `${arquivo} usa Intl`).not.toMatch(/\bIntl\s*\./);
    }
  });
});

/* ---------------------------------------------------------------- *
 * T-106 — a fábrica e a fronteira de camadas
 * ---------------------------------------------------------------- */

describe("T-106 · DATA_SOURCE escolhe a implementação", () => {
  const falsa = (nome: string): DataSource =>
    ({ nome }) as unknown as DataSource;

  beforeEach(() => {
    limparRegistro();
  });

  it("os dois modos do PRD, e só eles", () => {
    expect([...FONTES]).toEqual(["fixtures", "warehouse"]);
  });

  it("troca a implementação sem que quem pede saiba qual é", async () => {
    registrarFonte("fixtures", async () => falsa("fixtures"));
    registrarFonte("warehouse", async () => falsa("warehouse"));

    const a = await obterFonteDeDados({ DATA_SOURCE: "fixtures" });
    const b = await obterFonteDeDados({ DATA_SOURCE: "warehouse" });
    expect(a).not.toBe(b);
    expect([...fontesRegistradas()].sort()).toEqual(["fixtures", "warehouse"]);
  });

  it.each([
    ["postgres", "valor fora do enum"],
    ["", "vazio"],
    ["FIXTURES", "caixa errada"],
  ])("DATA_SOURCE='%s' interrompe o boot (%s)", (valor) => {
    // Direto em lerFonte, e nao via obterFonteDeDados: aquele tambem lanca
    // quando o modo e valido mas nao tem implementacao registrada, e o teste
    // passaria pelo motivo errado — sem provar que o valor foi recusado.
    expect(() => lerFonte({ DATA_SOURCE: valor })).toThrow(FonteInvalida);
    try {
      lerFonte({ DATA_SOURCE: valor });
      expect.unreachable("devia ter recusado o valor");
    } catch (erro) {
      expect((erro as Error).message).toContain(valor === "" ? "" : valor);
    }
  });

  it("variável ausente também interrompe o boot", () => {
    expect(() => lerFonte({})).toThrow(FonteInvalida);
  });

  it("o erro nomeia os modos aceitos", () => {
    try {
      lerFonte({ DATA_SOURCE: "postgres" });
      expect.unreachable("devia ter recusado");
    } catch (erro) {
      expect((erro as Error).message).toContain("fixtures");
      expect((erro as Error).message).toContain("warehouse");
    }
  });

  it("modo válido sem implementação registrada também falha", async () => {
    await expect(
      obterFonteDeDados({ DATA_SOURCE: "fixtures" }),
    ).rejects.toThrow(FonteInvalida);
  });
});

describe("T-106 · fronteira de camadas", () => {
  const RAIZ = process.cwd();
  const FABRICA = join("src", "acesso", "fabrica.ts");

  function varrer(pasta: string): string[] {
    const achados: string[] = [];
    for (const nome of readdirSync(pasta)) {
      const caminho = join(pasta, nome);
      if (statSync(caminho).isDirectory()) achados.push(...varrer(caminho));
      else if (/\.tsx?$/.test(nome)) achados.push(caminho);
    }
    return achados;
  }

  function semComentarios(caminho: string): string {
    return readFileSync(join(RAIZ, caminho), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
  }

  const TODOS = [...varrer(join(RAIZ, "src"))].map((c) => relative(RAIZ, c));

  const FORA_DA_FABRICA = TODOS.filter((c) => c !== FABRICA);

  it("há arquivos para inspecionar, e a fábrica está entre eles", () => {
    expect(TODOS.length).toBeGreaterThan(10);
    expect(TODOS).toContain(FABRICA);
  });

  it.each([
    ["pg", /from\s+["']pg["']|require\(\s*["']pg["']/],
    ["@anthropic-ai/sdk", /@anthropic-ai\/sdk/],
    ["postgres", /from\s+["']postgres["']/],
  ])("nenhum arquivo fora da fábrica importa %s", (_nome, padrao) => {
    const infratores = FORA_DA_FABRICA.filter((c) =>
      padrao.test(semComentarios(c)),
    );
    expect(infratores).toEqual([]);
  });

  it("nenhum arquivo de apresentação constrói adaptador por conta própria", () => {
    const apresentacao = TODOS.filter((c) =>
      c.startsWith(join("src", "apresentacao") + sep),
    );
    const infratores = apresentacao.filter((c) =>
      /registrarFonte|new\s+\w*(Fixtures|Warehouse)\w*DataSource/.test(
        semComentarios(c),
      ),
    );
    expect(infratores).toEqual([]);
  });
});
