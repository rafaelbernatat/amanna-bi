import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { lerPedido } from "@/chat/pedido";
import {
  CABECALHO_DE_PERGUNTAS_RESTANTES,
  PERGUNTAS_POR_CONVIDADO,
} from "@/chat/protocolo";
import { esquecerConvidadosEmMemoria } from "@/convidados/armazens/memoria";
import { armazemDeConvidados } from "@/convidados/registrar";
import {
  assinarSessao,
  PERFIL_DO_PUBLICO,
  VERSAO_DO_ENVELOPE,
} from "@/seguranca/convite";
import type { Perfil } from "@/seguranca/identidade";

/*
 * O cookie da sessão, falsificável (D-CONVIDADO-cadastro).
 *
 * É o primeiro `vi.mock("next/headers")` do repositório: a rota lê a sessão
 * pelo cookie, e a cota do convidado só existe para quem entrou pelo QR. Sem
 * cookie (o padrão), tudo o que existia continua igual — o modo `fixtures`
 * responde pelo provedor da instalação.
 */
const { cookieDeTeste } = vi.hoisted(() => ({
  cookieDeTeste: { valor: null as string | null },
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (nome: string) =>
      cookieDeTeste.valor === null
        ? undefined
        : { name: nome, value: cookieDeTeste.valor },
  }),
  headers: async () => new Headers(),
}));
import {
  esquecerControleDoProcesso,
  PERGUNTAS_POR_MINUTO,
} from "@/chat/limite";
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

/**
 * Um pedido do próprio site.
 *
 * A rota confere a origem antes de tudo (D-CONVITE-apresentacao): um `POST`
 * com JSON montado por outro site gastaria a cota da apresentação alheia. O
 * caso de origem cruzada tem teste próprio, abaixo.
 */
function pedido(corpo: unknown): Request {
  return new Request("http://painel.local/api/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://painel.local",
      host: "painel.local",
    },
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
      tela: null,
      historico: [{ pergunta: "antes", metrica: "roe" }],
    });
  });

  it("busca e histórico são opcionais", () => {
    expect(lerPedido({ pergunta: "x" })).toEqual({
      pergunta: "x",
      busca: "",
      tela: null,
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

  it("origem de outro site é recusada com 403, antes de ler o corpo", async () => {
    const deFora = new Request("http://painel.local/api/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://outro.exemplo",
        host: "painel.local",
      },
      body: JSON.stringify({ pergunta: "qual o turnover" }),
    });
    const resposta = await POST(deFora);
    expect(resposta.status).toBe(403);
  });

  /**
   * O arnês e o desenvolvimento não caem no limite por minuto.
   *
   * Em `fixtures` todo mundo compartilha o sujeito `fixtures:diretoria`: uma
   * janela por sujeito mediria a suíte inteira. A janela vale para celular de
   * apresentação, e a prova dela está em `apresentacao.test.ts`, sobre o
   * controle puro.
   */
  it("em fixtures, perguntar várias vezes seguidas não vira 429", async () => {
    esquecerControleDoProcesso();
    for (let i = 0; i < PERGUNTAS_POR_MINUTO + 2; i += 1) {
      const resposta = await POST(pedido({ pergunta: "qual o turnover" }));
      expect(resposta.status, `pergunta ${String(i)}`).toBe(200);
      // O fluxo precisa ser consumido: é o que libera a vaga do semáforo.
      await linhasDe(resposta);
    }
    esquecerControleDoProcesso();
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

describe("as fases com o laço (T-434)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("o andamento e a prévia chegam antes da resposta, e o gráfico é o ranking lido", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "k");
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

    const resposta = await POST(
      pedido({
        pergunta: "Top 3 clientes por receita",
        tela: "fin/visao",
        busca: "",
      }),
    );
    const linhas = await linhasDe(resposta);
    expect(linhas.map((l) => l.fase)).toEqual([
      "andamento",
      "previa",
      "andamento",
      "previa",
      "resposta",
    ]);
    const previas = linhas.filter((l) => l.fase === "previa");
    expect(
      previas.at(-1)?.fase === "previa" && previas.at(-1)?.previa.painel?.id,
    ).toBe("chat-ranking-receita_liquida-cliente");
    const final = linhas.at(-1);
    if (final?.fase !== "resposta" || final.resposta.tipo !== "resposta") {
      throw new Error("esperava resposta");
    }
    expect(final.resposta.autoria).toBe("modelo");
    expect(final.resposta.resolucao.caminho).toBe("composto");
    expect(final.resposta.resolucao.painel?.id).toBe(
      "chat-ranking-receita_liquida-cliente",
    );
  });
});

describe("a cota do convidado (T-426)", () => {
  const SEGREDO = "um-segredo-de-teste-com-mais-de-32-caracteres";
  const CHAVE = { sala: "demo", dispositivo: "dispositivo-de-teste" };
  const UMA_HORA = 3600;

  async function entrarComo(perfil: Perfil): Promise<void> {
    const agora = Math.floor(Date.now() / 1000);
    cookieDeTeste.valor = await assinarSessao(
      {
        v: VERSAO_DO_ENVELOPE,
        tipo: "sessao",
        ...CHAVE,
        perfil,
        expira: agora + UMA_HORA,
      },
      SEGREDO,
    );
  }

  async function cadastrar(): Promise<void> {
    const armazem = await armazemDeConvidados({});
    await armazem.registrar({
      ...CHAVE,
      nome: "Ana Souza",
      email: "ana@exemplo.com.br",
      expiraEm: new Date().toISOString(),
    });
  }

  beforeEach(() => {
    vi.stubEnv("CONVITE_SEGREDO", SEGREDO);
    vi.stubEnv("DATABASE_URL", "");
    esquecerControleDoProcesso();
    esquecerConvidadosEmMemoria();
  });

  afterEach(() => {
    cookieDeTeste.valor = null;
    vi.unstubAllEnvs();
  });

  it("sem cadastro, 401 com o motivo", async () => {
    await entrarComo(PERFIL_DO_PUBLICO);
    const resposta = await POST(pedido({ pergunta: "qual o turnover" }));
    expect(resposta.status).toBe(401);
    expect(((await resposta.json()) as { motivo: string }).motivo).toBe(
      "sem_cadastro",
    );
  });

  it("cinco perguntas levam o cabeçalho de restantes; a sexta é 429 sem retry-after", async () => {
    await entrarComo(PERFIL_DO_PUBLICO);
    await cadastrar();
    for (let i = 1; i <= PERGUNTAS_POR_CONVIDADO; i += 1) {
      const resposta = await POST(pedido({ pergunta: "qual o turnover" }));
      expect(resposta.status, `pergunta ${String(i)}`).toBe(200);
      expect(resposta.headers.get(CABECALHO_DE_PERGUNTAS_RESTANTES)).toBe(
        String(PERGUNTAS_POR_CONVIDADO - i),
      );
      await resposta.text();
    }
    const sexta = await POST(pedido({ pergunta: "qual o turnover" }));
    expect(sexta.status).toBe(429);
    expect(sexta.headers.get("retry-after")).toBeNull();
    expect(((await sexta.json()) as { motivo: string }).motivo).toBe(
      "limite_de_perguntas",
    );
  });

  it("um corpo malformado não consome a cota", async () => {
    await entrarComo(PERFIL_DO_PUBLICO);
    await cadastrar();
    expect((await POST(pedido({ pergunta: "" }))).status).toBe(400);
    const resposta = await POST(pedido({ pergunta: "qual o turnover" }));
    expect(resposta.headers.get(CABECALHO_DE_PERGUNTAS_RESTANTES)).toBe(
      String(PERGUNTAS_POR_CONVIDADO - 1),
    );
    await resposta.text();
  });

  it("quem apresenta não tem cota nem cabeçalho", async () => {
    await entrarComo("diretoria");
    const resposta = await POST(pedido({ pergunta: "qual o turnover" }));
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get(CABECALHO_DE_PERGUNTAS_RESTANTES)).toBeNull();
    await resposta.text();
  });
});
