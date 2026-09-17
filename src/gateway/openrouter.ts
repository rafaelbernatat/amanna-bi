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
 *
 * ## O laço de ferramentas (D-CHAT-ferramentas)
 *
 * `conversarComFerramentas` fala o protocolo de `tools` da OpenAI, que o
 * OpenRouter repassa: o modelo pede leituras por nome e argumentos, **nós**
 * executamos, o resultado volta como mensagem `tool`, e o modelo escreve
 * quando tem o que precisa. O que este módulo garante é a forma do laço —
 * toda chamada recebe resposta, o número de rodadas tem teto, a última
 * rodada força texto. O que cada ferramenta faz é de quem chama.
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

/**
 * O estágio em que o modelo entra: o caminho de sempre, ou o laço de
 * ferramentas. O laço pode usar outro modelo (`OPENROUTER_MODEL_FERRAMENTAS`)
 * porque compor leituras exige seguir um protocolo — um modelo que erra a
 * escala numa redação erra o argumento numa chamada. Sem a variável, vale o
 * mesmo modelo dos estágios 1 e 3.
 */
export type Estagio = "simples" | "ferramentas";

export function modeloEmUso(estagio: Estagio = "simples"): string {
  const paraFerramentas = process.env["OPENROUTER_MODEL_FERRAMENTAS"];
  if (
    estagio === "ferramentas" &&
    paraFerramentas !== undefined &&
    paraFerramentas.trim() !== ""
  ) {
    return paraFerramentas;
  }
  const escolhido = process.env["OPENROUTER_MODEL"];
  return escolhido === undefined || escolhido.trim() === ""
    ? MODELO_PADRAO
    : escolhido;
}

/* ------------------------------------------------------------------ *
 * Mensagens
 * ------------------------------------------------------------------ */

/** Uma chamada de ferramenta como o modelo a pediu, já com os argumentos lidos. */
export type Chamada = {
  readonly id: string;
  readonly nome: string;
  /** O JSON dos argumentos, ou `null` quando o modelo mandou texto que não é JSON. */
  readonly argumentos: unknown;
};

export type MensagemDeSistema = {
  readonly role: "system";
  readonly content: string;
};
export type MensagemDeUsuario = {
  readonly role: "user";
  readonly content: string;
};
export type MensagemDeAssistente = {
  readonly role: "assistant";
  readonly content: string | null;
  readonly tool_calls?: readonly ChamadaBruta[];
};
export type MensagemDeFerramenta = {
  readonly role: "tool";
  readonly tool_call_id: string;
  readonly content: string;
};

export type Mensagem =
  | MensagemDeSistema
  | MensagemDeUsuario
  | MensagemDeAssistente
  | MensagemDeFerramenta;

/** A chamada como vem do protocolo: os argumentos ainda são texto. */
type ChamadaBruta = {
  readonly id: string;
  readonly type: "function";
  readonly function: { readonly name: string; readonly arguments: string };
};

type MensagemDoGateway = {
  readonly content?: unknown;
  readonly tool_calls?: unknown;
};

type RespostaDoGateway = {
  readonly choices?: readonly { readonly message?: MensagemDoGateway }[];
  readonly usage?: {
    readonly prompt_tokens?: unknown;
    readonly completion_tokens?: unknown;
  };
};

/** Quantos tokens uma chamada consumiu, quando o gateway conta. */
export type Tokens = { readonly entrada: number; readonly saida: number };

const SEM_TOKENS: Tokens = { entrada: 0, saida: 0 };

function tokensDe(corpo: RespostaDoGateway): Tokens {
  const entrada = corpo.usage?.prompt_tokens;
  const saida = corpo.usage?.completion_tokens;
  return {
    entrada: typeof entrada === "number" ? entrada : 0,
    saida: typeof saida === "number" ? saida : 0,
  };
}

/** Uma ida ao gateway. `null` quando não deu, por qualquer razão. */
async function chamarGateway(
  corpo: Readonly<Record<string, unknown>>,
  limiteMs: number,
): Promise<RespostaDoGateway | null> {
  const autorizacao = chave();
  if (autorizacao === null) return null;
  try {
    const resposta = await fetch(ENDERECO, {
      method: "POST",
      signal: AbortSignal.timeout(limiteMs),
      headers: {
        authorization: `Bearer ${autorizacao}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(corpo),
    });
    if (!resposta.ok) return null;
    return (await resposta.json()) as RespostaDoGateway;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * O caminho de sempre
 * ------------------------------------------------------------------ */

/**
 * Uma chamada ao gateway, com a contagem de tokens. `null` se não deu.
 *
 * Engole a falha de propósito: rede fora, chave recusada e resposta malformada
 * significam a mesma coisa para quem chama — seguir pelo caminho local.
 */
export async function conversarComUso(
  mensagens: readonly Mensagem[],
  tetoDeSaida: number,
  modelo: string = modeloEmUso(),
): Promise<{ readonly texto: string; readonly tokens: Tokens } | null> {
  const corpo = await chamarGateway(
    { model: modelo, max_tokens: tetoDeSaida, messages: mensagens },
    LIMITE_MS,
  );
  if (corpo === null) return null;
  const texto = corpo.choices?.[0]?.message?.content;
  if (typeof texto !== "string" || texto.trim() === "") return null;
  return { texto, tokens: tokensDe(corpo) };
}

/** Uma chamada ao gateway. Devolve o texto, ou `null` se não deu. */
export async function conversar(
  mensagens: readonly Mensagem[],
  tetoDeSaida: number,
): Promise<string | null> {
  return (await conversarComUso(mensagens, tetoDeSaida))?.texto ?? null;
}

/* ------------------------------------------------------------------ *
 * O laço de ferramentas
 * ------------------------------------------------------------------ */

/** Uma ferramenta como o protocolo a descreve. */
export type FerramentaDoGateway = {
  readonly nome: string;
  readonly descricao: string;
  readonly parametros: Readonly<Record<string, unknown>>;
};

/** Quem executa uma chamada e devolve o texto que o modelo lê. */
export type Executor = (chamada: Chamada) => Promise<string>;

export type LimitesDoLaco = {
  readonly maximoDeRodadas: number;
  readonly tetoDeSaida: number;
  readonly limiteMsPorRodada: number;
};

/** Por que o laço parou. */
export type Parada = "texto" | "rodadas_esgotadas" | "bloqueado";

export type ResultadoDoLaco = {
  readonly texto: string;
  readonly chamadas: readonly Chamada[];
  readonly rodadas: number;
  readonly parada: Parada;
  readonly tokens: Tokens;
};

/** Um inspetor de saída: `null` deixa a rodada ir. */
export type Inspetor = (mensagens: readonly Mensagem[]) => unknown | null;

function lerChamadas(bruto: unknown): readonly ChamadaBruta[] {
  if (!Array.isArray(bruto)) return [];
  return bruto.filter(
    (c): c is ChamadaBruta =>
      typeof c === "object" &&
      c !== null &&
      typeof (c as ChamadaBruta).id === "string" &&
      typeof (c as ChamadaBruta).function?.name === "string" &&
      typeof (c as ChamadaBruta).function.arguments === "string",
  );
}

function argumentosDe(texto: string): unknown {
  try {
    return JSON.parse(texto);
  } catch {
    return null;
  }
}

function somar(a: Tokens, b: Tokens): Tokens {
  return { entrada: a.entrada + b.entrada, saida: a.saida + b.saida };
}

/**
 * O laço: pede, executa, devolve, até o modelo escrever.
 *
 * - Primeira rodada com `tool_choice: "required"`: uma pergunta que chegou
 *   aqui foi classificada como composta, e o modelo precisa ler antes de
 *   escrever. Depois, `"auto"`.
 * - **Toda** chamada recebe uma mensagem `tool`, mesmo a recusada: um
 *   `tool_call` sem resposta é erro de protocolo no gateway.
 * - Esgotadas as rodadas, uma última ida com `tool_choice: "none"` força o
 *   texto com o que já foi lido.
 * - O inspetor vê as mensagens antes de cada ida. Bloqueou → `null`, e quem
 *   chama degrada.
 *
 * `null` é falha — rede, chave, resposta malformada, inspetor. Quem chama
 * trata como o caminho de sempre trata a ausência do gateway.
 */
export async function conversarComFerramentas(
  mensagens: readonly Mensagem[],
  ferramentas: readonly FerramentaDoGateway[],
  executar: Executor,
  limites: LimitesDoLaco,
  opcoes: { readonly inspetor?: Inspetor; readonly modelo?: string } = {},
): Promise<ResultadoDoLaco | null> {
  const modelo = opcoes.modelo ?? modeloEmUso("ferramentas");
  const tools = ferramentas.map((f) => ({
    type: "function",
    function: {
      name: f.nome,
      description: f.descricao,
      parameters: f.parametros,
    },
  }));

  const conversa: Mensagem[] = [...mensagens];
  const chamadas: Chamada[] = [];
  let tokens = SEM_TOKENS;

  for (let rodada = 1; rodada <= limites.maximoDeRodadas + 1; rodada += 1) {
    const ultima = rodada > limites.maximoDeRodadas;
    const escolha = ultima ? "none" : rodada === 1 ? "required" : "auto";

    if (opcoes.inspetor !== undefined && opcoes.inspetor(conversa) !== null) {
      return null;
    }

    const corpo = await chamarGateway(
      {
        model: modelo,
        max_tokens: limites.tetoDeSaida,
        messages: conversa,
        tools,
        tool_choice: escolha,
        parallel_tool_calls: true,
        provider: { require_parameters: true },
      },
      limites.limiteMsPorRodada,
    );
    if (corpo === null) return null;
    tokens = somar(tokens, tokensDe(corpo));

    const mensagem = corpo.choices?.[0]?.message;
    if (mensagem === undefined) return null;
    const pedidas = lerChamadas(mensagem.tool_calls);
    const texto =
      typeof mensagem.content === "string" ? mensagem.content : null;

    if (pedidas.length === 0 || ultima) {
      if (texto === null || texto.trim() === "") return null;
      return {
        texto,
        chamadas,
        rodadas: rodada,
        parada: ultima ? "rodadas_esgotadas" : "texto",
        tokens,
      };
    }

    conversa.push({ role: "assistant", content: texto, tool_calls: pedidas });
    for (const pedida of pedidas) {
      const chamada: Chamada = {
        id: pedida.id,
        nome: pedida.function.name,
        argumentos: argumentosDe(pedida.function.arguments),
      };
      chamadas.push(chamada);
      const resultado = await executar(chamada);
      conversa.push({
        role: "tool",
        tool_call_id: pedida.id,
        content: resultado,
      });
    }
  }
  return null;
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
