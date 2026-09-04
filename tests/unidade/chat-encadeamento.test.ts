import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  interpretarLocalmente,
  mudaRecorte,
  semRecorte,
  type TurnoAnterior,
} from "@/chat/interpretar";
import { interpretarComGateway } from "@/chat/openrouter";
import { perguntar } from "@/chat/perguntar";
import { QUERY_PADRAO } from "@/semantica/contrato";

/**
 * A conversa continua: perguntas de acompanhamento herdam a métrica
 * anterior (seção 7.7, "recorte implícito"; T-327 em parte).
 *
 * "E em dezembro?" sozinha não cita métrica e seria recusada. Depois de
 * "qual o turnover", pede o turnover em dezembro. A regra é determinística
 * e vale nos dois caminhos do estágio 1 — com o modelo e sem ele.
 */

beforeAll(() => {
  process.env["DATA_SOURCE"] = "fixtures";
  process.env["AUTH_PROVIDER"] = "fixtures";
});

vi.mock("@/chat/openrouter", () => ({
  gatewayConfigurado: () => true,
  interpretarComGateway: vi.fn(),
  redigirComGateway: vi.fn(async () => null),
}));

const DEPOIS_DO_TURNOVER: readonly TurnoAnterior[] = [
  { pergunta: "qual o turnover", metrica: "turnover_12m" },
];

/* ------------------------------------------------------------------ *
 * As duas funções puras
 * ------------------------------------------------------------------ */

describe("mudaRecorte", () => {
  it("vê o período, a entidade, a área e o ano na pergunta", () => {
    expect(mudaRecorte("E em dezembro?", QUERY_PADRAO)).toBe(true);
    expect(mudaRecorte("E na Unidade SP?", QUERY_PADRAO)).toBe(true);
    expect(mudaRecorte("E na área de tecnologia?", QUERY_PADRAO)).toBe(true);
    expect(mudaRecorte("E em 2025?", QUERY_PADRAO)).toBe(true);
  });

  it("não muda quando a pergunta pede o recorte que já está na tela", () => {
    expect(mudaRecorte("qual o turnover", QUERY_PADRAO)).toBe(false);
    expect(mudaRecorte("E no consolidado?", QUERY_PADRAO)).toBe(false);
    expect(
      mudaRecorte("E no consolidado?", {
        ...QUERY_PADRAO,
        entidade: "unidade-sp",
      }),
    ).toBe(true);
  });
});

describe("semRecorte", () => {
  it("tira os rótulos de filtro e de valor, e o ano", () => {
    const sobra = semRecorte("E na área de tecnologia em 2025?");
    expect(sobra).not.toMatch(/area|tecnologia|2025/);
  });

  it("deixa o que nomeia métrica", () => {
    expect(semRecorte("E a margem em dezembro?")).toMatch(/margem/);
    expect(semRecorte("E a margem em dezembro?")).not.toMatch(/dezembro/);
  });

  it("é o que separa continuação de pergunta nova", () => {
    // "área" é palavra do nome de duas métricas de engajamento: sem tirá-la,
    // o interpretador empatava as duas e pedia desambiguação.
    expect(interpretarLocalmente("E na área de tecnologia?")).not.toBeNull();
    expect(
      interpretarLocalmente(semRecorte("E na área de tecnologia?")),
    ).toBeNull();
  });
});

/* ------------------------------------------------------------------ *
 * A orquestração
 * ------------------------------------------------------------------ */

describe("a continuação herda a métrica anterior", () => {
  afterEach(() => {
    vi.mocked(interpretarComGateway).mockReset();
  });

  it("'E em dezembro?' depois do turnover é o turnover em dezembro", async () => {
    vi.mocked(interpretarComGateway).mockResolvedValueOnce(null);

    const resposta = await perguntar(
      "E em dezembro?",
      QUERY_PADRAO,
      DEPOIS_DO_TURNOVER,
    );
    expect(resposta.tipo).toBe("resposta");
    if (resposta.tipo !== "resposta") return;
    expect(resposta.resolucao.metrica).toBe("turnover_12m");
    expect(resposta.resolucao.acoes.filtros.periodo).toBe("dezembro");
  });

  it("'E na área de tecnologia?' herda e troca só a área", async () => {
    vi.mocked(interpretarComGateway).mockResolvedValueOnce(null);

    const resposta = await perguntar(
      "E na área de tecnologia?",
      { ...QUERY_PADRAO, periodo: "dezembro" },
      DEPOIS_DO_TURNOVER,
    );
    expect(resposta.tipo).toBe("resposta");
    if (resposta.tipo !== "resposta") return;
    expect(resposta.resolucao.metrica).toBe("turnover_12m");
    expect(resposta.resolucao.acoes.filtros.area).toBe("tecnologia");
    expect(resposta.resolucao.acoes.filtros.periodo).toBe("dezembro");
  });

  it("vale mesmo quando o modelo recusa", async () => {
    vi.mocked(interpretarComGateway).mockResolvedValueOnce({
      metrica: "",
      confianca: 0,
      alternativas: [],
    });

    const resposta = await perguntar(
      "E na Unidade SP?",
      QUERY_PADRAO,
      DEPOIS_DO_TURNOVER,
    );
    expect(resposta.tipo).toBe("resposta");
    if (resposta.tipo !== "resposta") return;
    expect(resposta.resolucao.metrica).toBe("turnover_12m");
    expect(resposta.resolucao.acoes.filtros.entidade).toBe("unidade-sp");
  });

  it("vence um palpite do modelo abaixo do limiar", async () => {
    vi.mocked(interpretarComGateway).mockResolvedValueOnce({
      metrica: "enps",
      confianca: 0.2,
      alternativas: ["enps"],
    });

    const resposta = await perguntar(
      "E em dezembro?",
      QUERY_PADRAO,
      DEPOIS_DO_TURNOVER,
    );
    expect(resposta.tipo).toBe("resposta");
    if (resposta.tipo !== "resposta") return;
    expect(resposta.resolucao.metrica).toBe("turnover_12m");
  });

  it("não vence o modelo quando ele responde com convicção", async () => {
    vi.mocked(interpretarComGateway).mockResolvedValueOnce({
      metrica: "headcount_fte",
      confianca: 0.9,
      alternativas: [],
    });

    const resposta = await perguntar(
      "E o quadro em dezembro?",
      QUERY_PADRAO,
      DEPOIS_DO_TURNOVER,
    );
    expect(resposta.tipo).toBe("resposta");
    if (resposta.tipo !== "resposta") return;
    expect(resposta.resolucao.metrica).toBe("headcount_fte");
  });

  it("o modelo recebe a conversa junto da pergunta", async () => {
    vi.mocked(interpretarComGateway).mockResolvedValueOnce(null);

    await perguntar("E em dezembro?", QUERY_PADRAO, DEPOIS_DO_TURNOVER);

    const chamada = vi.mocked(interpretarComGateway).mock.calls[0];
    expect(chamada?.[2]).toEqual(DEPOIS_DO_TURNOVER);
  });

  it("sem recorte novo não há herança: 'por quê?' continua recusa", async () => {
    vi.mocked(interpretarComGateway).mockResolvedValueOnce(null);

    const resposta = await perguntar(
      "Por quê?",
      QUERY_PADRAO,
      DEPOIS_DO_TURNOVER,
    );
    expect(resposta.tipo).toBe("recusa");
  });

  it("pergunta que nomeia outra métrica não herda: pede desambiguação", async () => {
    vi.mocked(interpretarComGateway).mockResolvedValueOnce(null);

    // "margem" está no nome de quatro métricas: a pessoa quer uma margem,
    // e não o turnover em dezembro. O chat pergunta qual.
    const resposta = await perguntar(
      "E a margem em dezembro?",
      QUERY_PADRAO,
      DEPOIS_DO_TURNOVER,
    );
    expect(resposta.tipo).toBe("recusa");
    if (resposta.tipo !== "recusa") return;
    expect(resposta.alternativas.length).toBeGreaterThan(0);
    expect(resposta.alternativas.map((a) => a.id).join(" ")).toMatch(/margem/);
  });

  it("sem conversa anterior, 'E em dezembro?' é recusa", async () => {
    vi.mocked(interpretarComGateway).mockResolvedValueOnce(null);

    const resposta = await perguntar("E em dezembro?", QUERY_PADRAO, []);
    expect(resposta.tipo).toBe("recusa");
  });

  it("uma recusa no meio da conversa não corta o fio: herda a última com métrica", async () => {
    vi.mocked(interpretarComGateway).mockResolvedValueOnce(null);

    const resposta = await perguntar("E em dezembro?", QUERY_PADRAO, [
      ...DEPOIS_DO_TURNOVER,
      { pergunta: "Quanto vale a empresa?", metrica: null },
    ]);
    expect(resposta.tipo).toBe("resposta");
    if (resposta.tipo !== "resposta") return;
    expect(resposta.resolucao.metrica).toBe("turnover_12m");
  });
});
