import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { lerMetrica } from "@/acesso/leitura";
import { classificar } from "@/chat/classificar";
import { mudaRecorte, type TurnoAnterior } from "@/chat/interpretar";
import { mesNomeado, mesesNomeados } from "@/chat/mes";
import { interpretarComGateway } from "@/chat/openrouter";
import {
  RECUSA_FORA_DO_ASSUNTO,
  divergencias,
  paraOModelo,
  perguntar,
} from "@/chat/perguntar";
import { QUERY_PADRAO } from "@/semantica/contrato";

/**
 * O mês nomeado e a recusa de assunto (`mes.ts`).
 *
 * "Qual o faturamento de março?" respondia os 12 meses: o filtro de período só
 * tem janelas que terminam em dezembro, e a pergunta caía no padrão sem
 * avisar. O número do mês é o ponto de março da série da própria métrica — e
 * o teste confere contra a leitura, e não contra um valor escrito à mão.
 */

beforeAll(() => {
  process.env["DATA_SOURCE"] = "fixtures";
  process.env["AUTH_PROVIDER"] = "fixtures";
});

vi.mock("@/chat/openrouter", () => ({
  gatewayConfigurado: () => true,
  interpretarComGateway: vi.fn(),
  redigirComGateway: vi.fn(async () => null),
}));

afterEach(() => {
  vi.mocked(interpretarComGateway).mockReset();
});

describe("mesesNomeados e mesNomeado", () => {
  it("acha o mês com e sem acento, e a abreviação colada ao ano", () => {
    expect(mesesNomeados("Qual o faturamento do mês de março?")).toEqual([2]);
    expect(mesesNomeados("faturamento de MARCO")).toEqual([2]);
    expect(mesesNomeados("e em mar/2026?")).toEqual([2]);
    expect(mesesNomeados("de janeiro a abril")).toEqual([0, 3]);
    expect(mesesNomeados("março, e março de novo")).toEqual([2]);
  });

  it("não confunde palavra que só começa como mês", () => {
    expect(mesesNomeados("qual o maior cliente?")).toEqual([]);
    expect(mesesNomeados("qual a margem?")).toEqual([]);
    expect(mesesNomeados("como está o setor de vendas?")).toEqual([]);
  });

  it("um mês só vira recorte, com código, rótulo e fechamento", () => {
    expect(mesNomeado("faturamento de março", "2026")).toEqual({
      indice: 2,
      codigo: "2026-03",
      rotulo: "março de 2026",
      fechamento: "2026-03-31",
    });
    expect(mesNomeado("e em fevereiro?", "2025")?.fechamento).toBe(
      "2025-02-28",
    );
  });

  it("dezembro fica com o filtro de período, e dois meses ficam com o laço", () => {
    expect(mesNomeado("e em dezembro?", "2026")).toBeNull();
    expect(mesNomeado("de janeiro a março", "2026")).toBeNull();
    expect(mesNomeado("qual a receita?", "2026")).toBeNull();
  });
});

describe("o classificador e a continuação", () => {
  it("um mês nomeado continua simples; dois viram série", () => {
    expect(classificar("Qual o faturamento de março?").classe).toBe("simples");
    const dois = classificar("Qual a receita de janeiro a março?");
    expect(dois.classe).toBe("composta");
    expect(dois.sinais).toContain("serie");
  });

  it("'E em março?' é mudança de recorte, como 'E em dezembro?'", () => {
    expect(mudaRecorte("E em março?", QUERY_PADRAO)).toBe(true);
  });
});

describe("a pergunta de um mês só", () => {
  it("responde o ponto do mês, e não os 12 meses", async () => {
    vi.mocked(interpretarComGateway).mockResolvedValueOnce({
      metrica: "receita_liquida",
      confianca: 0.95,
      alternativas: [],
    });

    const resposta = await perguntar("Qual o faturamento do mês de março?");
    expect(resposta.tipo).toBe("resposta");
    if (resposta.tipo !== "resposta") return;

    const doAno = await lerMetrica("receita_liquida", QUERY_PADRAO);
    const r = resposta.resolucao;
    expect(r.metrica).toBe("receita_liquida");
    expect(r.mes?.codigo).toBe(`${QUERY_PADRAO.ano}-03`);
    expect(r.valor).toBe(doAno.serie.values[2]);
    expect(r.valor).not.toBe(doAno.value);
    expect(r.asOf).toBe(`${QUERY_PADRAO.ano}-03-31`);
    // O painel é o do ano: o mês se lê no contexto dos outros onze.
    expect(r.acoes.filtros.periodo).toBe("12-meses");
    // Taxa ao ano não se compara com número de um mês.
    expect(r.comparacao).toBeNull();
    expect(r.referencias).toEqual([]);
    expect(resposta.texto).toContain("em março de");
  });

  it("o apoio é o do mesmo mês", async () => {
    vi.mocked(interpretarComGateway).mockResolvedValueOnce({
      metrica: "ebitda",
      confianca: 0.95,
      alternativas: [],
    });

    const resposta = await perguntar("Qual foi o EBITDA de março?");
    expect(resposta.tipo).toBe("resposta");
    if (resposta.tipo !== "resposta") return;

    for (const c of resposta.resolucao.consideracoes) {
      expect(c.origem).toBe("apoio");
      if (c.metrica === undefined || c.metrica === null) continue;
      const lida = await lerMetrica(c.metrica, QUERY_PADRAO);
      expect(c.valor).toBe(lida.serie.values[2] ?? null);
    }
  });

  it("o ano da pergunta escolhe a série", async () => {
    vi.mocked(interpretarComGateway).mockResolvedValueOnce({
      metrica: "receita_liquida",
      confianca: 0.95,
      alternativas: [],
    });

    const resposta = await perguntar(
      "Qual foi o faturamento de março de 2025?",
    );
    expect(resposta.tipo).toBe("resposta");
    if (resposta.tipo !== "resposta") return;

    const de2025 = await lerMetrica("receita_liquida", {
      ...QUERY_PADRAO,
      ano: "2025",
    });
    expect(resposta.resolucao.mes?.codigo).toBe("2025-03");
    expect(resposta.resolucao.valor).toBe(de2025.serie.values[2]);
  });

  it("'E em março?' herda a métrica da conversa", async () => {
    vi.mocked(interpretarComGateway).mockResolvedValueOnce(null);
    const historico: readonly TurnoAnterior[] = [
      { pergunta: "qual a receita líquida", metrica: "receita_liquida" },
    ];

    const resposta = await perguntar("E em março?", QUERY_PADRAO, historico);
    expect(resposta.tipo).toBe("resposta");
    if (resposta.tipo !== "resposta") return;
    expect(resposta.resolucao.metrica).toBe("receita_liquida");
    expect(resposta.resolucao.mes?.indice).toBe(2);
  });

  it("dezembro continua pelo filtro de período", async () => {
    vi.mocked(interpretarComGateway).mockResolvedValueOnce({
      metrica: "receita_liquida",
      confianca: 0.95,
      alternativas: [],
    });

    const resposta = await perguntar("Qual a receita líquida de dezembro?");
    expect(resposta.tipo).toBe("resposta");
    if (resposta.tipo !== "resposta") return;
    expect(resposta.resolucao.mes).toBeUndefined();
    expect(resposta.resolucao.acoes.filtros.periodo).toBe("dezembro");
  });

  it("o modelo recebe o mês, e o verificador aceita o número do mês", async () => {
    vi.mocked(interpretarComGateway).mockResolvedValueOnce({
      metrica: "receita_liquida",
      confianca: 0.95,
      alternativas: [],
    });

    const resposta = await perguntar("Qual o faturamento de março?");
    if (resposta.tipo !== "resposta") throw new Error("esperava resposta");

    const enviado = paraOModelo(resposta.resolucao) as {
      readonly mes: string | null;
      readonly valor: { readonly formatado: string | null };
    };
    expect(enviado.mes).toBe(`março de ${QUERY_PADRAO.ano}`);
    const frase = `Receita líquida foi ${enviado.valor.formatado ?? ""} em ${enviado.mes ?? ""}.`;
    expect(
      divergencias(frase, resposta.resolucao, "Qual o faturamento de março?"),
    ).toEqual([]);
  });
});

describe("a receita contra juros", () => {
  it("não divide a receita por ela mesma", async () => {
    vi.mocked(interpretarComGateway).mockResolvedValueOnce({
      metrica: "receita_liquida",
      confianca: 0.95,
      alternativas: [],
    });

    const resposta = await perguntar("Qual foi a receita líquida?");
    if (resposta.tipo !== "resposta") throw new Error("esperava resposta");
    expect(resposta.resolucao.comparacao).toBeNull();
    expect(resposta.resolucao.comparacaoIndisponivelPorque).toContain(
      "base do retorno",
    );
    expect(resposta.texto).not.toContain("100,0%");
  });

  it("o EBITDA continua lido contra a Selic, quando ela vem", async () => {
    vi.mocked(interpretarComGateway).mockResolvedValueOnce({
      metrica: "ebitda",
      confianca: 0.95,
      alternativas: [],
    });

    const resposta = await perguntar("Qual foi o EBITDA?");
    if (resposta.tipo !== "resposta") throw new Error("esperava resposta");
    const r = resposta.resolucao;
    // Com a Selic lida há comparação; sem rede, o motivo é a Selic, e nunca
    // o da receita.
    if (r.comparacao === null) {
      expect(r.comparacaoIndisponivelPorque).not.toContain("base do retorno");
    } else {
      expect(r.comparacao.familia).toBe("resultado");
    }
  });
});

describe("a pergunta fora do assunto", () => {
  it("recusa dizendo o que o chat responde, sem métricas próximas", async () => {
    vi.mocked(interpretarComGateway).mockResolvedValueOnce({
      metrica: "",
      confianca: 0,
      alternativas: ["enps"],
      foraDoAssunto: true,
    });

    const resposta = await perguntar("Qual a capital da França?");
    expect(resposta.tipo).toBe("recusa");
    if (resposta.tipo !== "recusa") return;
    expect(resposta.texto).toBe(RECUSA_FORA_DO_ASSUNTO);
    expect(resposta.alternativas).toEqual([]);
  });

  it("pergunta de negócio sem métrica continua com as próximas", async () => {
    vi.mocked(interpretarComGateway).mockResolvedValueOnce({
      metrica: "",
      confianca: 0,
      alternativas: ["enps"],
    });

    const resposta = await perguntar("Qual o valor de mercado da empresa?");
    expect(resposta.tipo).toBe("recusa");
    if (resposta.tipo !== "recusa") return;
    expect(resposta.texto).not.toBe(RECUSA_FORA_DO_ASSUNTO);
    expect(resposta.alternativas.map((a) => a.id)).toEqual(["enps"]);
  });

  it("sinônimo do catálogo vence o 'fora do assunto' do modelo", async () => {
    vi.mocked(interpretarComGateway).mockResolvedValueOnce({
      metrica: "",
      confianca: 0,
      alternativas: [],
      foraDoAssunto: true,
    });

    const resposta = await perguntar("qual o turnover");
    expect(resposta.tipo).toBe("resposta");
  });
});
