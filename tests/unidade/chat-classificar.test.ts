import { describe, expect, it } from "vitest";

import { classificar, sinaisDe } from "@/chat/classificar";
import { interpretarLocalmente } from "@/chat/interpretar";
import { sugestoesApos } from "@/chat/perguntar";
import type { Resolucao } from "@/chat/resolver";
import { SUGESTOES_DA_TELA } from "@/chat/sugestoes";
import { QUERY_PADRAO } from "@/semantica/contrato";

/**
 * Simples ou composta, decidido antes do gateway (D-CHAT-ferramentas, T-350).
 *
 * O que se prova: as 39 sugestões das telas e as sugestões de continuação
 * ficam no caminho simples — é o que elas prometem, com ou sem gateway — e
 * as perguntas que pedem ranking, série, variação, comparação ou gráfico vão
 * ao laço.
 */

function classe(pergunta: string) {
  return classificar(pergunta, interpretarLocalmente(pergunta, QUERY_PADRAO))
    .classe;
}

describe("as sugestões continuam simples", () => {
  const todas = Object.values(SUGESTOES_DA_TELA).flat();

  it("são trinta e nove", () => {
    expect(todas).toHaveLength(39);
  });

  it.each(todas)("%s", (pergunta) => {
    expect(classe(pergunta)).toBe("simples");
  });

  it("as sugestões de continuação também", () => {
    const r: Resolucao = {
      metrica: "roe",
      rotulo: "ROE",
      valor: 8.3,
      unidade: "pct",
      formula: "lucro / patrimônio",
      decisao: null,
      asOf: "2026-12-31",
      consideracoes: [
        {
          rotulo: "Lucro líquido",
          valor: 12,
          unidade: "BRL_mi",
          origem: "apoio",
          metrica: "lucro_liquido",
        },
      ],
      familia: "retorno",
      referencias: [],
      comparacao: null,
      comparacaoIndisponivelPorque: null,
      acoes: { filtros: QUERY_PADRAO, tela: "fin/visao", painel: null },
      fontes: ["vw_fato_fin_mes"],
      painel: null,
      leituras: [],
      caminho: "simples",
    };
    for (const sugestao of sugestoesApos(r)) {
      expect(classe(sugestao), sugestao).toBe("simples");
    }
  });
});

describe("o que vai ao laço", () => {
  it.each([
    ["Top 5 clientes por receita", "ranking"],
    ["Quais fornecedores concentram mais contas a pagar?", "ranking"],
    ["Qual foi o pior mês de receita?", "serie"],
    ["Como a receita evoluiu ao longo do ano?", "serie"],
    ["A receita cresceu em relação a 2025?", "variacao"],
    ["Compare a margem líquida com o turnover", "comparacao"],
    ["O que esse gráfico mostra?", "grafico"],
    ["Explica esse painel", "grafico"],
    ["Quais métricas você sabe responder?", "catalogo"],
  ] as const)("%s é composta por %s", (pergunta, sinal) => {
    const c = classificar(
      pergunta,
      interpretarLocalmente(pergunta, QUERY_PADRAO),
    );
    expect(c.classe).toBe("composta");
    expect(c.sinais).toContain(sinal);
  });

  it("'por que' sozinho fica simples: não há ferramenta de causa", () => {
    expect(sinaisDe("Por que o EBITDA caiu?")).toContain("causa");
    expect(classe("Por que o EBITDA caiu?")).toBe("simples");
  });

  it("o sinal que está no nome da métrica é descontado", () => {
    // "por área" é o nome da métrica, não um pedido de ranking.
    expect(classe("Como está o engajamento por área?")).toBe("simples");
    // "10 maiores clientes" é a concentração, uma métrica do catálogo.
    expect(classe("Qual a concentração nos 10 maiores clientes?")).toBe(
      "simples",
    );
  });

  it("sem palpite confiante, o mesmo sinal conta", () => {
    expect(classificar("Como está por área?", null).classe).toBe("composta");
  });
});

describe("os sinais de T-435", () => {
  it.each([
    ["Como a receita evoluiu nos últimos 12 meses?", "serie"],
    ["Qual o histórico da margem EBITDA?", "serie"],
    ["Como a receita se distribui por segmento?", "decomposicao"],
    ["Como se decompõe o custo de pessoal?", "decomposicao"],
    ["Quais clientes concentram a receita?", "ranking"],
    ["Qual a participação de cada cliente na receita?", "ranking"],
  ] as const)("%s é composta por %s", (pergunta, sinal) => {
    const c = classificar(
      pergunta,
      interpretarLocalmente(pergunta, QUERY_PADRAO),
    );
    expect(c.classe).toBe("composta");
    expect(c.sinais).toContain(sinal);
  });

  it("'E por área?' depois de uma resposta é composta: o laço herda a métrica pela conversa", () => {
    const c = classificar("E por área?", null);
    expect(c.classe).toBe("composta");
    expect(c.sinais).toContain("ranking");
  });
});

describe("a variação de outra métrica", () => {
  /*
   * "cresceu" está no vocabulário de `crescimento_yoy`, e o desconto mandava
   * "o EBITDA cresceu?" ao caminho simples — que respondia o crescimento da
   * receita a quem perguntou do EBITDA (2026-09-18).
   */
  it("'O EBITDA cresceu em relação ao ano anterior?' vai ao laço", () => {
    const pergunta = "O EBITDA cresceu em relação ao ano anterior?";
    const c = classificar(
      pergunta,
      interpretarLocalmente(pergunta, QUERY_PADRAO),
    );
    expect(c.classe).toBe("composta");
    expect(c.sinais).toContain("variacao");
  });

  it("sem outra métrica na pergunta, o crescimento continua simples", () => {
    const pergunta = "Quanto crescemos sobre o ano anterior?";
    const c = classificar(
      pergunta,
      interpretarLocalmente(pergunta, QUERY_PADRAO),
    );
    expect(c.classe).toBe("simples");
  });
});
