import { describe, expect, it } from "vitest";

import {
  blocosDaResposta,
  ROTULO_DA_TRADUCAO,
} from "@/apresentacao/chat/paragrafos";

/**
 * A resposta em blocos, com o "Traduzindo" em destaque (T-441) e a lista
 * desenhada como lista (T-444).
 */
describe("blocosDaResposta", () => {
  it("separa por linha em branco e por quebra simples, sem bloco vazio", () => {
    expect(
      blocosDaResposta("Um.\n\nDois.\nTrês.\n\n\n").map((b) =>
        b.tipo === "paragrafo" ? b.texto : "",
      ),
    ).toEqual(["Um.", "Dois.", "Três."]);
  });

  it("o parágrafo que começa com Traduzindo: ganha o rótulo, sem a marca", () => {
    const [primeiro, segundo] = blocosDaResposta(
      "A receita foi R$ 1,0 mi.\n\nTraduzindo: cobre os custos fixos.",
    );
    expect(primeiro).toEqual({
      tipo: "paragrafo",
      rotulo: null,
      texto: "A receita foi R$ 1,0 mi.",
    });
    expect(segundo).toEqual({
      tipo: "paragrafo",
      rotulo: ROTULO_DA_TRADUCAO,
      texto: "cobre os custos fixos.",
    });
  });

  it("quebra antes de Traduzindo: mesmo colado na frase anterior", () => {
    const blocos = blocosDaResposta(
      "A receita foi R$ 1,0 mi. Traduzindo: cobre os custos fixos. No gráfico, o pico foi em jun/2026.",
    );
    expect(
      blocos.map((b) => (b.tipo === "paragrafo" ? b.rotulo : "lista")),
    ).toEqual([null, ROTULO_DA_TRADUCAO]);
    expect(blocos[1]).toEqual({
      tipo: "paragrafo",
      rotulo: ROTULO_DA_TRADUCAO,
      texto: "cobre os custos fixos. No gráfico, o pico foi em jun/2026.",
    });
  });

  it("o texto montado, sem marca nenhuma, é um bloco só", () => {
    expect(
      blocosDaResposta("Receita líquida: R$ 1,0 mi. Fórmula: soma."),
    ).toEqual([
      {
        tipo: "paragrafo",
        rotulo: null,
        texto: "Receita líquida: R$ 1,0 mi. Fórmula: soma.",
      },
    ]);
  });

  it("Traduzindo: sozinho, sem texto, não vira rótulo vazio", () => {
    expect(blocosDaResposta("Traduzindo:")).toEqual([
      { tipo: "paragrafo", rotulo: null, texto: "Traduzindo:" },
    ]);
  });

  it("linhas de item consecutivas viram um bloco de lista só", () => {
    expect(
      blocosDaResposta(
        "- Aluguel de equipamentos: R$ 12,0 mi\n- Fretes: R$ 8,3 mi\n- Marketing: R$ 5,1 mi",
      ),
    ).toEqual([
      {
        tipo: "lista",
        itens: [
          { rotulo: "Aluguel de equipamentos", valor: "R$ 12,0 mi" },
          { rotulo: "Fretes", valor: "R$ 8,3 mi" },
          { rotulo: "Marketing", valor: "R$ 5,1 mi" },
        ],
      },
    ]);
  });

  it("a lista colada a um parágrafo antes e outro depois fica no meio", () => {
    expect(
      blocosDaResposta(
        "As três maiores despesas de jun/2026:\n- Fretes: R$ 8,3 mi\n- Marketing: R$ 5,1 mi\nQuer abrir por centro de custo?",
      ).map((b) => b.tipo),
    ).toEqual(["paragrafo", "lista", "paragrafo"]);
  });

  it("o item sem valor fica só com o rótulo, e o traço não sobra no texto", () => {
    expect(blocosDaResposta("- Paula Barbosa Tavares\n- Rui Alves")).toEqual([
      {
        tipo: "lista",
        itens: [
          { rotulo: "Paula Barbosa Tavares", valor: null },
          { rotulo: "Rui Alves", valor: null },
        ],
      },
    ]);
  });

  it("número negativo no começo da linha não é item de lista", () => {
    expect(blocosDaResposta("-R$ 2,3 mi no mês.")).toEqual([
      { tipo: "paragrafo", rotulo: null, texto: "-R$ 2,3 mi no mês." },
    ]);
  });
});
