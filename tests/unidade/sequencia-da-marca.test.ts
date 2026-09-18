/* eslint-disable no-restricted-syntax --
 * A regra de T-124 existe para a paleta do produto nao se espalhar pelo
 * codigo. O que aparece aqui e a cor que uma empresa escolheria no seletor —
 * inclusive o caso ruim, cinco tons do mesmo azul. Nenhuma delas e papel de
 * tema, e e justamente isso que os casos medem.
 */
import { describe, expect, it } from "vitest";

import { razaoDeContraste } from "@/apresentacao/tema/contraste";
import {
  corDaCategoria,
  corPrincipal,
  corSecundaria,
  SEQUENCIA_CATEGORICA,
  sequenciaCategorica,
} from "@/apresentacao/tema/sequencia";
import { PALETA_CLARA, type CoresDaMarca } from "@/apresentacao/tema/tema";

/**
 * A rampa dos gráficos segue a marca (T-370).
 *
 * Ela sempre foi feita dos papéis de marca — quatro das oito entradas —, mas
 * lia os valores fixos do tema, e por isso aplicar uma marca recolorava a
 * moldura e deixava os gráficos como estavam. O que estes casos fixam é a
 * substituição, e os dois limites dela: as cores de **sentido** não mudam, e
 * duas cores que ninguém distingue não entram juntas.
 */

const AZUIS: CoresDaMarca = {
  marca: "#0b5cff",
  marcaEscura: "#06308a",
  destaque: "#4f8cff",
  destaqueSuave: "#b8d0ff",
  barraLateral: "#f2f6ff",
};

/** Cinco tons quase idênticos: o caso que quebra a leitura. */
const TUDO_IGUAL: CoresDaMarca = {
  marca: "#0b5cff",
  marcaEscura: "#0b5cfe",
  destaque: "#0b5dff",
  destaqueSuave: "#0c5cff",
  barraLateral: "#0b5cff",
};

describe("a rampa categórica com marca aplicada", () => {
  it("sem marca, é exatamente a de sempre", () => {
    expect(sequenciaCategorica(null)).toEqual(SEQUENCIA_CATEGORICA);
    expect(sequenciaCategorica(undefined)).toEqual(SEQUENCIA_CATEGORICA);
    expect(corDaCategoria(0)).toBe(PALETA_CLARA.marca);
  });

  it("com marca, as quatro entradas de marca passam a ser as da empresa", () => {
    const rampa = sequenciaCategorica(AZUIS);
    expect(rampa[0]).toBe(AZUIS.marca);
    expect(rampa[1]).toBe(AZUIS.destaque);
    expect(rampa[3]).toBe(AZUIS.destaqueSuave);
    expect(rampa[4]).toBe(AZUIS.marcaEscura);
    expect(corPrincipal(AZUIS)).toBe(AZUIS.marca);
    expect(corSecundaria(AZUIS)).toBe(AZUIS.marcaEscura);
  });

  /**
   * As cores de sentido ficam.
   *
   * E a mesma razao de D-MARCA: deixar o cliente escolher a cor de "prejuizo"
   * seria dar a marca o poder de mudar o que um numero significa (secao 13).
   */
  it("as cores de sentido não mudam com a marca", () => {
    const rampa = sequenciaCategorica(AZUIS);
    expect(rampa[2]).toBe(PALETA_CLARA.comparacao);
    expect(rampa[5]).toBe(PALETA_CLARA.positivo);
    expect(rampa[6]).toBe(PALETA_CLARA.neutro);
    expect(rampa[7]).toBe(PALETA_CLARA.meta);
  });

  it("uma marca de cinco tons iguais não vira fatias indistinguíveis", () => {
    const rampa = sequenciaCategorica(TUDO_IGUAL);
    const daMarca = [rampa[0], rampa[1], rampa[3], rampa[4]];
    for (let i = 0; i < daMarca.length; i += 1) {
      for (let j = i + 1; j < daMarca.length; j += 1) {
        expect(
          razaoDeContraste(daMarca[i] ?? "", daMarca[j] ?? ""),
          `${String(i)} contra ${String(j)}`,
        ).toBeGreaterThanOrEqual(1.2);
      }
    }
  });

  it("dá a volta quando as partes passam de oito, como antes", () => {
    expect(corDaCategoria(8, AZUIS)).toBe(corDaCategoria(0, AZUIS));
    expect(corDaCategoria(9, AZUIS)).toBe(corDaCategoria(1, AZUIS));
  });
});
