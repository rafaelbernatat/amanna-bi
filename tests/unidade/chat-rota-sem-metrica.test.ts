import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { contextoDe } from "@/chat/contexto";
import type { Composta, CompostaRecusada } from "@/chat/laco";
import { resolverComposta } from "@/chat/laco";
import { resolverPergunta } from "@/chat/perguntar";
import { resolver } from "@/chat/resolver";
import { QUERY_PADRAO } from "@/semantica/contrato";

/**
 * A pergunta que não nomeia métrica (T-446, antes T-436).
 *
 * Com gateway, ela vai ao laço **antes** de qualquer recusa: o modelo busca a
 * métrica no catálogo e lê. Isto era o "laço na dúvida", que tentava o laço
 * depois da interpretação; o roteamento o absorveu, e agora a decisão é uma
 * só, tomada antes do estágio 1.
 *
 * O que se prova aqui é a costura: quando o laço entra, o que sai quando ele
 * conclui, e qual recusa sai quando ele não conclui. O laço em si é de
 * `chat-laco.test.ts`; a decisão de rota, de `chat-roteamento.test.ts`; o
 * modelo de verdade, de `chat-vivo`.
 */

vi.mock("@/chat/laco", async (original) => ({
  ...(await original<typeof import("@/chat/laco")>()),
  resolverComposta: vi.fn(),
}));

const PERGUNTA_SEM_METRICA = "quantos fornecedores novos tivemos?";

beforeAll(() => {
  process.env["DATA_SOURCE"] = "fixtures";
  process.env["AUTH_PROVIDER"] = "fixtures";
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.mocked(resolverComposta).mockReset();
});

describe("a pergunta sem métrica, com gateway", () => {
  it("vai ao laço; se ele conclui, a resposta é a dele", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "chave-de-teste");
    const base = await resolver("receita_liquida", QUERY_PADRAO);
    const composta: Composta = {
      tipo: "composta",
      resolucao: { ...base, caminho: "composto" },
      texto: "O laço leu e escreveu.",
    };
    vi.mocked(resolverComposta).mockResolvedValue(composta);

    const resolvida = await resolverPergunta(PERGUNTA_SEM_METRICA);
    expect(vi.mocked(resolverComposta)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(resolverComposta).mock.calls[0]?.[0]).toBe(
      PERGUNTA_SEM_METRICA,
    );
    expect(resolvida.tipo).toBe("resolvida");
    if (resolvida.tipo !== "resolvida") return;
    expect(resolvida.resolucao.caminho).toBe("composto");
    expect(resolvida.redacao?.texto).toBe("O laço leu e escreveu.");
    expect(resolvida.redacao?.autoria).toBe("modelo");
  });

  /**
   * A pergunta fora dos dados também vai ao laço agora.
   *
   * A guarda que a barrava lia a recusa do interpretador, o que custava uma
   * ida ao modelo para decidir não usar o modelo. O laço decide sozinho: não
   * achou o que ler, recusa — e a recusa diz a verdade, com o guia da tela
   * como atalho (T-441), em vez de "sem o modelo configurado".
   */
  it("fora dos dados, o laço recusa e o texto não fala em modelo ausente", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "chave-de-teste");
    const recusa: CompostaRecusada = {
      tipo: "recusa",
      texto:
        "Não consigo responder a isso com os dados do painel. Posso responder perguntas sobre as métricas de RH e financeiro.",
      motivo: "sem_leitura",
      alternativas: [],
    };
    vi.mocked(resolverComposta).mockResolvedValue(recusa);

    const resolvida = await resolverPergunta(
      "Qual a capital da França?",
      contextoDe("fin/visao", "", ["2026"]),
    );
    expect(vi.mocked(resolverComposta)).toHaveBeenCalledTimes(1);
    expect(resolvida.tipo).toBe("recusa");
    if (resolvida.tipo !== "recusa") return;
    expect(resolvida.texto).toMatch(/não consigo responder/i);
    expect(resolvida.texto).not.toMatch(/sem o modelo configurado/i);
    expect(resolvida.alternativas).toEqual([]);
    // O guia da tela entra como atalho, para a pessoa não ficar sem saída.
    expect(resolvida.sugestoes.length).toBeGreaterThan(0);
  });

  it("se o laço não conclui, o caminho simples responde ou recusa", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "chave-de-teste");
    vi.mocked(resolverComposta).mockResolvedValue(null);

    const resolvida = await resolverPergunta(PERGUNTA_SEM_METRICA);
    expect(vi.mocked(resolverComposta)).toHaveBeenCalledTimes(1);
    expect(resolvida.tipo).toBe("recusa");
  });
});

describe("quando o laço não entra", () => {
  it("com CHAT_ROTA=sinais, a pergunta sem sinal não vai ao laço", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "chave-de-teste");
    vi.stubEnv("CHAT_ROTA", "sinais");

    const resolvida = await resolverPergunta(PERGUNTA_SEM_METRICA);
    expect(vi.mocked(resolverComposta)).not.toHaveBeenCalled();
    expect(resolvida.tipo).toBe("recusa");
  });

  it("sem gateway, não vai ao laço: a recusa é imediata", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const resolvida = await resolverPergunta(PERGUNTA_SEM_METRICA);
    expect(vi.mocked(resolverComposta)).not.toHaveBeenCalled();
    expect(resolvida.tipo).toBe("recusa");
  });
});
