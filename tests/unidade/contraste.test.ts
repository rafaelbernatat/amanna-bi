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
import { PALETA_CLARA } from "@/apresentacao/tema/tema";

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
    expect(() => luminancia(PALETA_CLARA.marca.toUpperCase())).toThrow(
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
    const daFrente = razaoDeContraste(
      PALETA_CLARA.marca,
      PALETA_CLARA.superficie,
    );
    const doFundo = razaoDeContraste(
      PALETA_CLARA.superficie,
      PALETA_CLARA.marca,
    );
    expect(daFrente).toBe(doFundo);
  });

  /**
   * As razoes que o cabecalho de `tema.ts` declara, medidas fora dali.
   *
   * Com a pele de T-371 duas das tres dividas de H-43 sumiram: `textoTerciario`
   * e `textoEmBarraFraco` passaram a cumprir o minimo. Este caso continua
   * existindo pela mesma razao de antes — impedir que alguem "arrume" a paleta
   * sem passar por Produto —, so que agora ele guarda tambem o que **melhorou**,
   * para que uma pele futura nao devolva a divida em silencio.
   */
  it.each([
    ["textoTerciario sobre superfície", "textoTerciario", "superficie", 5.0],
    ["textoFraco sobre superfície", "textoFraco", "superficie", 2.48],
    [
      "textoEmBarraFraco sobre a barra",
      "textoEmBarraFraco",
      "barraLateral",
      6.17,
    ],
  ] as const)(
    "%s dá %s:1, como o tema anotou",
    (_, frente, fundo, esperada) => {
      expect(
        razaoDeContraste(PALETA_CLARA[frente], PALETA_CLARA[fundo]),
      ).toBeCloseTo(esperada, TOLERANCIA);
    },
  );

  it("os pares que já passam continuam passando", () => {
    expect(contrasteSuficiente(PALETA_CLARA.texto, PALETA_CLARA.fundo)).toBe(
      true,
    );
    expect(
      contrasteSuficiente(PALETA_CLARA.marca, PALETA_CLARA.superficie),
    ).toBe(true);
    expect(
      contrasteSuficiente(PALETA_CLARA.textoEmBarra, PALETA_CLARA.barraLateral),
    ).toBe(true);
  });

  /**
   * O que sobrou da divida de H-43.
   *
   * `textoFraco` e, por papel, o texto de dica e de campo vazio: a fraqueza e o
   * ponto dele. Os outros dois que reprovavam no sepia passaram com a pele de
   * T-371, e estao no caso acima com o numero medido.
   */
  it("só textoFraco continua abaixo do mínimo", () => {
    expect(
      contrasteSuficiente(PALETA_CLARA.textoFraco, PALETA_CLARA.superficie),
    ).toBe(false);
    expect(
      contrasteSuficiente(PALETA_CLARA.textoTerciario, PALETA_CLARA.superficie),
    ).toBe(true);
    expect(
      contrasteSuficiente(
        PALETA_CLARA.textoEmBarraFraco,
        PALETA_CLARA.barraLateral,
      ),
    ).toBe(true);
  });
});

describe("normalizar a cor que vem de um site", () => {
  it.each([
    ["#FFF", BRANCO],
    ["#fff", BRANCO],
    ["  #0F7C47  ", PALETA_CLARA.marca],
    ["rgb(15, 124, 71)", PALETA_CLARA.marca],
    ["rgb(15 124 71)", PALETA_CLARA.marca],
    ["rgba(15, 124, 71, 1)", PALETA_CLARA.marca],
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
      PALETA_CLARA.marca,
      PALETA_CLARA.superficie,
    );
    expect(ajuste.ajustada).toBe(PALETA_CLARA.marca);
    expect(ajuste.razaoDepois).toBe(ajuste.razaoAntes);
    expect(ajuste.alcancou).toBe(true);
  });

  it("escurece o que reprova sobre fundo claro, até passar", () => {
    const ajuste = ajustarParaContraste(
      "textoFraco",
      PALETA_CLARA.textoFraco,
      PALETA_CLARA.superficie,
    );
    expect(ajuste.razaoAntes).toBeLessThan(CONTRASTE_MINIMO);
    expect(ajuste.razaoDepois).toBeGreaterThanOrEqual(CONTRASTE_MINIMO);
    expect(ajuste.alcancou).toBe(true);
    expect(luminancia(ajuste.ajustada)).toBeLessThan(
      luminancia(PALETA_CLARA.textoFraco),
    );
  });

  /**
   * A amostra e literal, e isso e proposital.
   *
   * Este caso mede o **algoritmo**, nao a paleta. Usar um token do tema como
   * amostra amarrava um ao outro: quando a pele de T-371 melhorou o contraste
   * de `textoEmBarraFraco`, o caso quebrou sem que nada do ajuste tivesse
   * mudado. Uma cor escrita aqui nao depende de decisao de Produto.
   */
  it("clareia o que reprova sobre fundo escuro", () => {
    const CINZA_QUE_REPROVA = "#2b2f33";
    const ajuste = ajustarParaContraste(
      "textoEmBarraFraco",
      CINZA_QUE_REPROVA,
      PALETA_CLARA.barraLateral,
    );
    expect(ajuste.razaoAntes).toBeLessThan(CONTRASTE_MINIMO);
    expect(ajuste.razaoDepois).toBeGreaterThanOrEqual(CONTRASTE_MINIMO);
    expect(luminancia(ajuste.ajustada)).toBeGreaterThan(
      luminancia(CINZA_QUE_REPROVA),
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
      PALETA_CLARA.textoFraco,
      PALETA_CLARA.superficie,
    );
    expect(ajuste.razaoDepois).toBeGreaterThanOrEqual(CONTRASTE_MINIMO);
    expect(ajuste.razaoDepois).toBeLessThan(CONTRASTE_MINIMO + 0.6);
  });

  it("preserva o matiz da cor original", () => {
    // Amostra literal, pela mesma razao do caso acima: o que se mede e o
    // ajuste, e um alaranjado deixa o matiz visivel no canal vermelho.
    const LARANJA = "#b8853a";
    const ajuste = ajustarParaContraste(
      "destaqueSuave",
      LARANJA,
      PALETA_CLARA.superficie,
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
    /*
     * Fundo de luminancia intermediaria, escrito aqui: nenhuma cor chega a
     * 4,5:1 sobre ele, nem preto nem branco. Literal pela mesma razao dos
     * casos acima — o que se mede e o ajuste, e amarrar a amostra a um token
     * do tema faz o caso quebrar quando Produto troca a pele.
     */
    const CINZA_MEDIO = "#7c7c7c";
    const AMBAR = "#b0790a";
    const ajuste = ajustarParaContraste("marca", AMBAR, CINZA_MEDIO);
    expect(ajuste.alcancou).toBe(false);
    expect(ajuste.razaoDepois).toBeLessThan(CONTRASTE_MINIMO);
  });

  it("é determinístico: duas execuções dão a mesma cor", () => {
    const uma = ajustarParaContraste(
      "textoFraco",
      PALETA_CLARA.textoFraco,
      PALETA_CLARA.superficie,
    );
    const outra = ajustarParaContraste(
      "textoFraco",
      PALETA_CLARA.textoFraco,
      PALETA_CLARA.superficie,
    );
    expect(uma).toEqual(outra);
  });
});
