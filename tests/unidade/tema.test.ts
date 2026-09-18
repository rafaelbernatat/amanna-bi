import { describe, expect, it } from "vitest";

import {
  PALETA,
  PALETA_CLARA,
  PALETA_ESCURA,
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

  /**
   * As duas peles sao literais; a `PALETA` que a moldura le, nao.
   *
   * Desde T-372 a tabela que os componentes leem e uma camada de `var()`, para
   * a tela inteira trocar de tema sem que nenhum ponto que pinta saiba disso.
   * O hexadecimal continua existindo — e obrigatorio — nas duas peles, porque
   * e delas que saem a conta de contraste e a cor que vai para atributo de SVG.
   */
  it.each([
    ["clara", PALETA_CLARA],
    ["escura", PALETA_ESCURA],
  ])(
    "toda cor da pele %s e hexadecimal de 6 digitos em caixa baixa",
    (_, pele) => {
      for (const [chave, valor] of Object.entries(pele)) {
        expect(valor, `${chave} = ${valor}`).toMatch(HEX);
      }
    },
  );

  it("as duas peles nomeiam exatamente os mesmos papeis", () => {
    expect(Object.keys(PALETA_ESCURA).sort()).toEqual(
      Object.keys(PALETA_CLARA).sort(),
    );
  });

  it("a camada que a moldura le aponta para a pele, com recuo claro", () => {
    for (const [chave, valor] of Object.entries(PALETA)) {
      expect(valor, chave).toContain(`var(--bi-${chave}`);
      expect(valor, chave).toContain(
        PALETA_CLARA[chave as keyof typeof PALETA_CLARA],
      );
    }
  });

  it("nenhuma cor da pele clara esta repetida em duas chaves", () => {
    const valores = Object.values(PALETA_CLARA);
    expect(new Set(valores).size, "ha cor duplicada na paleta").toBe(
      valores.length,
    );
  });

  /**
   * Tres familias, e todas de sistema.
   *
   * O tema anterior nomeava IBM Plex e Newsreader sem nunca as carregar — nao
   * havia `@font-face` nem link no documento —, entao o produto ja rodava em
   * fonte de sistema, so que sem escolher qual e sem dizer isso em lugar
   * nenhum. As pilhas de T-373 vem do painel de referencia e escolhem de
   * propria: nenhum arquivo para servir, nenhuma requisicao antes do primeiro
   * texto, nada que dependa de rede numa apresentacao.
   *
   * O caso guarda a propriedade que importa — serem de sistema —, e nao os
   * nomes, que Produto pode trocar.
   */
  it("as tres familias existem e nao pedem download", () => {
    expect(Object.keys(TIPOGRAFIA)).toHaveLength(3);
    for (const [chave, pilha] of Object.entries(TIPOGRAFIA)) {
      expect(pilha, `${chave} sem pilha de sistema`).toMatch(
        /system-ui|-apple-system|ui-monospace/,
      );
    }
    expect(TIPOGRAFIA.mono).toContain("ui-monospace");
    expect(TIPOGRAFIA.titulo).not.toBe(TIPOGRAFIA.texto);
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
