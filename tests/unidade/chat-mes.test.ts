import { beforeAll, describe, expect, it } from "vitest";

import type { PontoDoResumo } from "@/chat/grafico";
import type { TurnoAnterior } from "@/chat/interpretar";
import {
  mesDaPergunta,
  mesDoRotulo,
  mesValido,
  pedeOPeriodoInteiro,
  pontoDoMes,
  rotuloDoMes,
  semMes,
} from "@/chat/mes";
import {
  comOMesPedido,
  montarTexto,
  numerosPermitidosDe,
  paraOModelo,
  resolverPergunta,
} from "@/chat/perguntar";
import { resolver } from "@/chat/resolver";
import { QUERY_PADRAO } from "@/semantica/contrato";

/**
 * O mês que a pergunta nomeia abre a resposta (T-439).
 *
 * "Quanto faturamos em abril?" abria com o total de doze meses. O recorte da
 * URL não tem abril, mas a série mensal por trás de toda métrica tem, e o
 * ponto de abril é o número que a pergunta pediu.
 */

beforeAll(() => {
  process.env["DATA_SOURCE"] = "fixtures";
  process.env["AUTH_PROVIDER"] = "fixtures";
});

describe("mesDaPergunta", () => {
  it("reconhece o mês por extenso, com e sem ano, e abreviado com ano", () => {
    expect(mesDaPergunta("Quanto faturamos em abril?")).toEqual({
      mes: 4,
      ano: null,
    });
    expect(mesDaPergunta("e em março de 2025?")).toEqual({ mes: 3, ano: 2025 });
    expect(mesDaPergunta("receita em Setembro/2026")).toEqual({
      mes: 9,
      ano: 2026,
    });
    expect(mesDaPergunta("como foi abr/2026?")).toEqual({ mes: 4, ano: 2026 });
  });

  it("não vê mês onde não há: abreviação solta e palavras parecidas", () => {
    expect(mesDaPergunta("qual o turnover?")).toBeNull();
    // "mar" e "set" são palavras comuns; a abreviação só vale com o ano.
    expect(mesDaPergunta("o que está no mar e no set?")).toBeNull();
    expect(mesDaPergunta("a margem de marketing")).toBeNull();
  });
});

describe("pontoDoMes", () => {
  const ponto = (rotulo: string, valor: number): PontoDoResumo => ({
    rotulo,
    valor,
    unidade: "BRL_mi",
    formatado: `R$ ${String(valor)} mi`,
  });
  const serie = [
    ponto("abr/2025", 90),
    ponto("mai/2025", 91),
    ponto("abr/2026", 101),
  ];

  it("sem ano vale o mais recente; com ano, o do ano", () => {
    expect(pontoDoMes(serie, { mes: 4, ano: null })?.rotulo).toBe("abr/2026");
    expect(pontoDoMes(serie, { mes: 4, ano: 2025 })?.rotulo).toBe("abr/2025");
    expect(pontoDoMes(serie, { mes: 6, ano: null })).toBeNull();
    expect(pontoDoMes(serie, { mes: 4, ano: 2024 })).toBeNull();
  });

  it("acha o mês também no rótulo com série ao lado", () => {
    expect(
      pontoDoMes([ponto("abr/2026 · Ano atual", 5)], { mes: 4, ano: null })
        ?.valor,
    ).toBe(5);
  });
});

describe("a resolução com o mês pedido", () => {
  it("a série mensal vem com doze pontos rotulados, alinhada ao recorte", async () => {
    const r = await resolver("receita_liquida", QUERY_PADRAO);
    expect(r.serieMensal).toHaveLength(12);
    expect(r.serieMensal.map((p) => p.rotulo.slice(0, 4))).toEqual([
      "jan/",
      "fev/",
      "mar/",
      "abr/",
      "mai/",
      "jun/",
      "jul/",
      "ago/",
      "set/",
      "out/",
      "nov/",
      "dez/",
    ]);
    expect(r.pontoPedido).toBeNull();
  });

  it("'Qual foi a receita líquida em abril?' abre com abril, e o recorte vem depois", async () => {
    const pergunta = "Qual foi a receita líquida em abril?";
    const resolvida = await resolverPergunta(pergunta);
    expect(resolvida.tipo).toBe("resolvida");
    if (resolvida.tipo !== "resolvida") return;
    const r = resolvida.resolucao;
    expect(r.metrica).toBe("receita_liquida");
    expect(r.pontoPedido?.rotulo).toMatch(/^abr\/20\d{2}$/);
    expect(r.pontoPedido?.formatado).not.toBeNull();

    const texto = montarTexto(r, pergunta);
    expect(
      texto.startsWith(`Receita líquida em ${r.pontoPedido?.rotulo ?? ""}:`),
    ).toBe(true);
    expect(texto).toContain("Receita líquida no recorte inteiro:");

    // O ponto pedido é livre para o texto; os outros meses, só com rótulo.
    const permitidos = numerosPermitidosDe(r, pergunta);
    expect(permitidos).toContain(r.pontoPedido?.formatado ?? "");
    for (const ponto of r.serieMensal) {
      if (ponto.formatado !== null)
        expect(permitidos).toContain(ponto.formatado);
    }

    const envelope = paraOModelo(r) as {
      pontoPedido: { rotulo: string; valor: string | null } | null;
      serieMensal: readonly { rotulo: string; valor: string | null }[];
    };
    expect(envelope.pontoPedido?.rotulo).toBe(r.pontoPedido?.rotulo);
    expect(envelope.serieMensal).toHaveLength(12);
  });

  it("sem mês na pergunta a resolução volta como veio", async () => {
    const r = await resolver("receita_liquida", QUERY_PADRAO);
    expect(comOMesPedido(r, "Qual a receita líquida do ano?")).toBe(r);
  });

  it("a receita não se compara com a Selic: é a base do retorno (T-440)", async () => {
    const r = await resolver("receita_liquida", QUERY_PADRAO);
    expect(r.familia).toBeNull();
    expect(r.comparacao).toBeNull();
    expect(r.comparacaoIndisponivelPorque).toContain(
      "receita, saldo, caixa ou custo",
    );
    expect(montarTexto(r, "Qual a receita líquida?")).not.toContain(
      "Retorno sobre a receita",
    );
  });
});

describe("a conversa herda o mês (T-443)", () => {
  const ABRIL: readonly TurnoAnterior[] = [
    {
      pergunta: "Qual a receita líquida em abril?",
      metrica: "receita_liquida",
      mes: { mes: 4, ano: 2026 },
      filtros: QUERY_PADRAO,
    },
  ];

  it("o rótulo do ponto diz o mês, e o mês vira rótulo", () => {
    expect(mesDoRotulo("abr/2026")).toEqual({ mes: 4, ano: 2026 });
    expect(mesDoRotulo("abr/2026 · Ano atual")).toEqual({ mes: 4, ano: 2026 });
    expect(mesDoRotulo("Total")).toBeNull();
    expect(rotuloDoMes({ mes: 4, ano: 2026 })).toBe("abr/2026");
    expect(rotuloDoMes({ mes: 3, ano: null })).toBe("março");
  });

  it("o mês que chega do navegador é conferido campo a campo", () => {
    expect(mesValido({ mes: 4, ano: 2026 })).toBe(true);
    expect(mesValido({ mes: 4, ano: null })).toBe(true);
    expect(mesValido({ mes: 13, ano: 2026 })).toBe(false);
    expect(mesValido({ mes: "4", ano: 2026 })).toBe(false);
    expect(mesValido({ mes: 4, ano: 1999 })).toBe(false);
    expect(mesValido(null)).toBe(false);
  });

  it("sem o mês sobra o resto; e o período inteiro é reconhecido", () => {
    expect(semMes("e em maio?").replace(/\s+/g, " ").trim()).toBe("e em ?");
    expect(semMes("e a receita bruta em abr/2026?")).toContain("receita bruta");
    expect(pedeOPeriodoInteiro("E no ano todo?")).toBe(true);
    expect(pedeOPeriodoInteiro("e nos 12 meses?")).toBe(true);
    expect(pedeOPeriodoInteiro("qual o turnover?")).toBe(false);
  });

  it("'E a receita bruta?' depois de abril é a receita bruta de abril, dita como herdada", async () => {
    const resolvida = await resolverPergunta(
      "E a receita bruta?",
      QUERY_PADRAO,
      ABRIL,
    );
    expect(resolvida.tipo).toBe("resolvida");
    if (resolvida.tipo !== "resolvida") return;
    const r = resolvida.resolucao;
    expect(r.metrica).toBe("receita_bruta");
    expect(r.pontoPedido?.rotulo).toMatch(/^abr\/20\d{2}$/);
    expect(r.pontoPedido?.herdado).toBe(true);
    expect(montarTexto(r, "E a receita bruta?")).toContain(
      "como na pergunta anterior",
    );
    const envelope = paraOModelo(r) as {
      pontoPedido: { herdado: boolean } | null;
    };
    expect(envelope.pontoPedido?.herdado).toBe(true);
  });

  it("'E em maio?' herda a métrica e troca o mês; o mês próprio não é herdado", async () => {
    const resolvida = await resolverPergunta("E em maio?", QUERY_PADRAO, ABRIL);
    expect(resolvida.tipo).toBe("resolvida");
    if (resolvida.tipo !== "resolvida") return;
    expect(resolvida.resolucao.metrica).toBe("receita_liquida");
    expect(resolvida.resolucao.pontoPedido?.rotulo).toMatch(/^mai\//);
    expect(resolvida.resolucao.pontoPedido?.herdado).toBeUndefined();
  });

  it("'E no ano todo?' herda a métrica, volta aos doze meses e solta o mês", async () => {
    const resolvida = await resolverPergunta(
      "E no ano todo?",
      QUERY_PADRAO,
      ABRIL,
    );
    expect(resolvida.tipo).toBe("resolvida");
    if (resolvida.tipo !== "resolvida") return;
    expect(resolvida.resolucao.metrica).toBe("receita_liquida");
    expect(resolvida.resolucao.acoes.filtros.periodo).toBe("12-meses");
    expect(resolvida.resolucao.pontoPedido).toBeNull();
  });

  it("'E em dezembro?' é período do vocabulário: sem mês herdado", async () => {
    const resolvida = await resolverPergunta(
      "E em dezembro?",
      QUERY_PADRAO,
      ABRIL,
    );
    expect(resolvida.tipo).toBe("resolvida");
    if (resolvida.tipo !== "resolvida") return;
    expect(resolvida.resolucao.metrica).toBe("receita_liquida");
    expect(resolvida.resolucao.acoes.filtros.periodo).toBe("dezembro");
    expect(resolvida.resolucao.pontoPedido?.herdado).toBeUndefined();
  });

  it("sem resposta anterior com mês, nada é herdado", async () => {
    const resolvida = await resolverPergunta(
      "E a receita bruta?",
      QUERY_PADRAO,
      [{ pergunta: "Qual a receita líquida?", metrica: "receita_liquida" }],
    );
    expect(resolvida.tipo).toBe("resolvida");
    if (resolvida.tipo !== "resolvida") return;
    expect(resolvida.resolucao.pontoPedido).toBeNull();
  });
});
