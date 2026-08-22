import { describe, expect, it } from "vitest";

import {
  configuracaoDeEixo,
  faixa,
  larguraDoSpan,
  passoDeRotulo,
  rotulosVisiveis,
} from "@/apresentacao/graficos/nucleo";

/**
 * O nucleo de dominio de T-129, agora alimentando o recharts.
 *
 * O criterio de aceite pede 20 casos cobrindo minimo negativo, faixa nula,
 * valores iguais e rotulos longos. Eles estao nomeados abaixo, um por `it`.
 * O que a biblioteca desenha e problema dela; o que ela recebe e problema nosso,
 * e e o que estes casos fixam.
 */

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun"];

describe("larguraDoSpan", () => {
  it("1. cresce com o span e nao depende de nenhuma medicao", () => {
    const larguras = [1, 2, 4, 6, 8, 12].map(larguraDoSpan);
    expect(larguras).toEqual([...larguras].sort((a, b) => a - b));
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
    expect(faixa(0, 0)).toEqual({ min: -1, max: 1, degenerada: true });
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

describe("configuracaoDeEixo: o que o recharts recebe", () => {
  it("10. produz divisoes + 1 cortes de grade", () => {
    const e = configuracaoDeEixo({ valores: [0, 50, 200], divisoes: 4 });
    expect(e.cortes).toHaveLength(5);
    expect(e.cortes[0]).toBe(e.dominio[0]);
    expect(e.cortes.at(-1)).toBe(e.dominio[1]);
  });

  it("11. o dominio cobre o menor e o maior valor da serie", () => {
    const e = configuracaoDeEixo({ valores: [12, 40, 33, 110] });
    expect(e.dominio[0]).toBeLessThanOrEqual(12);
    expect(e.dominio[1]).toBeGreaterThanOrEqual(110);
  });

  it("12. os cortes sobem em ordem, sem repetir", () => {
    const e = configuracaoDeEixo({ valores: [5, 900], divisoes: 5 });
    expect(e.cortes).toEqual([...e.cortes].sort((a, b) => a - b));
    expect(new Set(e.cortes).size).toBe(e.cortes.length);
  });

  it("13. com minimo negativo, pede a linha do zero", () => {
    expect(configuracaoDeEixo({ valores: [-40, 60] }).temLinhaDeZero).toBe(
      true,
    );
  });

  it("14. sem cruzar o zero, nao pede linha de zero", () => {
    expect(configuracaoDeEixo({ valores: [10, 120] }).temLinhaDeZero).toBe(
      false,
    );
    expect(configuracaoDeEixo({ valores: [-120, -10] }).temLinhaDeZero).toBe(
      false,
    );
  });

  it("15. valores iguais nao produzem dominio degenerado no recharts", () => {
    const e = configuracaoDeEixo({ valores: [75, 75, 75] });
    expect(e.degenerada).toBe(true);
    expect(e.dominio[1]).toBeGreaterThan(e.dominio[0]);
    expect(e.cortes.every((c) => Number.isFinite(c))).toBe(true);
  });

  it("16. tudo zero tambem sobrevive, com o zero dentro do dominio", () => {
    const e = configuracaoDeEixo({ valores: [0, 0, 0] });
    expect(e.dominio[0]).toBeLessThan(0);
    expect(e.dominio[1]).toBeGreaterThan(0);
  });

  it("17. e deterministica: a mesma serie produz a mesma configuracao", () => {
    const chave = () =>
      JSON.stringify(
        configuracaoDeEixo({ valores: [-40, 22, 61, 8], categorias: MESES }),
      );
    expect(new Set([chave(), chave(), chave()]).size).toBe(1);
  });

  it("18. ancorada no zero, o dominio inclui o zero mesmo sem valor negativo", () => {
    const e = configuracaoDeEixo({
      valores: [120, 180, 240],
      ancoradoNoZero: true,
    });
    expect(e.dominio[0]).toBe(0);
  });

  it("19. recusa serie sem valor finito e divisoes invalidas", () => {
    expect(() => configuracaoDeEixo({ valores: [] })).toThrow(RangeError);
    expect(() => configuracaoDeEixo({ valores: [Number.NaN] })).toThrow(
      RangeError,
    );
    expect(() => configuracaoDeEixo({ valores: [1, 2], divisoes: 0 })).toThrow(
      RangeError,
    );
  });

  it("20. um ponto unico ainda produz um eixo desenhavel", () => {
    const e = configuracaoDeEixo({ valores: [42], categorias: ["jan"] });
    expect(e.dominio[1]).toBeGreaterThan(e.dominio[0]);
    expect(e.cortes).toHaveLength(5);
  });
});

describe("rotulos longos", () => {
  it("21. aumenta o passo quando o rotulo nao cabe na faixa", () => {
    const longos = [
      "Contas a pagar/receber",
      "Financeiro e controladoria",
      "Distribuição geográfica por estado",
    ];
    expect(passoDeRotulo(20, longos)).toBeGreaterThan(passoDeRotulo(20, MESES));
  });

  it("22. com faixa larga o bastante, mostra todos os rotulos", () => {
    expect(passoDeRotulo(400, MESES)).toBe(1);
  });

  it("23. lista vazia e rotulo vazio nao quebram o passo", () => {
    expect(passoDeRotulo(20, [])).toBe(1);
    expect(passoDeRotulo(20, ["", "", ""])).toBe(1);
  });

  it("24. o intervalo entregue ao recharts e o passo menos um", () => {
    // recharts conta `interval` como "quantas pular", nao "de quantas em quantas".
    const curto = configuracaoDeEixo({ valores: [1, 2], categorias: MESES });
    expect(curto.intervaloDeRotulo).toBe(
      passoDeRotulo(larguraDoSpan(6) / MESES.length, MESES) - 1,
    );
    expect(curto.intervaloDeRotulo).toBeGreaterThanOrEqual(0);
  });

  it("25. rotulo longo em painel estreito pula categorias", () => {
    const longas = [
      "Contas a pagar/receber",
      "Financeiro e controladoria",
      "Distribuição geográfica por estado",
      "Concentração geográfica",
    ];
    const e = configuracaoDeEixo({
      valores: [1, 2, 3, 4],
      categorias: longas,
      larguraDisponivel: larguraDoSpan(2),
    });
    expect(e.intervaloDeRotulo).toBeGreaterThan(0);
  });

  it("26. o primeiro e o ultimo rotulo sobrevivem sempre", () => {
    const visiveis = rotulosVisiveis(MESES, 3);
    expect(visiveis[0]).toBe("jan");
    expect(visiveis.at(-1)).toBe("jun");
    expect(visiveis.filter((c) => c === "")).not.toHaveLength(0);
  });

  it("27. passo 1 mantem todos, e lista vazia devolve lista vazia", () => {
    expect(rotulosVisiveis(MESES, 1)).toEqual(MESES);
    expect(rotulosVisiveis([], 2)).toEqual([]);
  });
});
