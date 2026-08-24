/**
 * A repartição exata que sustenta as fixtures (T-110).
 *
 * O defeito que ela impede: partes obtidas multiplicando o total por uma fração
 * e arredondando cada uma **não somam o total**. Sobra ou falta 1, quase
 * sempre — e um dígito é o pior tamanho de erro, pequeno demais para alguém
 * notar na revisão e grande demais para sobreviver à reunião em que o número é
 * questionado.
 *
 * O primeiro teste abaixo mostra o erro acontecendo com o método ingênuo, para
 * que a existência deste módulo fique justificada em teste e não só em prosa.
 */

import { describe, expect, it } from "vitest";

import {
  ajustarMargemDeColuna,
  repartir,
  repartirMatriz,
  ReparticaoImpossivel,
} from "@/acesso/fixtures/reparticao";

const soma = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
const somaMatriz = (m: readonly (readonly number[])[]) =>
  m.reduce((a, l) => a + soma(l), 0);

describe("o método ingênuo perde unidades", () => {
  it("arredondar cada parte por conta própria não fecha o total", () => {
    const pesos = [1, 1, 1];
    const ingenuo = pesos.map((p) => Math.round((10 * p) / 3));
    expect(soma(ingenuo)).not.toBe(10);

    // E o exato fecha.
    expect(soma(repartir(10, pesos))).toBe(10);
  });
});

describe("repartir", () => {
  it("soma exatamente o total, em 200 casos", () => {
    // Uma amostra grande e determinística: o mesmo conjunto toda execução.
    const falhas: string[] = [];
    for (let total = 0; total <= 19; total += 1) {
      for (let partes = 1; partes <= 10; partes += 1) {
        const pesos = Array.from({ length: partes }, (_, i) => i + 1);
        const r = repartir(total, pesos);
        if (soma(r) !== total) falhas.push(`total=${total} partes=${partes}`);
      }
    }
    expect(falhas).toEqual([]);
  });

  it("respeita a proporção: peso maior recebe parte maior ou igual", () => {
    const r = repartir(100, [1, 2, 3, 4]);
    expect(r).toEqual([10, 20, 30, 40]);
  });

  it("peso zero recebe zero", () => {
    expect(repartir(10, [1, 0, 1])).toEqual([5, 0, 5]);
  });

  it("é determinístico — a mesma entrada, a mesma saída (regra 5)", () => {
    const a = repartir(7, [1, 1, 1, 1, 1]);
    const b = repartir(7, [1, 1, 1, 1, 1]);
    expect(a).toEqual(b);
    // O desempate é pelo índice: as sobras vão para as primeiras.
    expect(a).toEqual([2, 2, 1, 1, 1]);
  });

  it("recusa entrada impossível em vez de devolver algo plausível", () => {
    expect(() => repartir(10, [])).toThrow(ReparticaoImpossivel);
    expect(() => repartir(10, [0, 0])).toThrow(ReparticaoImpossivel);
    expect(() => repartir(10, [1, -1])).toThrow(ReparticaoImpossivel);
    expect(() => repartir(1.5, [1])).toThrow(ReparticaoImpossivel);
  });
});

describe("repartirMatriz", () => {
  const LINHAS = [486, 214, 168, 142, 96, 78, 56];
  const COLUNAS = [604, 472, 164];

  it("fecha as duas margens ao mesmo tempo", () => {
    // O caso real: quadro por área e quadro por modalidade precisam somar a
    // mesma empresa. Repartir por área e depois por modalidade dentro de cada
    // área acerta a primeira margem e erra a segunda.
    const m = repartirMatriz(LINHAS, COLUNAS);

    expect(m.map(soma)).toEqual(LINHAS);
    expect(
      COLUNAS.map((_, j) => m.reduce((a, l) => a + (l[j] ?? 0), 0)),
    ).toEqual(COLUNAS);
    expect(somaMatriz(m)).toBe(1240);
  });

  it("todo valor é inteiro e não negativo", () => {
    const m = repartirMatriz(LINHAS, COLUNAS);
    const ruins = m.flat().filter((v) => !Number.isInteger(v) || v < 0);
    expect(ruins).toEqual([]);
  });

  it("recusa margens que não fecham", () => {
    expect(() => repartirMatriz([10, 10], [5, 5, 5])).toThrow(
      ReparticaoImpossivel,
    );
  });

  it("aguenta margem com zero", () => {
    const m = repartirMatriz([5, 0, 5], [4, 6]);
    expect(m.map(soma)).toEqual([5, 0, 5]);
    expect([0, 1].map((j) => m.reduce((a, l) => a + (l[j] ?? 0), 0))).toEqual([
      4, 6,
    ]);
  });
});

describe("ajustarMargemDeColuna", () => {
  it("fecha a terceira margem sem mexer nas linhas", () => {
    /*
     * O caso das horas de treinamento: mês, área e modalidade precisam fechar
     * ao mesmo tempo. `repartirMatriz` acerta duas; esta função fecha a
     * terceira movendo unidades **dentro da mesma linha**.
     */
    const original = [
      [10, 5, 5],
      [8, 6, 6],
      [4, 3, 3],
    ];
    const alvos = [24, 13, 13];
    const ajustada = ajustarMargemDeColuna(original, alvos);

    // As linhas continuam as mesmas.
    expect(ajustada.map(soma)).toEqual(original.map(soma));
    // E as colunas chegaram no alvo.
    expect(
      alvos.map((_, j) => ajustada.reduce((a, l) => a + (l[j] ?? 0), 0)),
    ).toEqual(alvos);
  });

  it("não inventa nem destrói unidades", () => {
    const original = [
      [3, 3],
      [4, 4],
    ];
    const ajustada = ajustarMargemDeColuna(original, [8, 6]);
    expect(somaMatriz(ajustada)).toBe(somaMatriz(original));
  });
});
