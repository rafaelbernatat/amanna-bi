/**
 * O grão mínimo na fronteira da camada de dados (T-138).
 *
 * O aceite pede dez formas de pedir grão individual "sem que nenhuma toque o
 * adaptador". A diferença entre isso e "o adaptador devolve vazio" é o
 * produto inteiro da seção 11: uma consulta recusada na fronteira não vira
 * consulta ao banco, não vira linha de log com nome de pessoa, e não vira
 * resposta parcial que alguém possa recompor.
 *
 * Por isso a fonte usada aqui **lança** ao ser chamada, em vez de devolver
 * dado falso. Se a fronteira deixar passar, o teste não falha por um valor
 * inesperado — falha por ter tocado onde não devia, que é o que se quer saber.
 */

import { describe, expect, it } from "vitest";

import { criarFronteira } from "@/acesso/fronteira";
import type { DataSource, Query } from "@/semantica/contrato";
import { AREAS, ENTIDADES, MODALIDADES, PERIODOS } from "@/semantica/contrato";
import {
  BREAKDOWNS,
  breakdownValido,
  GraoProibido,
  grupoExibivel,
  MINIMO_DE_PESSOAS_POR_GRUPO,
  exigirGraoPermitido,
} from "@/seguranca/grao";
import { escopoDaSessao, type Session } from "@/seguranca/identidade";

/* ------------------------------------------------------------------ *
 * A fonte que não pode ser tocada
 * ------------------------------------------------------------------ */

class AdaptadorTocado extends Error {
  constructor(metodo: string) {
    super(
      `O adaptador foi chamado (${metodo}). A consulta devia ter sido ` +
        "recusada na fronteira, antes de qualquer leitura (seção 11).",
    );
    this.name = "AdaptadorTocado";
  }
}

function fonteQueNaoPodeSerTocada(): DataSource {
  return {
    getMeta: () => {
      throw new AdaptadorTocado("getMeta");
    },
    getKpis: () => {
      throw new AdaptadorTocado("getKpis");
    },
    getPanel: () => {
      throw new AdaptadorTocado("getPanel");
    },
    getMetric: () => {
      throw new AdaptadorTocado("getMetric");
    },
  };
}

/** Uma fonte que conta chamadas, para os casos que **devem** passar. */
function fonteQueConta() {
  const chamadas: string[] = [];
  const fonte: DataSource = {
    getMeta: async () => {
      chamadas.push("getMeta");
      throw new Error("não usado neste teste");
    },
    getKpis: async () => {
      chamadas.push("getKpis");
      return [];
    },
    getPanel: async () => {
      chamadas.push("getPanel");
      return {} as never;
    },
    getMetric: async () => {
      chamadas.push("getMetric");
      return {} as never;
    },
  };
  return { fonte, chamadas };
}

const CONSULTA: Query = {
  periodo: "12-meses",
  ano: "2026",
  entidade: "consolidado",
  area: "financeiro",
  modalidade: "todas",
};

const SESSAO: Session = {
  sujeito: "u-1",
  perfil: "diretoria",
  entidades: ["consolidado", "unidade-sp", "demais-unidades"],
  areas: ["financeiro", "rh", "operacoes"],
};

const ESCOPO = escopoDaSessao(SESSAO);

/** As dimensões que `getMeta()` declararia — inclusive os anos (D-P8). */
const DIMENSOES = {
  periodo: [...PERIODOS],
  ano: ["2025", "2026"],
  entidade: [...ENTIDADES],
  area: [...AREAS],
  modalidade: [...MODALIDADES],
};

function fronteiraCom(fonte: DataSource, escopo = ESCOPO) {
  return criarFronteira(fonte, escopo, DIMENSOES);
}

/* ------------------------------------------------------------------ *
 * O vocabulário fechado
 * ------------------------------------------------------------------ */

describe("o vocabulário de recorte da seção 7.2", () => {
  it("tem cinco entradas, contadas", () => {
    expect(BREAKDOWNS.length).toBe(5);
    expect([...BREAKDOWNS].sort()).toEqual([
      "area",
      "centro_custo",
      "faixa",
      "mes",
      "none",
    ]);
  });

  it("aceita os cinco e recusa o resto", () => {
    for (const b of BREAKDOWNS) expect(breakdownValido(b)).toBe(true);
    expect(breakdownValido("colaborador")).toBe(false);
    expect(breakdownValido("AREA")).toBe(false);
    expect(breakdownValido("")).toBe(false);
  });

  it("recusa o vazio com motivo, e não em silêncio", () => {
    expect(() => exigirGraoPermitido("")).toThrowError(GraoProibido);
  });
});

/* ------------------------------------------------------------------ *
 * As dez formas de pedir linha individual
 * ------------------------------------------------------------------ */

/**
 * Dez tentativas, do explícito ao disfarçado.
 *
 * Vêm em variações de grafia, caixa, acento e composição de propósito: um
 * filtro escrito como lista de proibidos costuma pegar `cpf` e deixar passar
 * `CPF`, `por_cpf` ou `cpf_colaborador`.
 */
const DEZ_TENTATIVAS = [
  "colaborador",
  "cpf",
  "matricula",
  "nome",
  "id",
  "por_colaborador",
  "CPF",
  "funcionário",
  "nome_completo",
  "id_pessoa",
] as const;

describe("as dez formas de pedir grão individual", () => {
  it("são dez distintas, como o aceite pede", () => {
    expect(new Set(DEZ_TENTATIVAS).size).toBe(10);
  });

  it.each(DEZ_TENTATIVAS)(
    "'%s' é recusado antes de tocar o adaptador",
    async (tentativa) => {
      const fronteira = fronteiraCom(fonteQueNaoPodeSerTocada());

      await expect(
        fronteira.lerPainel({
          painel: "rh-headcount",
          consulta: CONSULTA,
          breakdown: tentativa,
        }),
      ).rejects.toThrowError(GraoProibido);
    },
  );

  it.each(DEZ_TENTATIVAS)(
    "'%s' também é recusado em lerMetrica",
    async (tentativa) => {
      const fronteira = fronteiraCom(fonteQueNaoPodeSerTocada());

      await expect(
        fronteira.lerMetrica("headcount_fte", CONSULTA, tentativa),
      ).rejects.toThrowError(GraoProibido);
    },
  );

  it("nenhuma delas produz AdaptadorTocado — que é o erro que importa", async () => {
    // A distinção fina: se a fronteira deixasse passar, o erro seria
    // AdaptadorTocado e não GraoProibido. Este teste é o que separa
    // "recusou" de "recusou no lugar certo".
    const fronteira = fronteiraCom(fonteQueNaoPodeSerTocada());
    const erros: string[] = [];

    for (const t of DEZ_TENTATIVAS) {
      try {
        await fronteira.lerPainel({
          painel: "rh-headcount",
          consulta: CONSULTA,
          breakdown: t,
        });
        erros.push(`${t}: passou sem erro nenhum`);
      } catch (e) {
        if ((e as Error).name === "AdaptadorTocado") {
          erros.push(`${t}: chegou ao adaptador`);
        }
      }
    }

    expect(erros).toEqual([]);
  });

  it("os pedidos de pessoa são classificados como tal, não como erro de digitação", () => {
    // A trilha de auditoria trata as duas coisas de formas diferentes: uma é
    // bug de quem chamou, a outra é tentativa de acesso.
    for (const t of ["colaborador", "cpf", "matricula", "nome", "id"]) {
      try {
        exigirGraoPermitido(t);
        expect.unreachable(`'${t}' devia ter sido recusado`);
      } catch (e) {
        expect((e as GraoProibido).motivo).toBe("pedido_de_linha_individual");
      }
    }
  });

  it("recorte só desconhecido cai no outro motivo", () => {
    try {
      exigirGraoPermitido("trimestre");
      expect.unreachable("devia ter sido recusado");
    } catch (e) {
      expect((e as GraoProibido).motivo).toBe("breakdown_fora_do_vocabulario");
    }
  });
});

/* ------------------------------------------------------------------ *
 * O que deve passar
 * ------------------------------------------------------------------ */

describe("os recortes legítimos chegam ao adaptador", () => {
  /**
   * A metade que impede o teste de ser vácuo.
   *
   * Uma fronteira que recusasse tudo passaria em todos os testes acima e
   * quebraria o produto inteiro.
   */
  it.each(BREAKDOWNS)("'%s' passa e o adaptador é chamado", async (b) => {
    const { fonte, chamadas } = fonteQueConta();
    const fronteira = fronteiraCom(fonte);

    await fronteira.lerPainel({
      painel: "rh-headcount",
      consulta: CONSULTA,
      breakdown: b,
    });

    expect(chamadas).toEqual(["getPanel"]);
  });

  it("lerKpis passa 'none' explicitamente, e não pula a verificação", async () => {
    const { fonte, chamadas } = fonteQueConta();
    const fronteira = fronteiraCom(fonte);

    await fronteira.lerKpis("rh/visao", CONSULTA);
    expect(chamadas).toEqual(["getKpis"]);
  });
});

/* ------------------------------------------------------------------ *
 * A ordem das verificações
 * ------------------------------------------------------------------ */

describe("escopo e grão são verificados antes do adaptador", () => {
  it("entidade fora do perfil não toca o adaptador", async () => {
    const escopoEstreito = escopoDaSessao({
      ...SESSAO,
      entidades: ["unidade-sp"],
    });
    const fronteira = fronteiraCom(fonteQueNaoPodeSerTocada(), escopoEstreito);

    await expect(
      fronteira.lerPainel({
        painel: "rh-headcount",
        consulta: CONSULTA,
        breakdown: "area",
      }),
    ).rejects.toThrowError(/entidade_fora_do_perfil/);
  });

  it("grão inválido é recusado mesmo quando o escopo permitiria tudo", async () => {
    // Prova que as duas verificações são independentes: um perfil de diretoria,
    // que enxerga tudo, continua sem poder pedir linha de pessoa.
    const fronteira = fronteiraCom(fonteQueNaoPodeSerTocada());

    await expect(
      fronteira.lerPainel({
        painel: "rh-headcount",
        consulta: CONSULTA,
        breakdown: "cpf",
      }),
    ).rejects.toThrowError(GraoProibido);
  });

  it("consulta fora do vocabulário da seção 6.2 também para aqui", async () => {
    const fronteira = fronteiraCom(fonteQueNaoPodeSerTocada());

    await expect(
      fronteira.lerPainel({
        painel: "rh-headcount",
        consulta: { ...CONSULTA, periodo: "18 meses" as never },
        breakdown: "area",
      }),
    ).rejects.toThrow();
  });
});

/* ------------------------------------------------------------------ *
 * Grupo pequeno
 * ------------------------------------------------------------------ */

describe("o piso de cinco pessoas por grupo", () => {
  it("é cinco, como a seção 11 diz", () => {
    expect(MINIMO_DE_PESSOAS_POR_GRUPO).toBe(5);
  });

  it("quatro não exibe, cinco exibe", () => {
    expect(grupoExibivel(4)).toBe(false);
    expect(grupoExibivel(5)).toBe(true);
  });

  it("zero não exibe — e é vazio com motivo, não zero", () => {
    expect(grupoExibivel(0)).toBe(false);
  });
});
