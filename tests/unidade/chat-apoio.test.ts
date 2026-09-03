/**
 * As métricas de apoio do chat (T-328) e a resolução com referências.
 *
 * O mapa `APOIO` é código, mas é tão fechado quanto o esquema do catálogo: id
 * que não existe reprova aqui. E a leitura de apoio passa pelo mesmo
 * `lerMetrica` que a principal — no mesmo recorte, pela mesma fronteira.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { APOIO, MAXIMO_DE_APOIO } from "@/chat/apoio";
import { lerApoio, resolver } from "@/chat/resolver";
import { CATALOGO_GERADO } from "@/semantica/catalogo-gerado";
import { QUERY_PADRAO } from "@/semantica/contrato";

vi.hoisted(() => {
  process.env["DATA_SOURCE"] = "fixtures";
  process.env["AUTH_PROVIDER"] = "fixtures";
});

/** O BCB, sem rede: Selic 14,00, CDI 13,90 e IPCA 4,44. */
function bcbFalso(url: string | URL | Request): Promise<Response> {
  const endereco = String(url);
  const linha = endereco.includes("sgs.432/")
    ? { data: "16/09/2026", valor: "14.00" }
    : endereco.includes("sgs.4389/")
      ? { data: "02/09/2026", valor: "13.90" }
      : { data: "01/07/2026", valor: "4.44" };
  return Promise.resolve({
    ok: true,
    json: async () => [linha],
  } as unknown as Response);
}

beforeAll(() => {
  vi.stubGlobal("fetch", vi.fn(bcbFalso));
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("o mapa de apoio", () => {
  it("toda chave e todo id de apoio existem no catálogo", () => {
    const fora: string[] = [];
    for (const [principal, apoios] of Object.entries(APOIO)) {
      if (CATALOGO_GERADO[principal] === undefined) fora.push(principal);
      for (const id of apoios) {
        if (CATALOGO_GERADO[id] === undefined)
          fora.push(`${principal} → ${id}`);
      }
    }
    expect(fora).toEqual([]);
  });

  it("nenhuma métrica se apoia em si mesma, repete apoio ou passa do máximo", () => {
    const problemas: string[] = [];
    for (const [principal, apoios] of Object.entries(APOIO)) {
      if (apoios.includes(principal)) problemas.push(`${principal}: em si`);
      if (new Set(apoios).size !== apoios.length) {
        problemas.push(`${principal}: repetido`);
      }
      if (apoios.length > MAXIMO_DE_APOIO) {
        problemas.push(`${principal}: ${String(apoios.length)} apoios`);
      }
    }
    expect(problemas).toEqual([]);
  });
});

describe("a leitura de apoio", () => {
  it("lê cada apoio no mesmo recorte, com o rótulo do catálogo", async () => {
    const mapa = () => ["lucro_liquido", "receita_liquida"];
    const apoio = await lerApoio("margem_liquida", QUERY_PADRAO, mapa);

    expect(apoio.map((a) => a.metrica)).toEqual([
      "lucro_liquido",
      "receita_liquida",
    ]);
    expect(apoio.map((a) => a.rotulo)).toEqual([
      CATALOGO_GERADO["lucro_liquido"]?.rotulo,
      CATALOGO_GERADO["receita_liquida"]?.rotulo,
    ]);
    for (const a of apoio) {
      expect(a.origem).toBe("apoio");
      expect(a.unidade).toBe("BRL_mi");
      expect(typeof a.valor).toBe("number");
    }
  });

  it("muda com o recorte, como a principal", async () => {
    const mapa = () => ["receita_liquida"];
    const [consolidado] = await lerApoio("margem_liquida", QUERY_PADRAO, mapa);
    const [unidade] = await lerApoio(
      "margem_liquida",
      { ...QUERY_PADRAO, entidade: "unidade-sp" },
      mapa,
    );
    expect(consolidado?.valor).not.toBeNull();
    expect(unidade?.valor).not.toBeNull();
    expect(consolidado?.valor).not.toBe(unidade?.valor);
  });
});

describe("resolver, com apoio e referências", () => {
  it("o EBITDA vem com apoio, as três taxas e a leitura contra a Selic", async () => {
    const r = await resolver("ebitda", QUERY_PADRAO);

    expect(r.familia).toBe("resultado");
    expect(r.referencias.map((t) => t.id)).toEqual([
      "selic",
      "cdi",
      "ipca_12m",
    ]);
    expect(
      r.consideracoes.filter((c) => c.origem === "apoio").map((c) => c.metrica),
    ).toEqual(APOIO["ebitda"]);
    expect(r.comparacao?.leituras.map((l) => l.rotulo)).toEqual([
      "Retorno sobre a receita líquida",
      "Diferença para a Selic",
    ]);
    expect(r.comparacao?.base?.rotulo).toBe("Receita líquida");
  });

  it("uma métrica sem família não vai ao BCB e diz por quê", async () => {
    const fetchFalso = vi.mocked(fetch);
    fetchFalso.mockClear();

    const r = await resolver("turnover_12m", QUERY_PADRAO);
    expect(r.familia).toBeNull();
    expect(r.referencias).toEqual([]);
    expect(r.comparacao).toBeNull();
    expect(r.comparacaoIndisponivelPorque).toBe(
      "esta métrica não se lê contra juros",
    );
    expect(fetchFalso).not.toHaveBeenCalled();
  });
});
