import { describe, expect, it } from "vitest";

import {
  eixo,
  faixa,
  larguraDoSpan,
  passoDeRotulo,
  rotulosVisiveis,
  type Margens,
} from "@/apresentacao/svg/nucleo";

/**
 * O nucleo de geometria de T-129.
 *
 * O criterio de aceite pede 20 casos cobrindo minimo negativo, faixa nula,
 * valores iguais e rotulos longos. Eles estao nomeados abaixo, um por `it`.
 */

const MARGENS: Margens = { esquerda: 44, direita: 12, topo: 12, base: 24 };

function montar(min: number, max: number, divisoes = 4) {
  return eixo({
    largura: 400,
    altura: 200,
    margens: MARGENS,
    min,
    max,
    divisoes,
    formatar: (v) => String(Math.round(v)),
  });
}

describe("larguraDoSpan", () => {
  it("1. cresce com o span e nao depende de nenhuma medicao", () => {
    const larguras = [1, 2, 4, 6, 8, 12].map(larguraDoSpan);
    expect(larguras).toEqual([...larguras].sort((a, b) => a - b));
    expect(larguras.at(-1)).toBe(larguraDoSpan(12));
  });

  it("2. e deterministica: mil chamadas devolvem o mesmo valor", () => {
    const valores = new Set(
      Array.from({ length: 1000 }, () => larguraDoSpan(6)),
    );
    expect(valores.size).toBe(1);
  });

  it("3. respeita a largura minima em span estreito", () => {
    expect(larguraDoSpan(1)).toBeGreaterThanOrEqual(160);
  });

  it("4. recusa span fora da grade de 12 colunas", () => {
    expect(() => larguraDoSpan(0)).toThrow(RangeError);
    expect(() => larguraDoSpan(13)).toThrow(RangeError);
    expect(() => larguraDoSpan(2.5)).toThrow(RangeError);
  });
});

describe("faixa", () => {
  it("5. mantem uma faixa comum intacta", () => {
    expect(faixa(0, 200)).toEqual({ min: 0, max: 200, degenerada: false });
  });

  it("6. abre a faixa nula quando todos os valores sao iguais", () => {
    const f = faixa(75, 75);
    expect(f.degenerada).toBe(true);
    expect(f.max).toBeGreaterThan(f.min);
  });

  it("7. abre a faixa quando todos os valores sao zero", () => {
    const f = faixa(0, 0);
    expect(f.degenerada).toBe(true);
    expect(f.min).toBe(-1);
    expect(f.max).toBe(1);
  });

  it("8. abre a faixa nula tambem em valor negativo", () => {
    const f = faixa(-30, -30);
    expect(f.degenerada).toBe(true);
    expect(f.min).toBeLessThan(-30);
    expect(f.max).toBeGreaterThan(-30);
  });

  it("9. recusa faixa invertida e limite nao finito", () => {
    expect(() => faixa(10, 5)).toThrow(RangeError);
    expect(() => faixa(Number.NaN, 5)).toThrow(RangeError);
  });
});

describe("eixo: grade, escala e rotulos", () => {
  it("10. produz divisoes + 1 linhas de grade e um rotulo por linha", () => {
    const e = montar(0, 200, 4);
    expect(e.grade.filter((l) => !l.zero)).toHaveLength(5);
    expect(e.rotulos).toHaveLength(5);
  });

  it("11. mapeia o minimo na base e o maximo no topo da area interna", () => {
    const e = montar(0, 200);
    expect(e.y(0)).toBe(MARGENS.topo + e.alturaInterna);
    expect(e.y(200)).toBe(MARGENS.topo);
  });

  it("12. e monotonica: valor maior fica mais alto na tela", () => {
    const e = montar(0, 200);
    expect(e.y(150)).toBeLessThan(e.y(50));
  });

  it("13. com minimo negativo, marca a linha do zero", () => {
    const e = montar(-40, 120);
    const zero = e.grade.filter((l) => l.zero);
    expect(zero).toHaveLength(1);
    expect(zero[0]?.y1).toBe(e.y(0));
  });

  it("14. sem cruzar o zero, nao inventa linha de zero", () => {
    expect(montar(10, 120).grade.filter((l) => l.zero)).toHaveLength(0);
    expect(montar(-120, -10).grade.filter((l) => l.zero)).toHaveLength(0);
  });

  it("15. valores iguais nao produzem NaN nem divisao por zero", () => {
    const e = montar(75, 75);
    expect(Number.isFinite(e.y(75))).toBe(true);
    for (const linha of e.grade) {
      expect(Number.isFinite(linha.y1)).toBe(true);
    }
    for (const rotulo of e.rotulos) {
      expect(rotulo.texto).not.toContain("NaN");
    }
  });

  it("16. todo zero tambem sobrevive, com o zero no meio da caixa", () => {
    const e = montar(0, 0);
    expect(Number.isFinite(e.y(0))).toBe(true);
    expect(e.y(0)).toBeCloseTo(MARGENS.topo + e.alturaInterna / 2, 1);
  });

  it("17. e deterministica: a mesma entrada produz a mesma grade", () => {
    const chave = () => JSON.stringify(montar(-40, 120).grade);
    expect(new Set([chave(), chave(), chave()]).size).toBe(1);
  });

  it("18. distribui categorias pelo centro da faixa de cada uma", () => {
    const e = montar(0, 100);
    const x0 = e.xDaCategoria(0, 4);
    const x3 = e.xDaCategoria(3, 4);
    expect(x0).toBeGreaterThan(MARGENS.esquerda);
    expect(x3).toBeLessThan(e.largura - MARGENS.direita);
    expect(x3).toBeGreaterThan(x0);
  });

  it("19. recusa margens maiores que a caixa e divisoes invalidas", () => {
    expect(() =>
      eixo({
        largura: 40,
        altura: 200,
        margens: MARGENS,
        min: 0,
        max: 10,
        formatar: String,
      }),
    ).toThrow(RangeError);
    expect(() => montar(0, 100, 0)).toThrow(RangeError);
  });

  it("20. declara um viewBox que casa com a caixa pedida", () => {
    const e = montar(0, 200);
    expect(e.viewBox).toBe("0 0 400 200");
  });
});

describe("rotulos longos", () => {
  it("21. aumenta o passo quando o rotulo nao cabe na faixa", () => {
    const curtos = ["jan", "fev", "mar"];
    const longos = [
      "Contas a pagar/receber",
      "Financeiro e controladoria",
      "Distribuição geográfica por estado",
    ];
    expect(passoDeRotulo(20, longos)).toBeGreaterThan(
      passoDeRotulo(20, curtos),
    );
  });

  it("22. com faixa larga o bastante, mostra todos os rotulos", () => {
    expect(passoDeRotulo(400, ["jan", "fev", "mar"])).toBe(1);
  });

  it("23. lista vazia e rotulo vazio nao quebram o passo", () => {
    expect(passoDeRotulo(20, [])).toBe(1);
    expect(passoDeRotulo(20, ["", "", ""])).toBe(1);
  });

  it("24. o primeiro e o ultimo rotulo sobrevivem sempre", () => {
    const cats = ["jan", "fev", "mar", "abr", "mai", "jun"];
    const visiveis = rotulosVisiveis(cats, 3);
    expect(visiveis[0]).toBe("jan");
    expect(visiveis.at(-1)).toBe("jun");
    expect(visiveis.filter((c) => c === "")).not.toHaveLength(0);
  });

  it("25. passo 1 mantem todos, e lista vazia devolve lista vazia", () => {
    const cats = ["jan", "fev"];
    expect(rotulosVisiveis(cats, 1)).toEqual(cats);
    expect(rotulosVisiveis([], 2)).toEqual([]);
  });
});
