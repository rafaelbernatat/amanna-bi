import { describe, expect, it } from "vitest";

import {
  AREAS,
  ENTIDADES,
  MODALIDADES,
  PERIODOS,
  QUERY_PADRAO,
  type Query,
} from "@/semantica/contrato";
import {
  QueryInvalida,
  deQueryKey,
  queryKey,
  validarQuery,
} from "@/semantica/query";
import {
  contarRecortes,
  matrizDeRecortes,
  type Dimensoes,
} from "@/semantica/recortes";

/**
 * Validação e chave de cache da Query (T-103).
 *
 * A matriz de recortes vem de T-004 — **calculada**, não escrita. Por isso este
 * arquivo não traz 768 em lugar nenhum: ele percorre o que `matrizDeRecortes`
 * produzir, e continua correto no dia em que um terceiro ano entrar nos dados.
 */

const DIMENSOES: Dimensoes = {
  periodo: [...PERIODOS],
  ano: ["2026", "2025"],
  entidade: [...ENTIDADES],
  area: [...AREAS],
  modalidade: [...MODALIDADES],
};

/** Os recortes canônicos, como Query — derivados, nunca digitados. */
const RECORTES: readonly Query[] = matrizDeRecortes(DIMENSOES).map((r) => ({
  periodo: r.periodo as Query["periodo"],
  ano: r.ano ?? "2026",
  entidade: r.entidade as Query["entidade"],
  area: r.area as Query["area"],
  modalidade: r.modalidade as Query["modalidade"],
}));

describe("Query fora do vocabulário é recusada antes do adaptador", () => {
  it.each([
    ["periodo", "3 meses", "periodo_invalido"],
    ["entidade", "Matriz", "entidade_invalida"],
    ["entidade", "Filial SP", "entidade_invalida"],
    ["area", "Juridico", "area_invalida"],
    ["modalidade", "Campo", "modalidade_invalida"],
    ["ano", "2024", "ano_invalido"],
  ])("%s = %s é recusado com motivo %s", (campo, valor, motivo) => {
    const bruto = { ...QUERY_PADRAO, [campo]: valor };
    expect(() => validarQuery(bruto, DIMENSOES)).toThrow(QueryInvalida);
    try {
      validarQuery(bruto, DIMENSOES);
    } catch (erro) {
      expect((erro as QueryInvalida).motivo).toBe(motivo);
      expect((erro as QueryInvalida).campo).toBe(campo);
    }
  });

  it("os valores que a v1.0 do PRD listava e o protótipo não tem são recusados", () => {
    // Anexo D, achados 1 e 2: a v1.0 listava opções que nunca existiram.
    for (const periodo of ["3 meses", "mês atual"]) {
      expect(() =>
        validarQuery({ ...QUERY_PADRAO, periodo }, DIMENSOES),
      ).toThrow(QueryInvalida);
    }
  });

  it("campo ausente, campo desconhecido e não-objeto são recusados", () => {
    const { area: _area, ...semArea } = QUERY_PADRAO;
    expect(() => validarQuery(semArea, DIMENSOES)).toThrow(QueryInvalida);

    expect(() =>
      validarQuery({ ...QUERY_PADRAO, centroDeCusto: "CC-01" }, DIMENSOES),
    ).toThrow(QueryInvalida);

    for (const lixo of [null, undefined, 42, "texto", []]) {
      expect(() => validarQuery(lixo, DIMENSOES)).toThrow(QueryInvalida);
    }
  });

  it("recusa em vez de corrigir para o padrão em silêncio", () => {
    // Cair no padrao mostraria um recorte que ninguem pediu (principio PR-4).
    let recusou = false;
    try {
      validarQuery({ ...QUERY_PADRAO, area: "Juridico" }, DIMENSOES);
    } catch {
      recusou = true;
    }
    expect(recusou).toBe(true);
  });

  it("todo recorte canônico é aceito", () => {
    for (const recorte of RECORTES) {
      expect(() => validarQuery(recorte, DIMENSOES)).not.toThrow();
    }
    expect(RECORTES).toHaveLength(contarRecortes(DIMENSOES));
  });

  it("o ano é validado pelo dado, não pelo tipo (D-P8)", () => {
    expect(() =>
      validarQuery({ ...QUERY_PADRAO, ano: "2027" }, DIMENSOES),
    ).toThrow(QueryInvalida);
    // Carregar 2027 na replica passa a aceita-lo, sem tocar em codigo.
    expect(() =>
      validarQuery(
        { ...QUERY_PADRAO, ano: "2027" },
        { ...DIMENSOES, ano: ["2027"] },
      ),
    ).not.toThrow();
  });
});

describe("queryKey é determinística", () => {
  it("a ordem das chaves do objeto não muda a chave gerada", () => {
    const emUmaOrdem: Query = {
      periodo: "6 meses",
      ano: "2025",
      entidade: "Unidade SP",
      area: "RH",
      modalidade: "Remoto",
    };
    const naOrdemInversa = {
      modalidade: "Remoto",
      area: "RH",
      entidade: "Unidade SP",
      ano: "2025",
      periodo: "6 meses",
    } as Query;

    expect(queryKey(naOrdemInversa)).toBe(queryKey(emUmaOrdem));
    // JSON.stringify preserva ordem de insercao — por isso ele nao serve aqui.
    expect(JSON.stringify(naOrdemInversa)).not.toBe(JSON.stringify(emUmaOrdem));
  });

  it("a mesma Query produz a mesma chave em chamadas repetidas", () => {
    const chaves = new Set(
      Array.from({ length: 500 }, () => queryKey(QUERY_PADRAO)),
    );
    expect(chaves.size).toBe(1);
  });

  it("cada recorte canônico tem uma chave distinta", () => {
    const chaves = RECORTES.map(queryKey);
    expect(new Set(chaves).size).toBe(RECORTES.length);
    expect(new Set(chaves).size).toBe(contarRecortes(DIMENSOES));
  });

  it("acrescentar um ano mantém todas as chaves distintas", () => {
    const comTres: Dimensoes = { ...DIMENSOES, ano: ["2026", "2025", "2024"] };
    const chaves = matrizDeRecortes(comTres).map((r) =>
      queryKey({
        periodo: r.periodo as Query["periodo"],
        ano: r.ano ?? "2026",
        entidade: r.entidade as Query["entidade"],
        area: r.area as Query["area"],
        modalidade: r.modalidade as Query["modalidade"],
      }),
    );
    expect(new Set(chaves).size).toBe(contarRecortes(comTres));
  });

  it("nenhum valor consegue forjar uma fronteira de campo", () => {
    // Se o separador aparecesse num rotulo, dois recortes distintos colidiriam.
    for (const dominio of [PERIODOS, ENTIDADES, AREAS, MODALIDADES]) {
      for (const valor of dominio) {
        expect(valor, `${valor} contém o separador`).not.toContain(
          String.fromCharCode(31),
        );
        expect(valor).not.toContain("=");
      }
    }
  });

  it("a chave volta a ser o mesmo recorte", () => {
    for (const recorte of RECORTES.slice(0, 50)) {
      expect(deQueryKey(queryKey(recorte), DIMENSOES)).toEqual(recorte);
    }
  });

  it("chave malformada é recusada, não adivinhada", () => {
    expect(() => deQueryKey("lixo", DIMENSOES)).toThrow(QueryInvalida);
    expect(() => deQueryKey("periodo=12 meses", DIMENSOES)).toThrow(
      QueryInvalida,
    );
  });
});
