/**
 * As referências externas do chat: Selic, CDI e IPCA pelo SGS do BCB.
 *
 * A saída de rede é decisão registrada (D-CHAT), e a disciplina é a mesma para
 * as três: cache de uma hora, tempo limite, e `null` quando o BCB não responde
 * — nunca uma exceção que derrube a resposta.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { lerSelic } from "@/acesso/referencias/selic";
import {
  esquecerSeries,
  lerSerieDoSgs,
  type SerieDoSgs,
} from "@/acesso/referencias/sgs";
import { lerReferencias } from "@/acesso/referencias/todas";

const CDI: SerieDoSgs = {
  id: "cdi",
  serie: 4389,
  nome: "CDI",
  periodicidade: "ao ano",
};

/** Uma resposta do SGS, ou uma falha HTTP. */
function respostaDoSgs(corpo: unknown, ok = true): Response {
  return { ok, json: async () => corpo } as unknown as Response;
}

beforeEach(() => {
  esquecerSeries();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("lerSerieDoSgs", () => {
  it("monta o endereço da série pedida e lê valor e data", async () => {
    const fetchFalso = vi.fn(async (url: string | URL | Request) => {
      expect(String(url)).toContain("bcdata.sgs.4389/dados/ultimos/1");
      return respostaDoSgs([{ data: "02/09/2026", valor: "13.90" }]);
    });
    vi.stubGlobal("fetch", fetchFalso);

    const taxa = await lerSerieDoSgs(CDI);
    expect(taxa).toEqual({
      id: "cdi",
      nome: "CDI",
      valor: 13.9,
      periodicidade: "ao ano",
      vigenteDesde: "2026-09-02",
      fonte: "Banco Central do Brasil · SGS série 4389",
    });
  });

  it.each([
    ["resposta HTTP de erro", respostaDoSgs([], false)],
    ["corpo vazio", respostaDoSgs([])],
    ["valor que não é número", respostaDoSgs([{ data: "x", valor: "n/d" }])],
  ])("devolve null com %s", async (_caso, resposta) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => resposta),
    );
    expect(await lerSerieDoSgs(CDI)).toBeNull();
  });

  it("devolve null quando a rede falha", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("rede fora");
      }),
    );
    expect(await lerSerieDoSgs(CDI)).toBeNull();
  });

  it("guarda em cache: duas leituras, uma ida ao BCB", async () => {
    const fetchFalso = vi.fn(async () =>
      respostaDoSgs([{ data: "02/09/2026", valor: "13.90" }]),
    );
    vi.stubGlobal("fetch", fetchFalso);

    await lerSerieDoSgs(CDI);
    await lerSerieDoSgs(CDI);
    expect(fetchFalso).toHaveBeenCalledTimes(1);

    esquecerSeries();
    await lerSerieDoSgs(CDI);
    expect(fetchFalso).toHaveBeenCalledTimes(2);
  });
});

describe("lerSelic", () => {
  it("é a série 432, com o nome que o texto usa", async () => {
    const fetchFalso = vi.fn(async (url: string | URL | Request) => {
      expect(String(url)).toContain("bcdata.sgs.432/");
      return respostaDoSgs([{ data: "16/09/2026", valor: "14.00" }]);
    });
    vi.stubGlobal("fetch", fetchFalso);

    const taxa = await lerSelic();
    expect(taxa?.nome).toBe("Meta Selic");
    expect(taxa?.valor).toBe(14);
    expect(taxa?.vigenteDesde).toBe("2026-09-16");
  });
});

describe("lerReferencias", () => {
  it("lê as três em paralelo e deixa de fora a que falhou, na ordem", async () => {
    const fetchFalso = vi.fn(async (url: string | URL | Request) => {
      const endereco = String(url);
      if (endereco.includes("sgs.432/")) {
        return respostaDoSgs([{ data: "16/09/2026", valor: "14.00" }]);
      }
      if (endereco.includes("sgs.4389/")) {
        return respostaDoSgs([{ data: "02/09/2026", valor: "13.90" }]);
      }
      return respostaDoSgs([], false);
    });
    vi.stubGlobal("fetch", fetchFalso);

    const taxas = await lerReferencias();
    expect(fetchFalso).toHaveBeenCalledTimes(3);
    expect(taxas.map((t) => t.id)).toEqual(["selic", "cdi"]);
  });
});
