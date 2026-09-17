/* eslint-disable no-restricted-syntax --
 * A regra de T-124 existe para a paleta do produto nao se espalhar pelo
 * codigo. O que aparece aqui e outra coisa: os dois extremos da escala, que
 * nao sao papel de tema, e valores de entrada invalida. Escreve-los por outro
 * caminho esconderia o dado do caso.
 */
import { describe, expect, it } from "vitest";

import {
  ajustarParaContraste,
  contrasteSuficiente,
  CONTRASTE_MAXIMO,
  CONTRASTE_MINIMO,
  corCanonica,
  CorForaDaForma,
  luminancia,
  normalizarCor,
  razaoDeContraste,
} from "@/apresentacao/tema/contraste";
import { PALETA } from "@/apresentacao/tema/tema";

/**
 * A fórmula de contraste da WCAG 2.1 (PRD seção 13) e o ajuste que a marca da
 * empresa vai precisar.
 *
 * Os três valores medidos à mão no cabeçalho de `tema.ts` — 3,91, 2,69 e 4,36
 * — são o melhor caso de teste que existe aqui: foram calculados por outra
 * pessoa, com outra ferramenta, antes deste módulo existir. Se a fórmula
 * estiver errada, eles não batem.
 */

/*
 * Preto e branco não estão na paleta, e não podem estar: a paleta tem papéis,
 * e "branco puro" não é papel nenhum. Aqui eles são os extremos da escala, que
 * é o que fixa os dois limites conhecidos da razão.
 */
const PRETO = "#000000";
const BRANCO = "#ffffff";

/** Um oitavo de tolerância no segundo decimal: os valores medidos vêm arredondados. */
const TOLERANCIA = 0.01;

describe("luminância", () => {
  it("vai de zero no preto a um no branco", () => {
    expect(luminancia(PRETO)).toBe(0);
    expect(luminancia(BRANCO)).toBe(1);
  });

  it("recusa cor fora da forma canônica em vez de adivinhar", () => {
    expect(() => luminancia("#FFF")).toThrow(CorForaDaForma);
    expect(() => luminancia("rgb(0,0,0)")).toThrow(CorForaDaForma);
    expect(() => luminancia(PALETA.marca.toUpperCase())).toThrow(
      CorForaDaForma,
    );
  });
});

describe("razão de contraste", () => {
  it("o maior contraste possível é 21:1, e o menor é 1:1", () => {
    expect(razaoDeContraste(PRETO, BRANCO)).toBeCloseTo(CONTRASTE_MAXIMO, 5);
    expect(razaoDeContraste(BRANCO, BRANCO)).toBe(1);
  });

  it("é simétrica: quem é frente e quem é fundo não muda o número", () => {
    const daFrente = razaoDeContraste(PALETA.marca, PALETA.superficie);
    const doFundo = razaoDeContraste(PALETA.superficie, PALETA.marca);
    expect(daFrente).toBe(doFundo);
  });

  /**
   * As três razões que o cabeçalho de `tema.ts` declara, medidas fora daqui.
   *
   * São também os três tokens que H-43 precisa decidir. Enquanto a decisão não
   * vem, este caso é o que impede alguém de "arrumar" a paleta sem passar por
   * ela: mexer numa dessas cores deixa o teste vermelho com o número na mão.
   */
  it.each([
    ["textoTerciario sobre superfície", "textoTerciario", "superficie", 3.91],
    ["textoFraco sobre superfície", "textoFraco", "superficie", 2.69],
    [
      "textoEmBarraFraco sobre a barra",
      "textoEmBarraFraco",
      "barraLateral",
      4.36,
    ],
  ] as const)(
    "%s dá %s:1, como o tema anotou",
    (_, frente, fundo, esperada) => {
      expect(razaoDeContraste(PALETA[frente], PALETA[fundo])).toBeCloseTo(
        esperada,
        TOLERANCIA,
      );
    },
  );

  it("os pares que já passam continuam passando", () => {
    expect(contrasteSuficiente(PALETA.texto, PALETA.fundo)).toBe(true);
    expect(contrasteSuficiente(PALETA.marca, PALETA.superficie)).toBe(true);
    expect(contrasteSuficiente(PALETA.textoEmBarra, PALETA.barraLateral)).toBe(
      true,
    );
  });

  it("e os três que não passam continuam não passando", () => {
    expect(contrasteSuficiente(PALETA.textoTerciario, PALETA.superficie)).toBe(
      false,
    );
    expect(contrasteSuficiente(PALETA.textoFraco, PALETA.superficie)).toBe(
      false,
    );
  });
});

describe("normalizar a cor que vem de um site", () => {
  it.each([
    ["#FFF", BRANCO],
    ["#fff", BRANCO],
    ["  #6B4A2F  ", PALETA.marca],
    ["rgb(107, 74, 47)", PALETA.marca],
    ["rgb(107 74 47)", PALETA.marca],
    ["rgba(107, 74, 47, 1)", PALETA.marca],
  ])("aceita %s", (bruta, esperada) => {
    expect(normalizarCor(bruta)).toBe(esperada);
  });

  it.each([
    ["transparent"],
    ["currentColor"],
    ["rgba(0, 0, 0, 0)"],
    ["rgba(1, 2, 3, 0.5)"],
    ["rgb(300, 0, 0)"],
    ["#12345"],
    ["azul"],
    [""],
  ])("recusa %s", (bruta) => {
    expect(normalizarCor(bruta)).toBeNull();
  });

  it("tudo que passa pela normalização está na forma canônica", () => {
    for (const bruta of ["#ABC", "rgb(1,2,3)", "#6b4a2f"]) {
      const normalizada = normalizarCor(bruta);
      expect(normalizada).not.toBeNull();
      expect(corCanonica(normalizada ?? "")).toBe(true);
    }
  });

  /**
   * A conferência que impede injeção de CSS.
   *
   * O valor termina dentro de uma folha de estilo, e a política de segurança
   * tem `unsafe-inline` em estilo (H-46). Um valor com chave de fechamento
   * escreveria regra arbitrária na página.
   */
  it("recusa valor que fecharia a regra de estilo", () => {
    expect(normalizarCor("#fff}html{display:none}")).toBeNull();
    expect(corCanonica("#fff}html{display:none}")).toBe(false);
    expect(corCanonica("red")).toBe(false);
  });
});

describe("ajustar para o mínimo", () => {
  it("não toca na cor que já passa", () => {
    const ajuste = ajustarParaContraste(
      "marca",
      PALETA.marca,
      PALETA.superficie,
    );
    expect(ajuste.ajustada).toBe(PALETA.marca);
    expect(ajuste.razaoDepois).toBe(ajuste.razaoAntes);
    expect(ajuste.alcancou).toBe(true);
  });

  it("escurece o que reprova sobre fundo claro, até passar", () => {
    const ajuste = ajustarParaContraste(
      "textoFraco",
      PALETA.textoFraco,
      PALETA.superficie,
    );
    expect(ajuste.razaoAntes).toBeLessThan(CONTRASTE_MINIMO);
    expect(ajuste.razaoDepois).toBeGreaterThanOrEqual(CONTRASTE_MINIMO);
    expect(ajuste.alcancou).toBe(true);
    expect(luminancia(ajuste.ajustada)).toBeLessThan(
      luminancia(PALETA.textoFraco),
    );
  });

  it("clareia o que reprova sobre fundo escuro", () => {
    const ajuste = ajustarParaContraste(
      "textoEmBarraFraco",
      PALETA.textoEmBarraFraco,
      PALETA.barraLateral,
    );
    expect(ajuste.razaoAntes).toBeLessThan(CONTRASTE_MINIMO);
    expect(ajuste.razaoDepois).toBeGreaterThanOrEqual(CONTRASTE_MINIMO);
    expect(luminancia(ajuste.ajustada)).toBeGreaterThan(
      luminancia(PALETA.textoEmBarraFraco),
    );
  });

  /**
   * O ajuste é o **menor** que resolve: a cor da empresa, mexida o mínimo.
   *
   * Um passo a menos na direção do extremo já reprovaria. Sem isto, "ajustar"
   * poderia devolver preto sempre — passaria no teste anterior e entregaria
   * uma marca que não é a marca de ninguém.
   */
  it("desvia o mínimo necessário", () => {
    const ajuste = ajustarParaContraste(
      "textoFraco",
      PALETA.textoFraco,
      PALETA.superficie,
    );
    expect(ajuste.razaoDepois).toBeGreaterThanOrEqual(CONTRASTE_MINIMO);
    expect(ajuste.razaoDepois).toBeLessThan(CONTRASTE_MINIMO + 0.6);
  });

  it("preserva o matiz da cor original", () => {
    const ajuste = ajustarParaContraste(
      "destaqueSuave",
      PALETA.destaqueSuave,
      PALETA.superficie,
    );
    // O canal vermelho continua sendo o mais forte, como no original: o ajuste
    // move luminosidade, não matiz.
    const canal = (cor: string, i: number) =>
      Number.parseInt(cor.slice(1 + i * 2, 3 + i * 2), 16);
    expect(canal(ajuste.ajustada, 0)).toBeGreaterThan(
      canal(ajuste.ajustada, 2),
    );
  });

  it("diz quando nem o extremo alcança o mínimo, em vez de fingir", () => {
    // Fundo de luminância intermediária: nenhuma cor chega a 4,5:1 sobre ele.
    const ajuste = ajustarParaContraste("marca", PALETA.marca, PALETA.neutro);
    expect(ajuste.alcancou).toBe(false);
    expect(ajuste.razaoDepois).toBeLessThan(CONTRASTE_MINIMO);
  });

  it("é determinístico: duas execuções dão a mesma cor", () => {
    const uma = ajustarParaContraste(
      "textoFraco",
      PALETA.textoFraco,
      PALETA.superficie,
    );
    const outra = ajustarParaContraste(
      "textoFraco",
      PALETA.textoFraco,
      PALETA.superficie,
    );
    expect(uma).toEqual(outra);
  });
});
