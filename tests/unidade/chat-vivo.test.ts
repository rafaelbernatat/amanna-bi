import { beforeAll, describe, expect, it } from "vitest";

import { contextoDe } from "@/chat/contexto";
import { redigirResposta, resolverPergunta } from "@/chat/perguntar";

/**
 * O chat contra o gateway de verdade (T-437).
 *
 * Pula por padrão: só roda com `CHAT_VIVO=1` **e** `OPENROUTER_API_KEY` no
 * ambiente. Não é gate de `npm test` — custa dinheiro e depende de rede — e
 * existe para o roteiro de D-CHAT-resposta-completa ter uma forma repetível:
 * três perguntas, autoria do modelo, gráfico presente, caminho não degradado.
 *
 * ```
 * CHAT_VIVO=1 npx vitest run tests/unidade/chat-vivo.test.ts
 * ```
 */

const VIVO =
  process.env["CHAT_VIVO"] === "1" &&
  (process.env["OPENROUTER_API_KEY"] ?? "").trim() !== "";

/** Quanto se espera por uma resposta composta com Sonnet, no pior caso. */
const ESPERA_MS = 60_000;

beforeAll(() => {
  process.env["DATA_SOURCE"] = "fixtures";
  process.env["AUTH_PROVIDER"] = "fixtures";
});

describe.skipIf(!VIVO)("o chat com o gateway real (T-437)", () => {
  const CONTEXTO = contextoDe("fin/visao", "painel=fin-dre", ["2026"]);

  it.each([
    ["Top 5 clientes por receita", "composto"],
    ["Como a receita evoluiu nos últimos 12 meses?", "composto"],
    ["Compare a margem líquida com o turnover", "composto"],
  ] as const)(
    "%s responde pelo modelo, com gráfico, pelo caminho %s",
    async (pergunta, caminho) => {
      const inicio = Date.now();
      const resolvida = await resolverPergunta(pergunta, CONTEXTO, []);
      if (resolvida.tipo !== "resolvida") throw new Error("esperava resolvida");
      const resposta = await redigirResposta(
        pergunta,
        resolvida.resolucao,
        resolvida.redacao,
        CONTEXTO,
      );
      if (resposta.tipo !== "resposta") throw new Error("esperava resposta");
      expect(["modelo", "modelo-corrigido"]).toContain(resposta.autoria);
      expect(resposta.resolucao.caminho).toBe(caminho);
      expect(resposta.resolucao.painel).not.toBeNull();
      expect(Date.now() - inicio).toBeLessThan(ESPERA_MS);
    },
    ESPERA_MS,
  );
});
