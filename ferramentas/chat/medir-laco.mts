/**
 * Mede o corpo real do laco: tamanho e tempo de uma rodada (T-457).
 *
 * A sonda anterior provou que o `cache_control` e aceito. Sobra o teto de 20 s
 * por rodada, e a suspeita de que a carga cresceu demais: nove ferramentas
 * repetindo o enum dos 145 ids seis vezes, mais o dicionario do esquema.
 *
 * Este script monta o corpo **de verdade** — `ferramentas()` e
 * `INSTRUCAO_DO_LACO` do produto, mais o dicionario lido do banco — e mede.
 * Nao precisa de sessao, porque nao le dado: so pesa e cronometra.
 *
 *   npx tsx ferramentas/chat/medir-laco.mts
 */

import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

process.env["DATA_SOURCE"] ??= "warehouse";

const { ferramentas } = await import("../../src/chat/ferramentas/catalogo");
const { INSTRUCAO_DO_LACO } = await import("../../src/chat/laco");
const { contextoDe } = await import("../../src/chat/contexto");
const { criarCliente, caDoAmbiente } =
  await import("../../src/acesso/postgres/cliente");

const contexto = contextoDe("fin/visao", "painel=fin-dre", ["2025", "2026"]);

/* O dicionario, como `esquemaParaOModelo` o monta. */
const url = process.env["DATABASE_URL"] ?? "";
let esquema = "";
if (url !== "") {
  const ca = caDoAmbiente();
  const cliente = criarCliente(url, ca === undefined ? {} : { ca });
  try {
    const linhas = await cliente.consultar<{
      objeto: string;
      coluna: string;
      unidade: string | null;
      descricao: string | null;
    }>(
      `SELECT objeto, coluna, unidade, descricao FROM amanna_chat.dicionario
       ORDER BY objeto, ordem, coluna`,
    );
    const porObjeto = new Map<string, string[]>();
    for (const c of linhas) {
      const unidade = c.unidade === null ? "" : ` (${c.unidade})`;
      const descricao = c.descricao === null ? "" : ` — ${c.descricao}`;
      porObjeto.set(c.objeto, [
        ...(porObjeto.get(c.objeto) ?? []),
        `${c.coluna}${unidade}${descricao}`,
      ]);
    }
    esquema =
      "\n\nViews de consultar_dados:\n" +
      [...porObjeto].map(([o, cs]) => `${o}: ${cs.join("; ")}`).join("\n");
  } finally {
    await cliente.encerrar();
  }
}

const lista = ferramentas(contexto, esquema !== "");
const tools = lista.map((f) => ({
  type: "function",
  function: {
    name: f.nome,
    description: f.descricao,
    parameters: f.parametros,
  },
}));

const usuario = `Tela aberta: Financeiro\n${esquema}\n\nPergunta: Qual a maior despesa em junho?`;
const messages = [
  { role: "system", content: INSTRUCAO_DO_LACO },
  { role: "user", content: usuario },
];

const POR_TOKEN = 4; // caracteres por token, aproximacao suficiente para ordem de grandeza
const chars = (x: unknown) => JSON.stringify(x).length;

console.log("=== tamanho do corpo ===");
console.log(`ferramentas: ${String(lista.length)}`);
for (const f of lista) {
  console.log(
    `  ${f.nome.padEnd(20)} ${String(chars(f.parametros)).padStart(7)} caracteres`,
  );
}
console.log(`tools inteiro:      ${String(chars(tools)).padStart(7)}`);
console.log(
  `instrucao:          ${String(INSTRUCAO_DO_LACO.length).padStart(7)}`,
);
console.log(`esquema:            ${String(esquema.length).padStart(7)}`);
console.log(
  `corpo inteiro:      ${String(chars({ tools, messages })).padStart(7)}`,
);
console.log(
  `~tokens de entrada: ${String(Math.round(chars({ tools, messages }) / POR_TOKEN)).padStart(7)}\n`,
);

const chave = process.env["OPENROUTER_API_KEY"];
if (chave === undefined || chave.trim() === "") {
  console.log("sem OPENROUTER_API_KEY: nao mede o tempo");
  process.exit(0);
}
const modelo =
  process.env["OPENROUTER_MODEL_FERRAMENTAS"] ?? "anthropic/claude-sonnet-5";

console.log(`=== uma rodada real, ${modelo} ===`);
const LIMITE_MS = 60_000;
const inicio = Date.now();
const resposta = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  signal: AbortSignal.timeout(LIMITE_MS),
  headers: {
    authorization: `Bearer ${chave}`,
    "content-type": "application/json",
  },
  body: JSON.stringify({
    model: modelo,
    max_tokens: 2400,
    messages,
    tools,
    tool_choice: "required",
    provider: { require_parameters: true },
  }),
});
const texto = await resposta.text();
const ms = Date.now() - inicio;
const lido = JSON.parse(texto) as {
  choices?: {
    message?: {
      tool_calls?: { function?: { name?: string; arguments?: string } }[];
    };
  }[];
  error?: { message?: string };
  usage?: Record<string, unknown>;
};
console.log(`status ${String(resposta.status)} · ${String(ms)} ms`);
const TETO = 20_000;
console.log(
  ms > TETO ? "ESTOUROU o teto de 20 s do laco" : "dentro do teto de 20 s",
);
if (lido.error !== undefined) {
  console.log(`erro: ${JSON.stringify(lido.error).slice(0, 400)}`);
}
const chamadas = lido.choices?.[0]?.message?.tool_calls ?? [];
console.log(`ferramentas pedidas: ${String(chamadas.length)}`);
for (const c of chamadas) {
  console.log(
    `  ${c.function?.name}(${(c.function?.arguments ?? "").slice(0, 160)})`,
  );
}
console.log(`usage: ${JSON.stringify(lido.usage)}`);

/* ------------------------------------------------------------------ *
 * A sequencia inteira: rodada 1, execucao do SQL, rodada 2
 * ------------------------------------------------------------------ */

if (chamadas.length > 0 && url !== "") {
  const ca2 = caDoAmbiente();
  const cli = criarCliente(url, ca2 === undefined ? {} : { ca: ca2 });
  const conversa: unknown[] = [
    ...messages,
    {
      role: "assistant",
      content: null,
      tool_calls: lido.choices?.[0]?.message?.tool_calls,
    },
  ];
  for (const c of chamadas) {
    const args = JSON.parse(c.function?.arguments ?? "{}") as {
      consulta?: string;
    };
    let resultado = "";
    const t0 = Date.now();
    try {
      const sql = args.consulta ?? "";
      const linhas = await cli.transacao(async (t) => {
        await t.consultar("SET TRANSACTION READ ONLY");
        await t.consultar("SET LOCAL statement_timeout = 5000");
        await t.consultar("SET LOCAL amanna.escopo_entidades = 'consolidado'");
        await t.consultar("SET LOCAL amanna.escopo_areas = 'todas'");
        await t.consultar("SET LOCAL amanna.escopo_modulos = 'rh,fin,int'");
        return t.consultar(
          `SELECT * FROM (\n${sql}\n) AS resultado LIMIT $1`,
          [26],
        );
      });
      resultado = JSON.stringify(linhas).slice(0, 2000);
      console.log(
        `  SQL ok em ${String(Date.now() - t0)} ms, ${String(linhas.length)} linhas`,
      );
      console.log(`  ${resultado.slice(0, 300)}`);
    } catch (e) {
      resultado = JSON.stringify({
        erro: e instanceof Error ? e.message : String(e),
      });
      console.log(
        `  SQL FALHOU em ${String(Date.now() - t0)} ms: ${resultado.slice(0, 300)}`,
      );
    }
    conversa.push({
      role: "tool",
      tool_call_id: (c as { id?: string }).id ?? "1",
      content: resultado,
    });
  }
  await cli.encerrar();

  console.log("\n=== rodada 2 ===");
  const t1 = Date.now();
  const r2 = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(90_000),
    headers: {
      authorization: `Bearer ${chave}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: modelo,
      max_tokens: 2400,
      messages: conversa,
      tools,
      tool_choice: "auto",
      provider: { require_parameters: true },
    }),
  });
  const t2 = await r2.text();
  const ms2 = Date.now() - t1;
  const l2 = JSON.parse(t2) as {
    choices?: { message?: { content?: string; tool_calls?: unknown[] } }[];
    usage?: unknown;
  };
  console.log(
    `status ${String(r2.status)} · ${String(ms2)} ms ${ms2 > 20000 ? "<<< ESTOUROU 20 s" : ""}`,
  );
  console.log(
    `texto: ${(l2.choices?.[0]?.message?.content ?? "(nenhum)").slice(0, 400)}`,
  );
  console.log(
    `mais ferramentas: ${String((l2.choices?.[0]?.message?.tool_calls ?? []).length)}`,
  );
}
