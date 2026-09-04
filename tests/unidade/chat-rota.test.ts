import { beforeAll, describe, expect, it } from "vitest";

import { lerPedido } from "@/chat/pedido";
import { TAMANHO_MAXIMO_DA_PERGUNTA, TURNOS_LEMBRADOS } from "@/chat/protocolo";
import type { LinhaDoFluxo } from "@/chat/protocolo";

import { POST } from "../../src/app/api/chat/route";

/**
 * A rota `/api/chat`: o que ela aceita e o que ela devolve.
 *
 * Sem gateway configurado, de propósito: o que se prova aqui é o contrato —
 * as duas fases, a recusa, a validação — e não a redação do modelo.
 */

beforeAll(() => {
  process.env["DATA_SOURCE"] = "fixtures";
  process.env["AUTH_PROVIDER"] = "fixtures";
  delete process.env["OPENROUTER_API_KEY"];
});

function pedido(corpo: unknown): Request {
  return new Request("http://painel.local/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof corpo === "string" ? corpo : JSON.stringify(corpo),
  });
}

async function linhasDe(resposta: Response): Promise<readonly LinhaDoFluxo[]> {
  const texto = await resposta.text();
  return texto
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => JSON.parse(l) as LinhaDoFluxo);
}

describe("lerPedido", () => {
  it("aceita pergunta, busca e histórico", () => {
    expect(
      lerPedido({
        pergunta: "  qual o turnover ",
        busca: "periodo=dezembro",
        historico: [{ pergunta: "antes", metrica: "roe" }],
      }),
    ).toEqual({
      pergunta: "qual o turnover",
      busca: "periodo=dezembro",
      historico: [{ pergunta: "antes", metrica: "roe" }],
    });
  });

  it("busca e histórico são opcionais", () => {
    expect(lerPedido({ pergunta: "x" })).toEqual({
      pergunta: "x",
      busca: "",
      historico: [],
    });
  });

  it("recusa o que não é pedido", () => {
    expect(lerPedido(null)).toBeNull();
    expect(lerPedido("x")).toBeNull();
    expect(lerPedido({})).toBeNull();
    expect(lerPedido({ pergunta: "" })).toBeNull();
    expect(lerPedido({ pergunta: "   " })).toBeNull();
    expect(lerPedido({ pergunta: 1 })).toBeNull();
    expect(lerPedido({ pergunta: "x", busca: 1 })).toBeNull();
    expect(lerPedido({ pergunta: "x", historico: "y" })).toBeNull();
  });

  it("recusa pergunta acima do teto", () => {
    expect(
      lerPedido({ pergunta: "a".repeat(TAMANHO_MAXIMO_DA_PERGUNTA + 1) }),
    ).toBeNull();
    expect(
      lerPedido({ pergunta: "a".repeat(TAMANHO_MAXIMO_DA_PERGUNTA) }),
    ).not.toBeNull();
  });

  it("id de métrica que o catálogo não conhece vira null, e turno sem pergunta cai", () => {
    expect(
      lerPedido({
        pergunta: "x",
        historico: [
          { pergunta: "a", metrica: "metrica_inventada" },
          { pergunta: "b", metrica: 3 },
          { metrica: "roe" },
          { pergunta: "c", metrica: "roe" },
        ],
      })?.historico,
    ).toEqual([
      { pergunta: "a", metrica: null },
      { pergunta: "b", metrica: null },
      { pergunta: "c", metrica: "roe" },
    ]);
  });

  it("lembra só os últimos turnos", () => {
    const longo = Array.from({ length: TURNOS_LEMBRADOS + 4 }, (_, i) => ({
      pergunta: String(i),
      metrica: null,
    }));
    const lido = lerPedido({ pergunta: "x", historico: longo });
    expect(lido?.historico).toHaveLength(TURNOS_LEMBRADOS);
    expect(lido?.historico.at(-1)?.pergunta).toBe(String(TURNOS_LEMBRADOS + 3));
  });
});

describe("POST /api/chat", () => {
  it("corpo que não é JSON é 400", async () => {
    const resposta = await POST(pedido("{isto não é json"));
    expect(resposta.status).toBe(400);
  });

  it("pedido malformado é 400", async () => {
    const resposta = await POST(pedido({ pergunta: "" }));
    expect(resposta.status).toBe(400);
  });

  it("responde em duas fases: a prévia com as ações, depois a resposta", async () => {
    const resposta = await POST(
      pedido({ pergunta: "qual o turnover", busca: "periodo=dezembro" }),
    );
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get("content-type")).toContain("x-ndjson");

    const linhas = await linhasDe(resposta);
    expect(linhas.map((l) => l.fase)).toEqual(["previa", "resposta"]);

    const [previa, final] = linhas;
    if (previa?.fase !== "previa" || final?.fase !== "resposta") return;
    expect(previa.previa.metrica).toBe("turnover_12m");
    // O recorte da URL da tela chegou: a pergunta herdou dezembro.
    expect(previa.previa.acoes.filtros.periodo).toBe("dezembro");
    expect(previa.previa.acoes.tela).toBe("rh/visao");
    expect(previa.previa.acoes.painel).toBe("rh-turnover");

    expect(final.resposta.tipo).toBe("resposta");
    if (final.resposta.tipo !== "resposta") return;
    expect(final.resposta.resolucao.metrica).toBe("turnover_12m");
    expect(final.resposta.autoria).toBe("montado");
    expect(final.resposta.sugestoes.length).toBeGreaterThan(0);
  });

  it("a recusa chega numa fase só, sem prévia", async () => {
    const resposta = await POST(pedido({ pergunta: "Quanto vale a empresa?" }));
    const linhas = await linhasDe(resposta);
    expect(linhas.map((l) => l.fase)).toEqual(["resposta"]);
    const [unica] = linhas;
    if (unica?.fase !== "resposta") return;
    expect(unica.resposta.tipo).toBe("recusa");
  });

  it("a continuação usa o histórico que veio no pedido", async () => {
    const resposta = await POST(
      pedido({
        pergunta: "E em dezembro?",
        historico: [{ pergunta: "qual o turnover", metrica: "turnover_12m" }],
      }),
    );
    const [previa] = await linhasDe(resposta);
    expect(previa?.fase).toBe("previa");
    if (previa?.fase !== "previa") return;
    expect(previa.previa.metrica).toBe("turnover_12m");
    expect(previa.previa.acoes.filtros.periodo).toBe("dezembro");
  });

  it("busca hostil não derruba a rota: cai no padrão", async () => {
    const resposta = await POST(
      pedido({
        pergunta: "qual o turnover",
        busca: "periodo=&area=%%%&ano=abacaxi",
      }),
    );
    expect(resposta.status).toBe(200);
    const [previa] = await linhasDe(resposta);
    if (previa?.fase !== "previa") return;
    expect(previa.previa.acoes.filtros.periodo).toBe("12-meses");
  });
});
