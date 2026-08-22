import { describe, expect, it } from "vitest";

import {
  anoEhDimensao,
  anoValido,
  contarRecortes,
  matrizDeRecortes,
  type Dimensoes,
} from "@/semantica/recortes";

/**
 * O portão de domínio da Query depois de P8 (T-004).
 *
 * O que estes testes sustentam é uma coisa só: **a contagem de recortes é
 * calculada, não escrita**. O número 768 aparece aqui como resultado esperado
 * de uma multiplicação — nunca como constante embutida no código de produção.
 *
 * As duas saídas que D-P8 considerou têm efeito verificado: ano como dimensão
 * (a escolhida) e ano fora do recorte (a descartada). Uma decisão que não muda
 * nada quando invertida não estava decidindo nada.
 */

/** As dimensões da seção 6.2 do PRD, com os 2 anos que a fixture carrega. */
const DIMENSOES: Dimensoes = {
  periodo: ["12 meses", "6 meses", "4º trimestre", "Dezembro"],
  ano: ["2026", "2025"],
  entidade: ["Consolidado", "Unidade SP", "Demais unidades"],
  area: [
    "Todas",
    "Operacoes",
    "Comercial",
    "Tecnologia",
    "Logistica",
    "Financeiro",
    "Marketing",
    "RH",
  ],
  modalidade: ["Todas", "Presencial", "Hibrido", "Remoto"],
};

/** Saída (c) de D-P8, descartada: o ano sai do recorte. */
const SEM_ANO: Dimensoes = {
  periodo: DIMENSOES.periodo,
  entidade: DIMENSOES.entidade,
  area: DIMENSOES.area,
  modalidade: DIMENSOES.modalidade,
};

describe("A contagem de recortes é calculada, não escrita", () => {
  it("com as dimensões do PRD e 2 anos, dá os 768 do backlog", () => {
    // 4 períodos × 2 anos × 3 entidades × 8 áreas × 4 modalidades
    const esperado =
      DIMENSOES.periodo.length *
      (DIMENSOES.ano?.length ?? 1) *
      DIMENSOES.entidade.length *
      DIMENSOES.area.length *
      DIMENSOES.modalidade.length;

    expect(esperado).toBe(768);
    expect(contarRecortes(DIMENSOES)).toBe(esperado);
  });

  it("a matriz tem exatamente o tamanho que a contagem promete", () => {
    expect(matrizDeRecortes(DIMENSOES)).toHaveLength(contarRecortes(DIMENSOES));
  });

  it("nenhum recorte se repete", () => {
    const matriz = matrizDeRecortes(DIMENSOES);
    const chaves = matriz.map((r) => JSON.stringify(r));
    expect(new Set(chaves).size).toBe(matriz.length);
  });

  it("acrescentar um ano aos dados aumenta a matriz sem tocar em código", () => {
    const comTres: Dimensoes = { ...DIMENSOES, ano: ["2026", "2025", "2024"] };

    expect(contarRecortes(comTres)).toBe(1152);
    expect(matrizDeRecortes(comTres)).toHaveLength(1152);
    // É este o ponto de D-P8: 2027 entra como dado, não como alteração de tipo.
    expect(contarRecortes(comTres)).toBeGreaterThan(contarRecortes(DIMENSOES));
  });

  it("acrescentar uma entidade também, sem número mágico em lugar nenhum", () => {
    const comQuatro: Dimensoes = {
      ...DIMENSOES,
      entidade: [...DIMENSOES.entidade, "Unidade RJ"],
    };
    expect(contarRecortes(comQuatro)).toBe(1024);
  });
});

describe("As duas saídas de D-P8 têm efeito verificável", () => {
  it("saída escolhida: o ano é dimensão e entra em todo recorte", () => {
    expect(anoEhDimensao(DIMENSOES)).toBe(true);

    const matriz = matrizDeRecortes(DIMENSOES);
    expect(matriz.every((r) => r.ano !== undefined)).toBe(true);
    expect(new Set(matriz.map((r) => r.ano))).toEqual(
      new Set(["2026", "2025"]),
    );
  });

  it("saída descartada: sem ano, o recorte não carrega a chave", () => {
    expect(anoEhDimensao(SEM_ANO)).toBe(false);

    const matriz = matrizDeRecortes(SEM_ANO);
    expect(matriz.every((r) => r.ano === undefined)).toBe(true);
  });

  it("as duas saídas produzem matrizes de tamanhos diferentes", () => {
    // Se inverter a decisão não mudasse nada, ela não estaria decidindo nada.
    expect(contarRecortes(SEM_ANO)).toBe(384);
    expect(contarRecortes(DIMENSOES)).toBe(contarRecortes(SEM_ANO) * 2);
  });

  it("um ano fora do domínio é recusado pelo dado, não pelo tipo", () => {
    expect(anoValido(DIMENSOES, "2026")).toBe(true);
    expect(anoValido(DIMENSOES, "2024")).toBe(false);
    // O mesmo ano passa a valer quando entra nas dimensões — sem recompilar.
    expect(anoValido({ ...DIMENSOES, ano: ["2024"] }, "2024")).toBe(true);
    expect(anoValido(SEM_ANO, "2026")).toBe(false);
  });
});

describe("Guardas do domínio", () => {
  it("dimensão obrigatória vazia é erro, e o ano é a única que pode faltar", () => {
    expect(() => matrizDeRecortes({ ...DIMENSOES, area: [] })).toThrow(
      RangeError,
    );
    expect(() => matrizDeRecortes({ ...DIMENSOES, periodo: [] })).toThrow(
      RangeError,
    );
    expect(() => matrizDeRecortes(SEM_ANO)).not.toThrow();
  });

  it("a matriz sai na mesma ordem em execuções repetidas", () => {
    const chave = () =>
      JSON.stringify(matrizDeRecortes(DIMENSOES).slice(0, 20));
    expect(new Set([chave(), chave(), chave()]).size).toBe(1);
  });
});

describe("Nenhum literal de contagem no código de produção", () => {
  it("o módulo de recortes não traz 768 escrito", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const fonte = readFileSync(
      join(process.cwd(), "src", "semantica", "recortes.ts"),
      "utf8",
    ).replace(/\/\*[\s\S]*?\*\//g, " ");

    expect(fonte, "768 voltou a ser constante no código").not.toMatch(
      /\b768\b/,
    );
  });
});
