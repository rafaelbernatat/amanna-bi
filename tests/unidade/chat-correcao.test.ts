import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { formatarValor } from "@/apresentacao/formato/formato";
import { contextoDe } from "@/chat/contexto";
import {
  numerosPermitidosDe,
  redigirResposta,
  RODADAS_DE_CORRECAO,
} from "@/chat/perguntar";
import { resolver } from "@/chat/resolver";
import { QUERY_PADRAO } from "@/semantica/contrato";

/**
 * A rodada única de correção (T-433).
 *
 * RF-15 continua bloqueando: texto com número fora do envelope não vai para a
 * tela. O que muda é que o modelo recebe o próprio texto, os números recusados
 * e a lista do que pode citar, e reescreve **uma** vez — conferida pelo mesmo
 * verificador. Os dois incidentes ficam registrados: a frequência que a seção
 * 7.7 mede não diminui por causa da correção.
 */

beforeAll(() => {
  process.env["DATA_SOURCE"] = "fixtures";
  process.env["AUTH_PROVIDER"] = "fixtures";
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const CONTEXTO = contextoDe("rh/visao", "", ["2026"]);
const PERGUNTA = "Qual o turnover?";
const INVENTADO = "99,9%";
const INVENTADO_DE_NOVO = "88,8%";

type Corpo = { readonly messages: { role: string; content: string }[] };

/** Um redator falso: a primeira ida diz `primeiro`; a de correção, `segundo`. */
function redatorFalso(primeiro: string, segundo: string) {
  const pedidos: Corpo[] = [];
  vi.stubGlobal("fetch", async (_url: string, init: { body: string }) => {
    const corpo = JSON.parse(init.body) as Corpo;
    pedidos.push(corpo);
    const correcao = corpo.messages.some((m) => m.role === "assistant");
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: correcao ? segundo : primeiro } }],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  });
  return { pedidos };
}

function incidentes(aviso: {
  readonly mock: { readonly calls: readonly (readonly unknown[])[] };
}): readonly string[] {
  return aviso.mock.calls
    .map((c) => String(c[0]))
    .filter((l) => l.includes("chat.verificador_recusou"));
}

describe("a rodada de correção (T-433)", () => {
  it("é uma só", () => {
    expect(RODADAS_DE_CORRECAO).toBe(1);
  });

  it("um número inventado volta ao modelo com os permitidos, e a reescrita passa", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "k");
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const r = await resolver("turnover_12m", QUERY_PADRAO);
    if (r.valor === null) throw new Error("esperava valor");
    const certo = formatarValor(r.valor, r.unidade);
    const { pedidos } = redatorFalso(
      `O turnover foi ${INVENTADO} no ano.`,
      `O turnover foi ${certo} no ano. Quer ver por área?`,
    );

    const resposta = await redigirResposta(PERGUNTA, r, undefined, CONTEXTO);
    if (resposta.tipo !== "resposta") throw new Error("esperava resposta");
    expect(resposta.autoria).toBe("modelo-corrigido");
    expect(resposta.texto).toContain(certo);
    expect(resposta.texto).not.toContain(INVENTADO);

    // A segunda ida leva o texto recusado, os números e a lista de permitidos.
    expect(pedidos).toHaveLength(2);
    const ultima = pedidos[1]?.messages ?? [];
    expect(ultima.map((m) => m.role)).toEqual([
      "system",
      "user",
      "assistant",
      "user",
    ]);
    expect(ultima[2]?.content).toContain(INVENTADO);
    expect(ultima[3]?.content).toContain(`Números recusados: ${INVENTADO}`);
    expect(ultima[3]?.content).toContain(certo);

    // A primeira recusa fica registrada, mesmo corrigida.
    const registrados = incidentes(aviso);
    expect(registrados).toHaveLength(1);
    expect(registrados[0]).toContain('"tentativa":1');
  });

  it("recusa dupla cai no texto montado, com dois incidentes", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "k");
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const r = await resolver("turnover_12m", QUERY_PADRAO);
    if (r.valor === null) throw new Error("esperava valor");
    const certo = formatarValor(r.valor, r.unidade);
    const { pedidos } = redatorFalso(
      `O turnover foi ${INVENTADO} no ano.`,
      `Agora foi ${INVENTADO_DE_NOVO}.`,
    );

    const resposta = await redigirResposta(PERGUNTA, r, undefined, CONTEXTO);
    if (resposta.tipo !== "resposta") throw new Error("esperava resposta");
    expect(resposta.autoria).toBe("modelo-recusado");
    expect(resposta.texto).toContain(`${r.rotulo}: ${certo}`);
    expect(resposta.texto).not.toContain(INVENTADO);
    expect(resposta.texto).not.toContain(INVENTADO_DE_NOVO);
    expect(pedidos).toHaveLength(RODADAS_DE_CORRECAO + 1);

    const registrados = incidentes(aviso);
    expect(registrados).toHaveLength(2);
    expect(registrados[1]).toContain(
      `"tentativa":${String(RODADAS_DE_CORRECAO + 1)}`,
    );
    expect(registrados[1]).toContain('"reescrito":true');
  });

  it("sem gateway não há correção nem ida ao modelo", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const r = await resolver("turnover_12m", QUERY_PADRAO);
    const { pedidos } = redatorFalso("x", "y");
    const resposta = await redigirResposta(PERGUNTA, r, undefined, CONTEXTO);
    if (resposta.tipo !== "resposta") throw new Error("esperava resposta");
    expect(resposta.autoria).toBe("montado");
    expect(pedidos).toHaveLength(0);
  });

  it("os permitidos enviados são exatamente os do envelope", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "k");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const r = await resolver("turnover_12m", QUERY_PADRAO);
    const permitidos = numerosPermitidosDe(r, PERGUNTA);
    const { pedidos } = redatorFalso(`Foi ${INVENTADO}.`, "Sem número.");
    await redigirResposta(PERGUNTA, r, undefined, CONTEXTO);
    const ultima = pedidos[1]?.messages.at(-1)?.content ?? "";
    expect(ultima).toContain(`Permitidos: ${permitidos.join(" | ")}`);
    if (r.valor !== null) {
      expect(permitidos).toContain(formatarValor(r.valor, r.unidade));
    }
  });
});
