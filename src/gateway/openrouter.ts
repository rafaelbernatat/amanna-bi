/**
 * O transporte até o modelo: a porta, o tempo limite e a chave.
 *
 * Extraído de `src/chat/openrouter.ts` quando a extração de marca passou a
 * precisar do mesmo gateway (D-MARCA). Nada aqui mudou de comportamento — o
 * que mudou é que existe **um** cliente, e não dois.
 *
 * O que cada consumidor mantém para si é a **instrução**: o chat sabe o que
 * pedir ao modelo sobre métricas, a marca sabe o que pedir sobre cores, e nem
 * um nem outro precisa saber como se fala com o gateway.
 *
 * ## Sem chave, não há chamada
 *
 * `conversar` devolve `null` em vez de lançar. Quem chama trata a ausência
 * como caminho normal e segue pelo caminho determinístico — o produto
 * continua respondendo, com o mesmo resultado, escrevendo pior. Lançar
 * transformaria "a chave não foi configurada" em erro de tela, e isso é
 * configuração, não defeito.
 */

/** O modelo padrão, quando `OPENROUTER_MODEL` não diz outro. */
const MODELO_PADRAO = "anthropic/claude-opus-4.1";

const ENDERECO = "https://openrouter.ai/api/v1/chat/completions";

/** Quanto se espera pelo gateway antes de seguir pelo caminho local. */
const LIMITE_MS = 30_000;

/** A chave configurada, ou `null`. Nunca é registrada nem devolvida. */
function chave(): string | null {
  const bruta = process.env["OPENROUTER_API_KEY"];
  return bruta === undefined || bruta.trim() === "" ? null : bruta;
}

/** Há gateway configurado? A tela usa isto para dizer o que está ativo. */
export function gatewayConfigurado(): boolean {
  return chave() !== null;
}

export function modeloEmUso(): string {
  const escolhido = process.env["OPENROUTER_MODEL"];
  return escolhido === undefined || escolhido.trim() === ""
    ? MODELO_PADRAO
    : escolhido;
}

export type Mensagem = {
  readonly role: "system" | "user";
  readonly content: string;
};

type RespostaDoGateway = {
  readonly choices?: readonly {
    readonly message?: { readonly content?: unknown };
  }[];
};

/**
 * Uma chamada ao gateway. Devolve o texto, ou `null` se não deu.
 *
 * Engole a falha de propósito: rede fora, chave recusada e resposta malformada
 * significam a mesma coisa para quem chama — seguir pelo caminho local.
 */
export async function conversar(
  mensagens: readonly Mensagem[],
  tetoDeSaida: number,
): Promise<string | null> {
  const autorizacao = chave();
  if (autorizacao === null) return null;

  try {
    const resposta = await fetch(ENDERECO, {
      method: "POST",
      signal: AbortSignal.timeout(LIMITE_MS),
      headers: {
        authorization: `Bearer ${autorizacao}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: modeloEmUso(),
        max_tokens: tetoDeSaida,
        messages: mensagens,
      }),
    });
    if (!resposta.ok) return null;

    const corpo = (await resposta.json()) as RespostaDoGateway;
    const texto = corpo.choices?.[0]?.message?.content;
    return typeof texto === "string" && texto.trim() !== "" ? texto : null;
  } catch {
    return null;
  }
}

/**
 * O JSON que o modelo devolveu, mesmo embrulhado em cerca de código.
 *
 * Pegar do primeiro `{` ao último `}` é mais robusto que exigir formato
 * exato, e não afrouxa nada: o que sai daqui ainda é validado contra o
 * catálogo, no chat, e contra a lista de candidatos, na marca.
 */
export function jsonDaResposta(texto: string): unknown | null {
  const inicio = texto.indexOf("{");
  const fim = texto.lastIndexOf("}");
  if (inicio < 0 || fim <= inicio) return null;
  try {
    return JSON.parse(texto.slice(inicio, fim + 1));
  } catch {
    return null;
  }
}
