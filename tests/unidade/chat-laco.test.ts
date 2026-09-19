import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { contextoDe } from "@/chat/contexto";
import { inspecionarSaida } from "@/chat/ferramentas/inspetor";
import { PASSO_DE_REDACAO } from "@/chat/ferramentas/passos";
import {
  INSTRUCAO_DO_LACO,
  metricaDoPainel,
  painelDaComposta,
  resolverComposta,
} from "@/chat/laco";
import { redigirResposta, resolverPergunta } from "@/chat/perguntar";
import {
  conversarComFerramentas,
  type Chamada,
  type Mensagem,
} from "@/gateway/openrouter";

/**
 * O laço de ferramentas, com o gateway substituído (D-CHAT-ferramentas, T-350).
 *
 * O `fetch` é falso: cada resposta do "modelo" é escrita aqui. O que se prova
 * é o protocolo — toda chamada recebe resposta, o limite de rodadas força o
 * texto, o inspetor bloqueia — e a costura com o resto do chat: a pergunta
 * composta vira uma `Resolucao` com leituras, o texto passa pelo verificador,
 * e sem gateway a recusa é útil.
 */

beforeAll(() => {
  process.env["DATA_SOURCE"] = "fixtures";
  process.env["AUTH_PROVIDER"] = "fixtures";
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

/**
 * O texto de uma mensagem como ela foi para o fio.
 *
 * Desde T-438 a mensagem de sistema sai no formato de partes, com o ponto de
 * corte do cache de prompt, quando o modelo é da Anthropic. O que os testes
 * provam — que a instrução que sai é a nossa — não muda; muda o lugar de onde
 * se lê o texto.
 */
function textoDa(mensagem: { readonly content?: unknown }): string {
  const conteudo = mensagem.content;
  if (typeof conteudo === "string") return conteudo;
  if (!Array.isArray(conteudo)) return "";
  return (conteudo as { readonly text?: unknown }[])
    .map((parte) => (typeof parte.text === "string" ? parte.text : ""))
    .join("");
}

/** As mensagens do fio de volta ao formato de texto, para o inspetor. */
function comoTexto(
  mensagens: readonly { readonly role: string; readonly content?: unknown }[],
): Mensagem[] {
  return mensagens.map(
    (m) => ({ ...m, content: textoDa(m) }) as unknown as Mensagem,
  );
}

type Rodada = {
  readonly content?: string | null;
  readonly tool_calls?: readonly {
    readonly id: string;
    readonly nome: string;
    readonly argumentos: unknown;
  }[];
};

/** Um gateway falso que responde as rodadas na ordem, e guarda o que recebeu. */
function gatewayFalso(rodadas: readonly Rodada[]) {
  const pedidos: Record<string, unknown>[] = [];
  let i = 0;
  vi.stubGlobal("fetch", async (_url: string, init: { body: string }) => {
    pedidos.push(JSON.parse(init.body) as Record<string, unknown>);
    const rodada = rodadas[Math.min(i, rodadas.length - 1)];
    i += 1;
    const message = {
      content: rodada?.content ?? null,
      tool_calls: (rodada?.tool_calls ?? []).map((c) => ({
        id: c.id,
        type: "function",
        function: { name: c.nome, arguments: JSON.stringify(c.argumentos) },
      })),
    };
    return new Response(
      JSON.stringify({
        choices: [{ message }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  });
  return { pedidos };
}

const LIMITES = {
  maximoDeRodadas: 3,
  tetoDeSaida: 400,
  limiteMsPorRodada: 5000,
};
const FERRAMENTAS = [
  { nome: "ler", descricao: "lê", parametros: { type: "object" } },
];
const MENSAGENS: readonly Mensagem[] = [
  { role: "system", content: "sistema" },
  { role: "user", content: "pergunta" },
];

describe("conversarComFerramentas", () => {
  it("sem chave, não chama nada", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const { pedidos } = gatewayFalso([{ content: "x" }]);
    const r = await conversarComFerramentas(
      MENSAGENS,
      FERRAMENTAS,
      async () => "{}",
      LIMITES,
    );
    expect(r).toBeNull();
    expect(pedidos).toHaveLength(0);
  });

  it("duas chamadas paralelas recebem duas respostas, e o texto sai na rodada seguinte", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "k");
    const { pedidos } = gatewayFalso([
      {
        tool_calls: [
          { id: "a", nome: "ler", argumentos: { m: 1 } },
          { id: "b", nome: "ler", argumentos: { m: 2 } },
        ],
      },
      { content: "Pronto." },
    ]);
    const executadas: Chamada[] = [];
    const r = await conversarComFerramentas(
      MENSAGENS,
      FERRAMENTAS,
      async (c) => {
        executadas.push(c);
        return JSON.stringify({ ok: c.argumentos });
      },
      LIMITES,
    );
    expect(r?.texto).toBe("Pronto.");
    expect(r?.parada).toBe("texto");
    expect(r?.rodadas).toBe(2);
    expect(executadas.map((c) => c.id)).toEqual(["a", "b"]);
    expect(r?.tokens).toEqual({ entrada: 20, saida: 10, cacheLido: 0 });

    // A primeira rodada exige ferramenta; a segunda deixa o modelo escolher.
    expect(pedidos[0]?.["tool_choice"]).toBe("required");
    expect(pedidos[1]?.["tool_choice"]).toBe("auto");
    // As duas respostas de ferramenta foram para o modelo, na ordem.
    const mensagens = pedidos[1]?.["messages"] as {
      role: string;
      tool_call_id?: string;
    }[];
    expect(
      mensagens.filter((m) => m.role === "tool").map((m) => m.tool_call_id),
    ).toEqual(["a", "b"]);
  });

  it("argumentos que não são JSON chegam como nulo, e ainda recebem resposta", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "k");
    vi.stubGlobal("fetch", async (_u: string, init: { body: string }) => {
      const corpo = JSON.parse(init.body) as { messages: { role: string }[] };
      const jaRespondeu = corpo.messages.some((m) => m.role === "tool");
      const message = jaRespondeu
        ? { content: "fim" }
        : {
            content: null,
            tool_calls: [
              {
                id: "q",
                type: "function",
                function: { name: "ler", arguments: "{isto" },
              },
            ],
          };
      return new Response(JSON.stringify({ choices: [{ message }] }), {
        status: 200,
      });
    });
    const vistas: unknown[] = [];
    const r = await conversarComFerramentas(
      MENSAGENS,
      FERRAMENTAS,
      async (c) => {
        vistas.push(c.argumentos);
        return "{}";
      },
      LIMITES,
    );
    expect(vistas).toEqual([null]);
    expect(r?.texto).toBe("fim");
  });

  it("esgotadas as rodadas, a última força o texto com tool_choice none", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "k");
    const { pedidos } = gatewayFalso([
      { tool_calls: [{ id: "1", nome: "ler", argumentos: {} }] },
      { tool_calls: [{ id: "2", nome: "ler", argumentos: {} }] },
      { tool_calls: [{ id: "3", nome: "ler", argumentos: {} }] },
      { content: "com o que tenho" },
    ]);
    const r = await conversarComFerramentas(
      MENSAGENS,
      FERRAMENTAS,
      async () => "{}",
      LIMITES,
    );
    expect(r?.parada).toBe("rodadas_esgotadas");
    expect(r?.texto).toBe("com o que tenho");
    expect(pedidos.at(-1)?.["tool_choice"]).toBe("none");
    expect(pedidos).toHaveLength(LIMITES.maximoDeRodadas + 1);
  });

  it("o inspetor que bloqueia derruba o laço antes de a rodada sair", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "k");
    const { pedidos } = gatewayFalso([{ content: "x" }]);
    const r = await conversarComFerramentas(
      MENSAGENS,
      FERRAMENTAS,
      async () => "{}",
      LIMITES,
      {
        inspetor: () => ({ motivo: "teste" }),
      },
    );
    expect(r).toBeNull();
    expect(pedidos).toHaveLength(0);
  });

  it("gateway que responde erro HTTP é nulo", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "k");
    vi.stubGlobal("fetch", async () => new Response("nope", { status: 402 }));
    expect(
      await conversarComFerramentas(
        MENSAGENS,
        FERRAMENTAS,
        async () => "{}",
        LIMITES,
      ),
    ).toBeNull();
  });
});

/* ------------------------------------------------------------------ *
 * A costura com o chat
 * ------------------------------------------------------------------ */

describe("resolverComposta", () => {
  const CONTEXTO = contextoDe("fin/visao", "painel=fin-dre", ["2026"]);

  it("sem gateway, 'explica esse gráfico' responde pelo painel em foco", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const r = await resolverComposta(
      "O que esse gráfico mostra?",
      CONTEXTO,
      [],
    );
    expect(r?.tipo).toBe("composta");
    if (r?.tipo !== "composta") return;
    expect(r.texto).toBeNull();
    expect(r.resolucao.caminho).toBe("composto");
    expect(r.resolucao.leituras[0]?.ferramenta).toBe("explicar_grafico");
    expect(r.resolucao.metrica).toBe(metricaDoPainel("fin-dre"));
  });

  it("sem gateway, um ranking nomeado responde de forma determinística", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const r = await resolverComposta(
      "Quais os maiores clientes por receita líquida?",
      CONTEXTO,
      [],
    );
    expect(r?.tipo).toBe("composta");
    if (r?.tipo !== "composta") return;
    expect(r.resolucao.leituras.map((l) => l.ferramenta)).toContain("ranking");
  });

  it("sem gateway, o resto recebe a recusa útil", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const r = await resolverComposta(
      "Compare a margem líquida com o turnover",
      CONTEXTO,
      [],
    );
    expect(r?.tipo).toBe("recusa");
    if (r?.tipo !== "recusa") return;
    expect(r.texto).toMatch(/uma métrica por vez/);
  });

  it("com gateway, o modelo pede um ranking, escreve, e o texto passa pelo verificador", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "k");
    let ranking: { itens: { rotulo: string; valor: string }[] } | null = null;
    vi.stubGlobal("fetch", async (_u: string, init: { body: string }) => {
      const corpo = JSON.parse(init.body) as {
        messages: { role: string; content: string }[];
        tools: unknown[];
      };
      const resultado = corpo.messages.find((m) => m.role === "tool");
      let message: unknown;
      if (resultado === undefined) {
        expect(corpo.tools.length).toBe(8);
        expect(
          textoDa(corpo.messages[0] ?? {}).startsWith(INSTRUCAO_DO_LACO),
        ).toBe(true);
        message = {
          content: null,
          tool_calls: [
            {
              id: "r1",
              type: "function",
              function: {
                name: "ranking",
                arguments: JSON.stringify({
                  metrica: "receita_liquida",
                  dimensao: "cliente",
                  topN: 3,
                }),
              },
            },
          ],
        };
      } else {
        ranking = JSON.parse(resultado.content) as typeof ranking;
        const primeiro = ranking?.itens[0];
        message = {
          content: `O maior cliente é ${primeiro?.rotulo ?? ""}, com ${primeiro?.valor ?? ""} no ano. Quer ver o segundo?`,
        };
      }
      return new Response(JSON.stringify({ choices: [{ message }] }), {
        status: 200,
      });
    });

    const resolvida = await resolverPergunta(
      "Top 3 clientes por receita",
      CONTEXTO,
      [],
    );
    expect(resolvida.tipo).toBe("resolvida");
    if (resolvida.tipo !== "resolvida") return;
    expect(resolvida.resolucao.caminho).toBe("composto");
    expect(resolvida.resolucao.leituras[0]?.ferramenta).toBe("ranking");
    expect(resolvida.redacao?.autoria).toBe("modelo");

    const resposta = await redigirResposta(
      "Top 3 clientes por receita",
      resolvida.resolucao,
      resolvida.redacao,
      CONTEXTO,
    );
    expect(resposta.tipo).toBe("resposta");
    if (resposta.tipo !== "resposta") return;
    // O texto do modelo cita o item junto do nome: o verificador aceita.
    expect(resposta.autoria).toBe("modelo");
    expect(resposta.texto).toMatch(/maior cliente/);
  });

  it("com gateway, um número inventado no texto composto é recusado e o montado entra", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "k");
    vi.stubGlobal("fetch", async (_u: string, init: { body: string }) => {
      const corpo = JSON.parse(init.body) as { messages: { role: string }[] };
      const message = corpo.messages.some((m) => m.role === "tool")
        ? { content: "Os três somam R$ 777,7 mi." }
        : {
            content: null,
            tool_calls: [
              {
                id: "r1",
                type: "function",
                function: {
                  name: "ranking",
                  arguments: JSON.stringify({
                    metrica: "receita_liquida",
                    dimensao: "cliente",
                  }),
                },
              },
            ],
          };
      return new Response(JSON.stringify({ choices: [{ message }] }), {
        status: 200,
      });
    });
    const resolvida = await resolverPergunta(
      "Top clientes por receita",
      CONTEXTO,
      [],
    );
    if (resolvida.tipo !== "resolvida") throw new Error("esperava resolvida");
    const resposta = await redigirResposta(
      "Top clientes por receita",
      resolvida.resolucao,
      resolvida.redacao,
      CONTEXTO,
    );
    if (resposta.tipo !== "resposta") throw new Error("esperava resposta");
    expect(resposta.autoria).toBe("modelo-recusado");
    expect(resposta.texto).not.toContain("777,7");
    expect(resposta.texto).toMatch(/por cliente/);
  });

  it("gateway que cai no meio degrada ao caminho simples, e o texto diz", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "k");
    vi.stubGlobal("fetch", async () => new Response("erro", { status: 500 }));
    const resolvida = await resolverPergunta(
      "Top clientes por receita líquida",
      CONTEXTO,
      [],
    );
    expect(resolvida.tipo).toBe("resolvida");
    if (resolvida.tipo !== "resolvida") return;
    expect(resolvida.resolucao.caminho).toBe("degradado");
    const resposta = await redigirResposta(
      "Top clientes por receita líquida",
      resolvida.resolucao,
      undefined,
      CONTEXTO,
    );
    if (resposta.tipo !== "resposta") throw new Error("esperava resposta");
    expect(resposta.texto).toMatch(/parte composta/);
  });
});

/* ------------------------------------------------------------------ *
 * O que o laço desenha e conta (T-432, T-434)
 * ------------------------------------------------------------------ */

describe("o que o laço desenha e conta", () => {
  const CONTEXTO = contextoDe("fin/visao", "painel=fin-dre", ["2026"]);
  const PERGUNTA = "Top 3 clientes por receita";

  /** O modelo pede um ranking e, com ele na mão, escreve sem número. */
  function rankingFalso() {
    vi.stubGlobal("fetch", async (_u: string, init: { body: string }) => {
      const corpo = JSON.parse(init.body) as { messages: { role: string }[] };
      const message = corpo.messages.some((m) => m.role === "tool")
        ? { content: "Os maiores clientes estão listados. Quer o segundo?" }
        : {
            content: null,
            tool_calls: [
              {
                id: "r1",
                type: "function",
                function: {
                  name: "ranking",
                  arguments: JSON.stringify({
                    metrica: "receita_liquida",
                    dimensao: "cliente",
                    topN: 3,
                  }),
                },
              },
            ],
          };
      return new Response(JSON.stringify({ choices: [{ message }] }), {
        status: 200,
      });
    });
  }

  it("o ranking lido vira o gráfico da resposta, em barras, e vence o painel da métrica", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "k");
    rankingFalso();
    const r = await resolverComposta(PERGUNTA, CONTEXTO, []);
    if (r?.tipo !== "composta") throw new Error("esperava composta");
    expect(r.resolucao.painel?.id).toBe("chat-ranking-receita_liquida-cliente");
    expect(r.resolucao.painel?.forma).toBe("barras-horizontais");
    if (r.resolucao.painel?.forma !== "barras-horizontais") return;
    expect(r.resolucao.painel.categories).toHaveLength(3);
    expect(r.resolucao.painel.series[0]?.values).toHaveLength(3);
    expect(painelDaComposta([])).toBeNull();
  });

  it("cada leitura vira um passo, a redação vira outro, e a prévia sai antes do texto", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "k");
    rankingFalso();
    const passos: string[] = [];
    const previas: string[] = [];
    const ordem: string[] = [];
    const r = await resolverComposta(PERGUNTA, CONTEXTO, [], undefined, {
      aoAndamento: (passo) => {
        passos.push(passo);
        ordem.push("passo");
      },
      aoPrevia: (resolucao) => {
        previas.push(resolucao.metrica);
        ordem.push("previa");
      },
    });
    expect(passos).toEqual([
      "Lendo Receita líquida por cliente…",
      PASSO_DE_REDACAO,
    ]);
    expect(previas).toEqual(["receita_liquida"]);
    expect(ordem).toEqual(["passo", "previa", "passo"]);
    if (r?.tipo !== "composta") throw new Error("esperava composta");
    expect(r.resolucao.metrica).toBe("receita_liquida");
  });

  it("um gateway que responde erro registra estágio, modelo, rodada e status", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "k");
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(
          JSON.stringify({ error: { message: "No endpoints found" } }),
          { status: 404 },
        ),
    );
    const r = await resolverComposta(PERGUNTA, CONTEXTO, []);
    expect(r).toBeNull();
    const linha = aviso.mock.calls
      .map((c) => String(c[0]))
      .find((l) => l.includes("chat.gateway_falhou"));
    expect(linha).toBeDefined();
    const registro = JSON.parse(linha ?? "{}") as Record<string, unknown>;
    expect(registro).toMatchObject({
      estagio: "ferramentas",
      rodada: 1,
      status: 404,
    });
    expect(typeof registro["modelo"]).toBe("string");
    expect(String(registro["erro"])).toContain("No endpoints found");
    aviso.mockRestore();
  });
});

describe("o primeiro nome de quem pergunta (T-428)", () => {
  it("vai na mensagem de usuário; a de sistema não muda; nenhuma leva e-mail", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "k");
    const pedidos: { messages: { role: string; content: string }[] }[] = [];
    vi.stubGlobal("fetch", async (_u: string, init: { body: string }) => {
      const corpo = JSON.parse(init.body) as {
        messages: { role: string; content: string }[];
      };
      pedidos.push(corpo);
      const message = corpo.messages.some((m) => m.role === "tool")
        ? { content: "Ana, os maiores clientes estão listados." }
        : {
            content: null,
            tool_calls: [
              {
                id: "r1",
                type: "function",
                function: {
                  name: "ranking",
                  arguments: JSON.stringify({
                    metrica: "receita_liquida",
                    dimensao: "cliente",
                  }),
                },
              },
            ],
          };
      return new Response(JSON.stringify({ choices: [{ message }] }), {
        status: 200,
      });
    });

    const contexto = contextoDe("fin/visao", "", ["2026"], "Ana");
    const r = await resolverComposta("Top clientes por receita", contexto, []);
    expect(r?.tipo).toBe("composta");

    const primeiro = pedidos[0]?.messages ?? [];
    expect(textoDa(primeiro[0] ?? {})).toBe(INSTRUCAO_DO_LACO);
    expect(textoDa(primeiro[1] ?? {})).toContain("Quem pergunta: Ana");
    for (const pedidoFeito of pedidos) {
      for (const mensagem of pedidoFeito.messages) {
        expect(textoDa(mensagem)).not.toContain("@");
      }
      expect(
        inspecionarSaida(comoTexto(pedidoFeito.messages), INSTRUCAO_DO_LACO),
      ).toBeNull();
    }
  });
});

/**
 * O cache de prompt do laço (T-438, PRD 7.4).
 *
 * O prefixo estável do laço são as ferramentas e a instrução — seis esquemas
 * carregando o enum dos 145 ids, mais o texto de sistema. Um corte na
 * mensagem de sistema cacheia os dois, porque a ordem de renderização é
 * `tools`, `system`, `messages`. É isso que faz o laço por padrão custar
 * menos que o roteamento por sinais.
 */
describe("o corte de cache de prompt", () => {
  const CORTE = { type: "ephemeral" };

  it("marca a instrução de sistema quando o modelo é da Anthropic", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "k");
    const { pedidos } = gatewayFalso([{ content: "pronto" }]);
    await conversarComFerramentas(MENSAGENS, FERRAMENTAS, async () => "{}", {
      ...LIMITES,
      maximoDeRodadas: 1,
    });
    const sistema = (pedidos[0]?.["messages"] as { content: unknown }[])[0];
    expect(sistema?.content).toEqual([
      { type: "text", text: "sistema", cache_control: CORTE },
    ]);
    // O resto da conversa não muda de formato: só o prefixo é cacheável.
    const usuario = (pedidos[0]?.["messages"] as { content: unknown }[])[1];
    expect(usuario?.content).toBe("pergunta");
  });

  it("não marca nada quando o modelo não é da Anthropic", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "k");
    const { pedidos } = gatewayFalso([{ content: "pronto" }]);
    await conversarComFerramentas(
      MENSAGENS,
      FERRAMENTAS,
      async () => "{}",
      { ...LIMITES, maximoDeRodadas: 1 },
      { modelo: "openai/gpt-4o" },
    );
    const sistema = (pedidos[0]?.["messages"] as { content: unknown }[])[0];
    expect(sistema?.content).toBe("sistema");
  });

  it.each([
    ["o nome da Anthropic", { cache_read_input_tokens: 23_000 }],
    ["o nome da OpenAI", { prompt_tokens_details: { cached_tokens: 23_000 } }],
  ])("conta o que voltou do cache por %s", async (_, uso) => {
    vi.stubEnv("OPENROUTER_API_KEY", "k");
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "pronto" } }],
            usage: { prompt_tokens: 25_000, completion_tokens: 800, ...uso },
          }),
          { status: 200 },
        ),
    );
    const r = await conversarComFerramentas(
      MENSAGENS,
      FERRAMENTAS,
      async () => "{}",
      LIMITES,
    );
    expect(r?.tokens.cacheLido).toBe(23_000);
  });
});
