/**
 * Mede o que o OpenRouter aceita no corpo do laco (T-457).
 *
 * O cache de prompt (T-438) passou a mandar a mensagem de sistema no formato
 * de partes, com `cache_control`, quando o modelo e da Anthropic. Essa mudanca
 * **nunca encontrou uma resposta real**: o `fetch` falso dos testes sempre
 * devolve 200. Em producao o laco passou a degradar.
 *
 * Este script manda os dois corpos, com `max_tokens: 1`, e imprime o status e
 * o inicio do corpo de cada um. Custa centavos e troca a suspeita por medida.
 *
 *   npx tsx ferramentas/chat/sondar-gateway.mts
 */

// `@next/env` e CommonJS: o named export nao atravessa o ESM.
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const ENDERECO = "https://openrouter.ai/api/v1/chat/completions";
const chave = process.env["OPENROUTER_API_KEY"];
if (chave === undefined || chave.trim() === "") {
  throw new Error("OPENROUTER_API_KEY nao configurada");
}
const modelo =
  process.env["OPENROUTER_MODEL_FERRAMENTAS"] ?? "anthropic/claude-sonnet-5";

const FERRAMENTA = {
  type: "function",
  function: {
    name: "ler_metrica",
    description: "Le o valor de uma metrica.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["metrica"],
      properties: { metrica: { type: "string" } },
    },
  },
};

type Caso = { readonly nome: string; readonly corpo: Record<string, unknown> };

const SISTEMA = "Voce responde perguntas sobre um painel de controladoria.";
const USUARIO = "Diga apenas: ok";

const BASE = {
  model: modelo,
  max_tokens: 1,
  tools: [FERRAMENTA],
  tool_choice: "auto" as const,
  provider: { require_parameters: true },
};

const CASOS: readonly Caso[] = [
  {
    nome: "1. texto simples (o corpo de antes de T-438)",
    corpo: {
      ...BASE,
      messages: [
        { role: "system", content: SISTEMA },
        { role: "user", content: USUARIO },
      ],
    },
  },
  {
    nome: "2. partes com cache_control (o corpo de hoje)",
    corpo: {
      ...BASE,
      messages: [
        {
          role: "system",
          content: [
            {
              type: "text",
              text: SISTEMA,
              cache_control: { type: "ephemeral" },
            },
          ],
        },
        { role: "user", content: USUARIO },
      ],
    },
  },
  {
    nome: "3. partes com cache_control, sem require_parameters",
    corpo: {
      ...BASE,
      provider: undefined,
      messages: [
        {
          role: "system",
          content: [
            {
              type: "text",
              text: SISTEMA,
              cache_control: { type: "ephemeral" },
            },
          ],
        },
        { role: "user", content: USUARIO },
      ],
    },
  },
  {
    nome: "4. partes SEM cache_control",
    corpo: {
      ...BASE,
      messages: [
        { role: "system", content: [{ type: "text", text: SISTEMA }] },
        { role: "user", content: USUARIO },
      ],
    },
  },
];

const LIMITE_MS = 30_000;
const PEDACO = 300;

console.log(`modelo: ${modelo}\n`);

for (const caso of CASOS) {
  const inicio = Date.now();
  try {
    const resposta = await fetch(ENDERECO, {
      method: "POST",
      signal: AbortSignal.timeout(LIMITE_MS),
      headers: {
        authorization: `Bearer ${chave}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(caso.corpo),
    });
    const texto = await resposta.text();
    const ms = Date.now() - inicio;
    const lido = JSON.parse(texto) as {
      choices?: unknown[];
      error?: { message?: string };
      usage?: Record<string, unknown>;
    };
    const ok = resposta.ok && Array.isArray(lido.choices);
    console.log(`${ok ? "OK  " : "FALHA"} ${caso.nome}`);
    console.log(`     status ${String(resposta.status)} · ${String(ms)} ms`);
    if (!ok) {
      console.log(
        `     erro: ${(lido.error?.message ?? texto).slice(0, PEDACO).replace(/\s+/g, " ")}`,
      );
    } else if (lido.usage !== undefined) {
      console.log(`     usage: ${JSON.stringify(lido.usage)}`);
    }
  } catch (erro) {
    console.log(`FALHA ${caso.nome}`);
    console.log(
      `     excecao: ${erro instanceof Error ? erro.name : String(erro)}`,
    );
  }
  console.log("");
}
