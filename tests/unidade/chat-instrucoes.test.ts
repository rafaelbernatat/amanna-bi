import { describe, expect, it } from "vitest";

import { INSTRUCAO_DO_LACO } from "@/chat/laco";
import { INSTRUCAO_DE_REDACAO } from "@/chat/openrouter";
import { REGRAS_DE_FORMA, REGRAS_DE_NUMERO } from "@/chat/regras";

/**
 * As duas instruções de redação, depois de a forma passar a seguir a
 * pergunta (T-445).
 *
 * O que se prova aqui não é o texto — texto de prompt muda —, e sim as duas
 * propriedades que Produto pediu e que um retoque futuro desfaria sem querer:
 * nenhuma das duas prescreve estrutura fixa, e as duas continuam carregando
 * as regras de número palavra por palavra. O verificador de RF-15 depende da
 * segunda; o print de 2026-09-19 é a primeira.
 */
const INSTRUCOES: readonly (readonly [string, string])[] = [
  ["a redação do caminho simples", INSTRUCAO_DE_REDACAO],
  ["a instrução do laço", INSTRUCAO_DO_LACO],
];

describe("as instruções de redação", () => {
  it.each(INSTRUCOES)("%s carrega as regras de número inteiras", (_, texto) => {
    expect(texto).toContain(REGRAS_DE_NUMERO);
  });

  it.each(INSTRUCOES)("%s carrega as regras de forma", (_, texto) => {
    expect(texto).toContain(REGRAS_DE_FORMA);
  });

  it.each(INSTRUCOES)("%s manda a forma seguir a pergunta", (_, texto) => {
    expect(texto).toContain("A FORMA SEGUE A PERGUNTA");
  });

  it.each(INSTRUCOES)("%s não prescreve estrutura fixa", (_, texto) => {
    expect(texto).not.toContain("nesta ordem");
    expect(texto).not.toMatch(/sem lista/i);
  });

  it.each(INSTRUCOES)(
    "%s autoriza a lista quando pediram lista",
    (_, texto) => {
      expect(texto).toMatch(
        /uma LISTA, um\s+item por linha começando com "- "/,
      );
    },
  );

  it.each(INSTRUCOES)(
    "%s proíbe a frase que anuncia o que falta",
    (_, texto) => {
      expect(texto).toMatch(/NUNCA (?:ENTRA|escreva o que falta)/);
      expect(texto).toContain("não há comparação disponível");
    },
  );

  it("as regras de número não voltam a mandar na forma", () => {
    expect(REGRAS_DE_NUMERO).not.toMatch(/sem lista|sem título/i);
  });

  it("o 'Traduzindo' deixou de ser obrigatório no caminho simples", () => {
    expect(INSTRUCAO_DE_REDACAO).toContain("O QUE É OPCIONAL");
    expect(INSTRUCAO_DE_REDACAO).not.toMatch(
      /Um parágrafo próprio, que começa exatamente com "Traduzindo:"/,
    );
  });
});
