/**
 * As leituras contra o custo do dinheiro (estágio 2, `src/chat/leitura.ts`).
 *
 * A conta é nossa, nunca do modelo. Estes casos usam as taxas do documento de
 * CFO da Dreamy — Selic 14,00%, CDI 13,90%, IPCA 4,44% — e conferem que os
 * números que o documento escreve saem daqui: o juro real de "cerca de 9,1%" é
 * Fisher, e não subtração (que daria 9,56%).
 */

import { describe, expect, it } from "vitest";

import type { TaxaDeReferencia } from "@/acesso/referencias/sgs";
import { CONFIANCA_MINIMA, interpretarLocalmente } from "@/chat/interpretar";
import {
  FAMILIA,
  PROXIMO_PASSO,
  cdiLiquidoDeIr,
  familiaDe,
  ganhoReal,
  leiturasDeCusto,
  leiturasDeResultado,
  leiturasDeRetorno,
} from "@/chat/leitura";
import { CATALOGO_GERADO } from "@/semantica/catalogo-gerado";

const SELIC: TaxaDeReferencia = {
  id: "selic",
  nome: "Meta Selic",
  valor: 14,
  periodicidade: "ao ano",
  vigenteDesde: "2026-09-16",
  fonte: "Banco Central do Brasil · SGS série 432",
};
const CDI: TaxaDeReferencia = {
  id: "cdi",
  nome: "CDI",
  valor: 13.9,
  periodicidade: "ao ano",
  vigenteDesde: "2026-09-02",
  fonte: "Banco Central do Brasil · SGS série 4389",
};
const IPCA: TaxaDeReferencia = {
  id: "ipca_12m",
  nome: "IPCA 12 meses",
  valor: 4.44,
  periodicidade: "acumulado em 12 meses",
  vigenteDesde: "2026-07-01",
  fonte: "Banco Central do Brasil · SGS série 13522",
};
const TODAS = [SELIC, CDI, IPCA];

describe("ganho real", () => {
  it("é Fisher: Selic 14,00% com IPCA 4,44% dá cerca de 9,1%, como o documento", () => {
    expect(ganhoReal(14, 4.44)).toBeCloseTo(9.15, 1);
    // Por subtração daria 9,56 — e a diferença aparece na tela.
    expect(ganhoReal(14, 4.44)).not.toBeCloseTo(9.56, 1);
  });

  it("o ROE de 8,3% do exemplo vira ganho real de 3,7%", () => {
    expect(ganhoReal(8.3, 4.44)).toBeCloseTo(3.7, 1);
  });
});

describe("as leituras de retorno", () => {
  it("ROE de 8,3%: -5,6 p.p. para o CDI e ganho real de 3,7% sobre o IPCA", () => {
    const leituras = leiturasDeRetorno("roe", "ROE", 8.3, TODAS);
    expect(leituras.map((l) => l.rotulo)).toEqual([
      "Diferença para o CDI",
      "Ganho real sobre o IPCA",
    ]);
    expect(leituras[0]?.valor).toBeCloseTo(-5.6, 1);
    expect(leituras[0]?.unidade).toBe("pp");
    expect(leituras[1]?.valor).toBeCloseTo(3.7, 1);
    expect(leituras[1]?.unidade).toBe("pct");
    // Cada leitura carrega a taxa que usou, com fonte: princípio P3.
    expect(leituras[0]?.referencia).toBe(CDI);
    expect(leituras[1]?.referencia).toBe(IPCA);
  });

  it("o ROIC também se lê contra o CDI líquido de IR (15%)", () => {
    const leituras = leiturasDeRetorno("roic", "ROIC", 11.1, TODAS);
    const liquido = leituras.find((l) => l.rotulo.includes("líquido de IR"));
    expect(liquido).toBeDefined();
    // 13,9 × 0,85 = 11,815 → 11,1 − 11,8 = -0,7 p.p.
    expect(liquido?.referencia.valor).toBeCloseTo(11.815, 2);
    expect(liquido?.valor).toBeCloseTo(-0.7, 1);
    expect(cdiLiquidoDeIr(CDI).nome).toBe("CDI líquido de IR");
  });

  it("sem CDI nem IPCA, não há leitura — e quem chama diz por quê", () => {
    expect(leiturasDeRetorno("roe", "ROE", 8.3, [SELIC])).toEqual([]);
  });
});

describe("as leituras de custo e de resultado", () => {
  it("custo médio da dívida de 15,6% é spread de +1,7 p.p. sobre o CDI", () => {
    const leituras = leiturasDeCusto("Custo médio da dívida", 15.6, TODAS);
    expect(leituras).toHaveLength(1);
    expect(leituras[0]?.valor).toBeCloseTo(1.7, 1);
    expect(leituras[0]?.unidade).toBe("pp");
  });

  it("lucro de -R$ 8 mi sobre receita de R$ 1.200 mi é -0,7% contra a Selic", () => {
    const leituras = leiturasDeResultado(-8, 1200, TODAS);
    expect(leituras.map((l) => l.rotulo)).toEqual([
      "Retorno sobre a receita líquida",
      "Diferença para a Selic",
    ]);
    expect(leituras[0]?.valor).toBeCloseTo(-0.67, 2);
    expect(leituras[1]?.valor).toBeCloseTo(-14.67, 2);
  });

  it("sem Selic não há leitura de resultado", () => {
    expect(leiturasDeResultado(-8, 1200, [CDI, IPCA])).toEqual([]);
  });
});

describe("a família", () => {
  it("resultado em reais continua derivado de unidade e sentido", () => {
    expect(familiaDe("lucro_liquido", "BRL_mi", "maior_melhor")).toBe(
      "resultado",
    );
    expect(familiaDe("folha_total", "BRL_mi", "neutro")).toBeNull();
    expect(familiaDe("margem_liquida", "pct", "maior_melhor")).toBeNull();
    expect(familiaDe("turnover_12m", "pct", "menor_melhor")).toBeNull();
  });

  it("as famílias novas são declaradas por id", () => {
    expect(familiaDe("roe", "pct", "maior_melhor")).toBe("retorno");
    expect(familiaDe("custo_medio_da_divida", "pct", "menor_melhor")).toBe(
      "custo_de_capital",
    );
    expect(familiaDe("liquidez_corrente", "vezes", "maior_melhor")).toBe(
      "liquidez",
    );
  });

  it("toda oferta de próximo passo é respondível pelo interpretador", () => {
    for (const [metrica, oferta] of Object.entries(PROXIMO_PASSO)) {
      const intencao = interpretarLocalmente(oferta);
      expect(intencao, `${metrica}: "${oferta}"`).not.toBeNull();
      expect(
        intencao?.confianca,
        `${metrica}: "${oferta}"`,
      ).toBeGreaterThanOrEqual(CONFIANCA_MINIMA);
    }
  });

  it("as chaves de FAMILIA e PROXIMO_PASSO que já existem apontam para o catálogo", () => {
    // Enquanto as métricas de CFO entram por etapas, o que já está no catálogo
    // precisa bater; o resto é promessa que a etapa seguinte cumpre.
    const existentes = Object.keys(CATALOGO_GERADO);
    for (const id of Object.keys(PROXIMO_PASSO)) {
      expect(existentes, id).toContain(id);
    }
    expect(Object.keys(FAMILIA).length).toBeGreaterThan(0);
  });
});
