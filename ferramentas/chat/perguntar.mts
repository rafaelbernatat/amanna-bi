/**
 * Faz perguntas ao chat de verdade, e imprime o que voltou (T-457).
 *
 * Entra pela senha do painel, manda cada pergunta ao `/api/chat` e le o NDJSON
 * — as mesmas fases que a tela le. Imprime caminho, autoria, tempo e o texto,
 * que e o que Produto olha para dizer se a resposta presta.
 *
 *   npx tsx ferramentas/chat/perguntar.mts                    # a lista padrao
 *   npx tsx ferramentas/chat/perguntar.mts "uma pergunta"     # so essa
 *   ALVO=http://localhost:3000 npx tsx ferramentas/chat/perguntar.mts
 *
 * `ALVO` vale producao por padrao. Uma conversa encadeada se escreve com `>`
 * entre as perguntas: "Qual a maior despesa de junho? > E em julho?".
 */

import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const ALVO = process.env["ALVO"] ?? "https://amanna-bi.vercel.app";
const SENHA = process.env["SENHA_DO_PAINEL"];
if (SENHA === undefined || SENHA.trim() === "") {
  throw new Error("SENHA_DO_PAINEL nao configurada");
}

/** A lista de desenho: o que o chat precisa saber responder. */
const PERGUNTAS: readonly string[] = [
  // valor simples
  "Qual o faturamento total de 2026?",
  "Qual o saldo de caixa?",
  "Quantos colaboradores temos?",
  // um mes
  "Quanto faturamos em abril?",
  "Qual o lucro de dezembro?",
  // dois periodos, com conta
  "Qual o faturamento de abril e agosto?",
  "Dezembro custou quanto a mais que novembro?",
  // o maior, os N primeiros
  "Qual a maior despesa em junho?",
  "Quais as 3 despesas mais caras de abril?",
  "Quem sao os 5 maiores clientes?",
  "Qual area tem mais gente?",
  // pessoas
  "Quais os colaboradores mais caros?",
  "Quem ganha mais na empresa?",
  "Quantos diretores temos?",
  // listar itens
  "Quais lancamentos ficaram fora do padrao em junho?",
  "Quais projetos estao atrasados?",
  // cruzamentos
  "Qual o faturamento por segmento?",
  "Qual unidade da prejuizo?",
  // metas
  "O turnover esta dentro da meta?",
  "Quanto tempo levamos para fechar uma vaga?",
  // conversa encadeada
  "Qual a maior despesa em junho? > E em julho?",
  // sem resposta nos dados
  "Qual o ROE?",
  "Quantas promocoes houve?",
  // fora do assunto
  "Qual a capital da Franca?",
];

type Linha =
  | { fase: "andamento"; passo: string }
  | { fase: "previa"; previa: { rotulo: string; valor: string | null } }
  | {
      fase: "resposta";
      resposta: {
        tipo: string;
        texto: string;
        autoria?: string;
        resolucao?: { caminho: string; leituras: { ferramenta: string }[] };
      };
    }
  | { fase: "falha"; motivo: string };

async function entrar(): Promise<string> {
  const corpo = new URLSearchParams({ senha: SENHA ?? "" });
  const r = await fetch(`${ALVO}/api/entrar`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      origin: ALVO,
    },
    body: corpo,
  });
  // `getSetCookie` e o unico que devolve todos; `get` junta tudo numa linha so.
  const cookies = r.headers.getSetCookie();
  const primeiro = cookies[0];
  if (primeiro === undefined) {
    throw new Error(
      `entrada recusada (status ${String(r.status)}) destino=${r.headers.get("location") ?? "?"}`,
    );
  }
  return cookies.map((c) => c.split(";")[0]).join("; ");
}

type Turno = { pergunta: string; metrica: string | null };

async function perguntar(
  cookie: string,
  pergunta: string,
  historico: readonly Turno[],
): Promise<{
  texto: string;
  caminho: string;
  autoria: string;
  ms: number;
  leituras: string;
}> {
  const inicio = Date.now();
  const r = await fetch(`${ALVO}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ALVO, cookie },
    body: JSON.stringify({ pergunta, busca: "", tela: "fin/visao", historico }),
  });
  if (!r.ok) {
    const corpo = await r.text();
    /*
     * O teto de seis perguntas por minuto (`CHAT_LIMITE_POR_MINUTO`) existe
     * para a sala da apresentacao, e uma lista de vinte perguntas o estoura na
     * setima. Espera o que o servidor pedir e tenta de novo, uma vez.
     */
    if (r.status === 429) {
      const espera = Number(r.headers.get("retry-after") ?? "12") * 1000;
      await new Promise((ok) => setTimeout(ok, espera + 500));
      return perguntar(cookie, pergunta, historico);
    }
    return {
      texto: `HTTP ${String(r.status)}: ${corpo.slice(0, 200)}`,
      caminho: "-",
      autoria: "-",
      ms: Date.now() - inicio,
      leituras: "-",
    };
  }
  const bruto = await r.text();
  let saida = {
    texto: "(sem resposta)",
    caminho: "-",
    autoria: "-",
    leituras: "-",
  };
  for (const linha of bruto.split("\n")) {
    if (linha.trim() === "") continue;
    const lida = JSON.parse(linha) as Linha;
    if (lida.fase === "falha") {
      saida = { ...saida, texto: `FALHA: ${lida.motivo}` };
    }
    if (lida.fase === "resposta") {
      const res = lida.resposta;
      saida = {
        texto: res.texto,
        caminho:
          res.resolucao?.caminho ?? (res.tipo === "recusa" ? "recusa" : "-"),
        autoria: res.autoria ?? "-",
        leituras:
          res.resolucao?.leituras.map((l) => l.ferramenta).join(", ") || "-",
      };
    }
  }
  return { ...saida, ms: Date.now() - inicio };
}

const escolhidas =
  process.argv.slice(2).length > 0 ? process.argv.slice(2) : PERGUNTAS;

console.log(`alvo: ${ALVO}\n`);
const cookie = await entrar();
console.log("entrou\n");

let degradadas = 0;
for (const bloco of escolhidas) {
  const turnos = bloco.split(">").map((p) => p.trim());
  const historico: Turno[] = [];
  for (const pergunta of turnos) {
    const r = await perguntar(cookie, pergunta, historico);
    if (r.caminho === "degradado") degradadas += 1;
    console.log(`— ${pergunta}`);
    console.log(
      `  [${r.caminho} · ${r.autoria} · ${String(r.ms)} ms · leituras: ${r.leituras}]`,
    );
    console.log(`  ${r.texto.replace(/\n+/g, "\n  ")}\n`);
    historico.push({ pergunta, metrica: null });
  }
}
console.log(`\ndegradadas: ${String(degradadas)}`);
