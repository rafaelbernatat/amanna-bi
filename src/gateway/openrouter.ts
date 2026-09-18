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

/**
 * O que o processo já gastou, somando todas as chamadas.
 *
 * Existe para o teto de uma apresentação (D-CONVITE-apresentacao) poder contar
 * **tudo** — os três estágios e o laço — sem que cada chamada precise carregar
 * um contador pela mão até a rota. Quem consome lê o total antes e depois, e o
 * que registra é a diferença; somando as diferenças, o total da instância
 * fecha com o total do gateway, mesmo com perguntas concorrentes.
 *
 * No escopo do processo, como os outros contadores: variável de módulo daria
 * um contador por pedaço empacotado.
 */
const GASTO = Symbol.for("amanna-bi.gateway.tokens");
type PortadorDeTokens = { [GASTO]?: { entrada: number; saida: number } };

function acumulador(): { entrada: number; saida: number } {
  const portador = globalThis as unknown as PortadorDeTokens;
  portador[GASTO] ??= { entrada: 0, saida: 0 };
  return portador[GASTO];
}

/** O total gasto por este processo até agora. */
export function tokensDoProcesso(): Tokens {
  const atual = acumulador();
  return { entrada: atual.entrada, saida: atual.saida };
}

/** Só para teste: devolve o contador ao zero. */
export function esquecerTokensDoProcesso(): void {
  delete (globalThis as unknown as PortadorDeTokens)[GASTO];
}

function tokensDe(corpo: RespostaDoGateway): Tokens {
  const entrada = corpo.usage?.prompt_tokens;
  const saida = corpo.usage?.completion_tokens;
  const lidos: Tokens = {
    entrada: typeof entrada === "number" ? entrada : 0,
    saida: typeof saida === "number" ? saida : 0,
  };
  const total = acumulador();
  total.entrada += lidos.entrada;
  total.saida += lidos.saida;
  return lidos;
}

/**
 * Por que uma ida ao gateway não deu (T-430).
 *
 * `status` é o HTTP quando houve resposta, `null` quando nem isso — rede,
 * tempo esgotado. `erro` são os primeiros caracteres do corpo, ou o nome da
 * exceção. Nunca um cabeçalho, nunca a chave: o que sai daqui vai para o log.
 */
export type FalhaDoGateway = {
  readonly status: number | null;
  readonly erro: string;
};

/** Quem quer saber da falha. O laço registra com estágio, modelo e rodada. */
export type AoFalhar = (falha: FalhaDoGateway) => void;

/** Quanto do corpo de erro vai para o registro. */
const TAMANHO_DO_ERRO_REGISTRADO = 200;

type IdaAoGateway =
  | { readonly ok: true; readonly corpo: RespostaDoGateway }
  | { readonly ok: false; readonly falha: FalhaDoGateway };

function resumirErro(texto: string): string {
  return texto.replace(/\s+/g, " ").trim().slice(0, TAMANHO_DO_ERRO_REGISTRADO);
}

/**
 * Uma ida ao gateway.
 *
 * Um corpo 200 sem `choices` também é falha: o OpenRouter devolve erro de
 * provedor assim, com `error.message` no corpo, e antes disto ele passava
 * como "resposta vazia" sem ninguém saber o motivo.
 */
async function chamarGateway(
  corpo: Readonly<Record<string, unknown>>,
  limiteMs: number,
): Promise<IdaAoGateway> {
  const autorizacao = chave();
  if (autorizacao === null) {
    return { ok: false, falha: { status: null, erro: "sem chave" } };
  }
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
    const texto = await resposta.text();
    if (!resposta.ok) {
      return {
        ok: false,
        falha: { status: resposta.status, erro: resumirErro(texto) },
      };
    }
    const lido = JSON.parse(texto) as RespostaDoGateway & {
      readonly error?: { readonly message?: unknown };
    };
    if (!Array.isArray(lido.choices) || lido.choices.length === 0) {
      const mensagem = lido.error?.message;
      return {
        ok: false,
        falha: {
          status: resposta.status,
          erro: resumirErro(
            typeof mensagem === "string" ? mensagem : "resposta sem choices",
          ),
        },
      };
    }
    return { ok: true, corpo: lido };
  } catch (erro) {
    return {
      ok: false,
      falha: {
        status: null,
        erro: erro instanceof Error ? erro.name : "falha desconhecida",
      },
    };
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
  aoFalhar?: AoFalhar,
): Promise<{ readonly texto: string; readonly tokens: Tokens } | null> {
  const ida = await chamarGateway(
    { model: modelo, max_tokens: tetoDeSaida, messages: mensagens },
    LIMITE_MS,
  );
  if (!ida.ok) {
    aoFalhar?.(ida.falha);
    return null;
  }
  const texto = ida.corpo.choices?.[0]?.message?.content;
  if (typeof texto !== "string" || texto.trim() === "") {
    aoFalhar?.({ status: null, erro: "texto vazio" });
    return null;
  }
  return { texto, tokens: tokensDe(ida.corpo) };
}

/** Uma chamada ao gateway. Devolve o texto, ou `null` se não deu. */
export async function conversar(
  mensagens: readonly Mensagem[],
  tetoDeSaida: number,
  aoFalhar?: AoFalhar,
): Promise<string | null> {
  return (
    (await conversarComUso(mensagens, tetoDeSaida, modeloEmUso(), aoFalhar))
      ?.texto ?? null
  );
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
  opcoes: {
    readonly inspetor?: Inspetor;
    readonly modelo?: string;
    /** Chamado com a rodada em que o gateway falhou (T-430). */
    readonly aoFalhar?: (falha: FalhaDoGateway, rodada: number) => void;
    /** Chamado quando uma rodada vai sair; a segunda em diante é redação (T-434). */
    readonly aoRodada?: (rodada: number) => void;
  } = {},
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
    opcoes.aoRodada?.(rodada);

    const ida = await chamarGateway(
      {
        model: modelo,
        max_tokens: limites.tetoDeSaida,
        messages: conversa,
        tools,
        tool_choice: escolha,
        /*
         * Sem `parallel_tool_calls` (T-430). O OpenRouter nao lista esse
         * parametro para modelo nenhum — nem gpt-4o, nem Sonnet — e, com
         * `require_parameters`, recusa a chamada inteira com 404 "No endpoints
         * found that can handle the requested parameters". Foi por isso que
         * toda pergunta composta degradava em silencio. Os dois provedores
         * ja executam chamadas em paralelo por padrao.
         */
        provider: { require_parameters: true },
      },
      limites.limiteMsPorRodada,
    );
    if (!ida.ok) {
      opcoes.aoFalhar?.(ida.falha, rodada);
      return null;
    }
    const corpo = ida.corpo;
    tokens = somar(tokens, tokensDe(corpo));

    const mensagem = corpo.choices?.[0]?.message;
    if (mensagem === undefined) {
      opcoes.aoFalhar?.(
        { status: null, erro: "resposta sem mensagem" },
        rodada,
      );
      return null;
    }
    const pedidas = lerChamadas(mensagem.tool_calls);
    const texto =
      typeof mensagem.content === "string" ? mensagem.content : null;

    if (pedidas.length === 0 || ultima) {
      if (texto === null || texto.trim() === "") {
        opcoes.aoFalhar?.({ status: null, erro: "texto vazio" }, rodada);
        return null;
      }
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
