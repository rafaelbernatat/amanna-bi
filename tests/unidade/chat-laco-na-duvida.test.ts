import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { Composta } from "@/chat/laco";
import { resolverComposta } from "@/chat/laco";
import { lacoNaDuvidaLigado, resolverPergunta } from "@/chat/perguntar";
import { resolver } from "@/chat/resolver";
import { QUERY_PADRAO } from "@/semantica/contrato";

/**
 * O laço na dúvida (T-436).
 *
 * A pergunta que o catálogo não casa de primeira vai ao laço de ferramentas
 * antes da recusa: o modelo busca a métrica e lê. O que se prova aqui é a
 * decisão — quando o laço entra, o que sai quando ele conclui, e que a recusa
 * útil continua sendo o que sai quando ele não conclui ou está desligado. O
 * laço em si é de `chat-laco.test.ts`; o modelo de verdade, de `chat-vivo`.
 */

vi.mock("@/chat/laco", async (original) => ({
  ...(await original<typeof import("@/chat/laco")>()),
  resolverComposta: vi.fn(),
}));

vi.mock("@/chat/openrouter", async (original) => ({
  ...(await original<typeof import("@/chat/openrouter")>()),
  // O interpretador do modelo não casa nada: é a dúvida.
  interpretarComGateway: vi.fn(async () => null),
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

describe("lacoNaDuvidaLigado", () => {
  it("vale por padrão; 0, nao e false desligam", () => {
    expect(lacoNaDuvidaLigado({})).toBe(true);
    expect(lacoNaDuvidaLigado({ CHAT_LACO_NA_DUVIDA: "1" })).toBe(true);
    expect(lacoNaDuvidaLigado({ CHAT_LACO_NA_DUVIDA: "0" })).toBe(false);
    expect(lacoNaDuvidaLigado({ CHAT_LACO_NA_DUVIDA: "nao" })).toBe(false);
    expect(lacoNaDuvidaLigado({ CHAT_LACO_NA_DUVIDA: "false" })).toBe(false);
  });
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

  it("se o laço não conclui, fica a recusa útil", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "chave-de-teste");
    vi.mocked(resolverComposta).mockResolvedValue(null);

    const resolvida = await resolverPergunta(PERGUNTA_SEM_METRICA);
    expect(vi.mocked(resolverComposta)).toHaveBeenCalledTimes(1);
    expect(resolvida.tipo).toBe("recusa");
  });

  it("desligado por variável, não vai ao laço", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "chave-de-teste");
    vi.stubEnv("CHAT_LACO_NA_DUVIDA", "0");

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
