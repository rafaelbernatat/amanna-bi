import { describe, expect, it } from "vitest";

import {
  PALETA,
  PARES_DE_CONTRASTE,
  TIPOGRAFIA,
} from "@/apresentacao/tema/tema";

/**
 * O tema tipado de T-124.
 *
 * O criterio de aceite nomeia duas contagens — 24 chaves de paleta e 3 familias
 * tipograficas. Elas ficam aqui como numero, e nao como comentario, para que
 * remover ou acrescentar um token sem intencao reprove o comando.
 */

const HEX = /^#[0-9a-f]{6}$/;

describe("Tema extraido do prototipo", () => {
  it("a paleta tem exatamente 24 chaves", () => {
    expect(Object.keys(PALETA)).toHaveLength(24);
  });

  it("toda cor da paleta e um hexadecimal de 6 digitos em caixa baixa", () => {
    for (const [chave, valor] of Object.entries(PALETA)) {
      expect(valor, `${chave} = ${valor}`).toMatch(HEX);
    }
  });

  it("nenhuma cor da paleta esta repetida em duas chaves", () => {
    const valores = Object.values(PALETA);
    expect(new Set(valores).size, "ha cor duplicada na paleta").toBe(
      valores.length,
    );
  });

  it("as tres familias tipograficas do prototipo existem", () => {
    expect(Object.keys(TIPOGRAFIA)).toHaveLength(3);
    expect(TIPOGRAFIA.texto).toContain("IBM Plex Sans");
    expect(TIPOGRAFIA.mono).toContain("IBM Plex Mono");
    expect(TIPOGRAFIA.titulo).toContain("Newsreader");
  });

  it("toda familia declara ao menos uma alternativa de sistema", () => {
    for (const [chave, pilha] of Object.entries(TIPOGRAFIA)) {
      expect(
        pilha.split(",").length,
        `${chave} sem alternativa`,
      ).toBeGreaterThan(1);
    }
  });

  it("todo par de contraste declarado aponta para chaves que existem", () => {
    for (const par of PARES_DE_CONTRASTE) {
      expect(PALETA[par.frente], par.frente).toBeDefined();
      expect(PALETA[par.fundo], par.fundo).toBeDefined();
    }
  });
});
