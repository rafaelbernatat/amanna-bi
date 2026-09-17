import { describe, expect, it } from "vitest";

import { calcularPainel } from "@/acesso/calculo/paineis";
import { BASE_DE_FIXTURES } from "@/acesso/fixtures/base";
import {
  LIMITE_DE_PONTOS,
  resumirPainel,
  rotuloDeCategoria,
  variantesDoRotulo,
} from "@/chat/grafico";
import { QUERY_PADRAO } from "@/semantica/contrato";
import { FORMAS } from "@/semantica/painel";
import { REGISTRO_DE_PAINEIS } from "@/semantica/paineis";

/**
 * O resumo de painel para o modelo e para o verificador (T-346).
 *
 * Todo número do resumo veio do envelope; toda forma tem resumo; e o rótulo
 * de um ponto tem as variantes que o texto usa para nomeá-lo.
 */

describe("resumirPainel", () => {
  it("cobre os 71 painéis das fixtures sem lançar, e toda forma aparece", () => {
    const formas = new Set<string>();
    for (const registro of REGISTRO_DE_PAINEIS) {
      const painel = calcularPainel(
        BASE_DE_FIXTURES,
        registro.id,
        QUERY_PADRAO,
      );
      const resumo = resumirPainel(painel);
      formas.add(resumo.forma);
      expect(resumo.id).toBe(registro.id);
      expect(resumo.quantidadeDePontos).toBeGreaterThanOrEqual(0);
      if (!resumo.truncado) {
        expect(resumo.pontos).toHaveLength(resumo.quantidadeDePontos);
      } else {
        expect(resumo.pontos).toEqual([]);
        expect(resumo.quantidadeDePontos).toBeGreaterThan(LIMITE_DE_PONTOS);
      }
      // Todo ponto com valor tem a forma escrita; sem valor, nulo.
      for (const p of [
        ...resumo.pontos,
        ...resumo.destaques.map((d) => d.ponto),
      ]) {
        expect(p.formatado === null).toBe(p.valor === null);
      }
    }
    for (const forma of FORMAS) expect(formas.has(forma), forma).toBe(true);
  });

  it("uma linha de doze meses traz pico, vale e último com o mês no rótulo", () => {
    const painel = calcularPainel(
      BASE_DE_FIXTURES,
      "rh-turnover",
      QUERY_PADRAO,
    );
    const resumo = resumirPainel(painel);
    expect(resumo.forma).toBe("linha");
    const tipos = resumo.destaques.map((d) => d.tipo);
    expect(tipos).toContain("maior");
    expect(tipos).toContain("ultimo");
    for (const d of resumo.destaques) {
      expect(d.ponto.rotulo).toMatch(/\/20\d{2}$|^[a-z]{3}$/i);
    }
  });

  it("a cascata da DRE tem um ponto por degrau, nenhum a mais", () => {
    const painel = calcularPainel(BASE_DE_FIXTURES, "fin-dre", QUERY_PADRAO);
    if (painel.forma !== "cascata") throw new Error("esperava cascata");
    const resumo = resumirPainel(painel);
    expect(resumo.pontos.map((p) => p.rotulo)).toEqual(
      painel.passos.map((p) => p.nome),
    );
  });
});

describe("os rótulos", () => {
  it("competência vira mês/ano", () => {
    expect(rotuloDeCategoria("2026-03")).toBe("mar/2026");
    expect(rotuloDeCategoria("2026-03-31")).toBe("mar/2026");
    expect(rotuloDeCategoria("Tecnologia")).toBe("Tecnologia");
  });

  it("as variantes de um mês são o mês por extenso, abreviado e mês/ano", () => {
    const v = variantesDoRotulo("2026-03");
    expect(v).toContain("marco");
    expect(v).toContain("mar");
    expect(v).toContain("mar/2026");
  });

  it("as variantes de um rótulo composto incluem as palavras longas", () => {
    const v = variantesDoRotulo("Tecnologia · Headcount");
    expect(v).toContain("tecnologia");
    expect(v).toContain("headcount");
    expect(v).not.toContain("·");
  });
});
