import { describe, expect, it } from "vitest";

import {
  paragrafosDaResposta,
  ROTULO_DA_TRADUCAO,
} from "@/apresentacao/chat/paragrafos";

/**
 * A resposta em parágrafos, com o "Traduzindo" em destaque (T-441).
 */
describe("paragrafosDaResposta", () => {
  it("separa por linha em branco e por quebra simples, sem parágrafo vazio", () => {
    expect(
      paragrafosDaResposta("Um.\n\nDois.\nTrês.\n\n\n").map((p) => p.texto),
    ).toEqual(["Um.", "Dois.", "Três."]);
  });

  it("o parágrafo que começa com Traduzindo: ganha o rótulo, sem a marca", () => {
    const [primeiro, segundo] = paragrafosDaResposta(
      "A receita foi R$ 1,0 mi.\n\nTraduzindo: cobre os custos fixos.",
    );
    expect(primeiro).toEqual({
      rotulo: null,
      texto: "A receita foi R$ 1,0 mi.",
    });
    expect(segundo).toEqual({
      rotulo: ROTULO_DA_TRADUCAO,
      texto: "cobre os custos fixos.",
    });
  });

  it("quebra antes de Traduzindo: mesmo colado na frase anterior", () => {
    const paragrafos = paragrafosDaResposta(
      "A receita foi R$ 1,0 mi. Traduzindo: cobre os custos fixos. No gráfico, o pico foi em jun/2026.",
    );
    expect(paragrafos.map((p) => p.rotulo)).toEqual([null, ROTULO_DA_TRADUCAO]);
    expect(paragrafos[1]?.texto).toBe(
      "cobre os custos fixos. No gráfico, o pico foi em jun/2026.",
    );
  });

  it("o texto montado, sem marca nenhuma, é um parágrafo só", () => {
    expect(
      paragrafosDaResposta("Receita líquida: R$ 1,0 mi. Fórmula: soma."),
    ).toEqual([
      { rotulo: null, texto: "Receita líquida: R$ 1,0 mi. Fórmula: soma." },
    ]);
  });

  it("Traduzindo: sozinho, sem texto, não vira rótulo vazio", () => {
    expect(paragrafosDaResposta("Traduzindo:")).toEqual([
      { rotulo: null, texto: "Traduzindo:" },
    ]);
  });
});
