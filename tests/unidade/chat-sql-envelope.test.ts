import { beforeAll, describe, expect, it } from "vitest";

import type { ResultadoDaConsulta } from "@/acesso/consulta";
import {
  fraseDaConsulta,
  leituraDaConsulta,
  numerosDaConsulta,
  type UnidadeDeColuna,
} from "@/chat/ferramentas/consulta";
import { divergencias } from "@/chat/perguntar";
import { resolver, type Resolucao } from "@/chat/resolver";
import { QUERY_PADRAO } from "@/semantica/contrato";

/**
 * O resultado da consulta vira envelope (T-451).
 *
 * Produto manteve o verificador de RF-15 e trocou o que ele confere: o
 * conjunto de linhas passa a ser a lista de permitidos. O que se prova aqui é
 * a ida e a volta — a célula citada com o rótulo por perto passa, a mesma
 * célula solta não passa, e um número que consulta nenhuma devolveu também
 * não.
 */

beforeAll(() => {
  process.env["DATA_SOURCE"] = "fixtures";
  process.env["AUTH_PROVIDER"] = "fixtures";
});

const RESULTADO: ResultadoDaConsulta = {
  colunas: ["nome", "cargo", "custo_total_empresa"],
  linhas: [
    {
      nome: "Paula Barbosa",
      cargo: "Analista Pl",
      custo_total_empresa: 8679.49,
    },
    { nome: "Rui Alves", cargo: "Gerente", custo_total_empresa: 24500 },
  ],
  truncado: false,
};

const UNIDADES: Readonly<Record<string, UnidadeDeColuna>> = {
  custo_total_empresa: "reais",
};

function leitura() {
  return leituraDaConsulta(
    "SELECT nome, cargo, custo_total_empresa FROM folha",
    RESULTADO,
    UNIDADES,
    ["amanna_chat"],
    "2026-12-31",
  );
}

/** Uma resolução sem métrica, como o laço monta para uma resposta de consulta. */
async function comConsulta(): Promise<Resolucao> {
  const base = await resolver("receita_liquida", QUERY_PADRAO);
  return {
    ...base,
    metrica: "",
    rotulo: "",
    valor: null,
    formula: "",
    consideracoes: [],
    referencias: [],
    comparacao: null,
    comparacaoIndisponivelPorque: null,
    serieMensal: [],
    painel: null,
    leituras: [{ ferramenta: "consultar_dados", leitura: leitura() }],
    caminho: "composto",
  };
}

describe("a formatação é nossa", () => {
  it("a coluna em reais sai com centavos, e não em milhões", () => {
    const l = leitura();
    expect(l.linhas[0]?.celulas[2]).toBe("R$ 8.679,49");
    expect(l.linhas[1]?.celulas[2]).toBe("R$ 24.500,00");
  });

  it("a primeira coluna de texto vira o rótulo da linha", () => {
    const l = leitura();
    expect(l.colunas[0]).toMatchObject({ nome: "nome", papel: "rotulo" });
    expect(l.linhas[0]?.rotulo).toBe("Paula Barbosa");
  });
});

describe("o verificador com o envelope da consulta", () => {
  it("a célula citada junto do rótulo passa", async () => {
    const r = await comConsulta();
    const texto = "Rui Alves custou R$ 24.500,00 no mês.";
    expect(divergencias(texto, r, "")).toEqual([]);
  });

  it("a mesma célula solta, longe do rótulo, é recusada", async () => {
    const r = await comConsulta();
    const texto = `R$ 24.500,00 foi o valor. ${"palavra ".repeat(30)} Rui Alves aparece só aqui.`;
    expect(divergencias(texto, r, "")).toContain("R$ 24.500,00");
  });

  it("um número que a consulta não devolveu é recusado", async () => {
    const r = await comConsulta();
    expect(divergencias("Rui Alves custou R$ 30.000,00.", r, "")).toContain(
      "R$ 30.000,00",
    );
  });

  it("a soma das duas linhas é recusada: não calculamos nada", async () => {
    const r = await comConsulta();
    // 8.679,49 + 24.500,00 — número que existe na aritmética, e não no envelope.
    expect(
      divergencias("Os dois juntos custaram R$ 33.179,49.", r, ""),
    ).toContain("R$ 33.179,49");
  });

  it("o texto montado da consulta nunca diverge dela", async () => {
    const r = await comConsulta();
    expect(divergencias(fraseDaConsulta(leitura()), r, "")).toEqual([]);
  });
});

describe("o resultado de uma célula só", () => {
  it("é livre, como o valor de uma métrica", () => {
    const l = leituraDaConsulta(
      "SELECT SUM(valor) AS total FROM lancamento",
      { colunas: ["total"], linhas: [{ total: 1200 }], truncado: false },
      { total: "reais" },
      ["amanna_chat"],
      "2026-12-31",
    );
    const permitidos = numerosDaConsulta(l);
    expect(permitidos).toHaveLength(1);
    expect(permitidos[0]?.rotulos).toBeNull();
    expect(permitidos[0]?.texto).toBe("R$ 1.200,00");
  });
});
