/**
 * O gateway do chat: estágios 1 e 3 da seção 7.1 (decisão D-CHAT).
 *
 * A seção 8.2 do PRD fixa o SDK da Anthropic. A decisão de 2026-08-30 troca a
 * porta pelo OpenRouter — o gateway fala o protocolo da OpenAI e roteia para o
 * modelo escolhido em `OPENROUTER_MODEL`. **A arquitetura não muda**: o modelo
 * continua entrando só nas pontas, e o número continua nascendo no estágio 2,
 * que é código nosso.
 *
 * ## O que sai deste ambiente
 *
 * A seção 11 é específica: *"só o catálogo de métricas, a pergunta e os números
 * já agregados saem do ambiente. Nunca dado bruto, nunca linha de pessoa, nunca
 * credencial."* É o que as duas funções abaixo enviam, e nada além:
 *
 * - no estágio 1, a pergunta e a lista de métricas com os sinônimos;
 * - no estágio 3, a pergunta e o **resultado já calculado** — o número, a
 *   fórmula, os degraus que o compõem e a taxa de referência.
 *
 * Nenhuma linha de fato atravessa a fronteira em nenhum dos dois.
 *
 * ## Sem chave, não há chamada
 *
 * As funções devolvem `null` em vez de lançar. Quem chama trata a ausência como
 * caminho normal e usa o interpretador local — o chat continua respondendo, com
 * o mesmo número, escrevendo pior. Lançar transformaria "a chave não foi
 * configurada" em erro de tela, e isso é configuração, não defeito.
 */

/** O modelo padrão, quando `OPENROUTER_MODEL` não diz outro. */
const MODELO_PADRAO = "anthropic/claude-opus-4.1";

const ENDERECO = "https://openrouter.ai/api/v1/chat/completions";

/** Quanto se espera pelo gateway antes de responder pelo caminho local. */
const LIMITE_MS = 30_000;

/**
 * Esforço baixo no estágio 1, alto no 3 (seção 7.3).
 *
 * *"A alavanca de custo e latência é o esforço, não o modelo. Rebaixar de
 * modelo degrada a interpretação, que é onde erro vira número errado."*
 */
const TETO_DE_SAIDA_INTERPRETACAO = 400;
const TETO_DE_SAIDA_REDACAO = 1200;

/** A chave configurada, ou `null`. Nunca é registrada nem devolvida. */
function chave(): string | null {
  const bruta = process.env["OPENROUTER_API_KEY"];
  return bruta === undefined || bruta.trim() === "" ? null : bruta;
}

/** O chat tem gateway configurado? A tela usa isto para dizer o que está ativo. */
export function gatewayConfigurado(): boolean {
  return chave() !== null;
}

export function modeloEmUso(): string {
  const escolhido = process.env["OPENROUTER_MODEL"];
  return escolhido === undefined || escolhido.trim() === ""
    ? MODELO_PADRAO
    : escolhido;
}

type Mensagem = { readonly role: "system" | "user"; readonly content: string };

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
async function conversar(
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

/* ------------------------------------------------------------------ *
 * Estágio 1 · interpretar
 * ------------------------------------------------------------------ */

/** O que o modelo devolve no estágio 1. Validado antes de ser usado. */
export type IntencaoBruta = {
  readonly metrica: string;
  readonly confianca: number;
  readonly alternativas: readonly string[];
};

const INSTRUCAO_DE_INTERPRETACAO = `Você interpreta perguntas sobre um painel de controladoria.

Responda SOMENTE com JSON, no formato:
{"metrica": "<id>", "confianca": <0 a 1>, "alternativas": ["<id>", "<id>"]}

Regras:
- "metrica" precisa ser um dos ids da lista fornecida. Nunca invente um id.
- Você NÃO calcula nem estima número nenhum. Sua saída é só a intenção.
- Se a pergunta não corresponder a nenhuma métrica da lista, devolva
  {"metrica": "", "confianca": 0, "alternativas": [os 3 ids mais próximos]}.
- "confianca" baixa quando a pergunta couber em mais de uma métrica.`;

/**
 * Pede ao modelo que escolha a métrica.
 *
 * A lista de métricas vai no `system` e a pergunta no `user` — nessa ordem, que
 * é o que a seção 7.4 pede para o cache de prompt funcionar: o catálogo é
 * prefixo estável e a pergunta é sufixo volátil.
 */
export async function interpretarComGateway(
  pergunta: string,
  metricas: readonly { readonly id: string; readonly rotulo: string }[],
): Promise<IntencaoBruta | null> {
  const lista = metricas.map((m) => `${m.id} — ${m.rotulo}`).join("\n");

  const texto = await conversar(
    [
      {
        role: "system",
        content: `${INSTRUCAO_DE_INTERPRETACAO}\n\nMétricas disponíveis:\n${lista}`,
      },
      { role: "user", content: pergunta },
    ],
    TETO_DE_SAIDA_INTERPRETACAO,
  );
  if (texto === null) return null;

  try {
    // O modelo às vezes embrulha o JSON em cerca de código. Pegar do primeiro
    // `{` ao último `}` é mais robusto que exigir formato exato, e não afrouxa
    // nada: o que sai daqui ainda é validado contra o catálogo no estágio 2.
    const inicio = texto.indexOf("{");
    const fim = texto.lastIndexOf("}");
    if (inicio < 0 || fim <= inicio) return null;

    const bruto = JSON.parse(texto.slice(inicio, fim + 1)) as IntencaoBruta;
    if (typeof bruto.metrica !== "string") return null;

    return {
      metrica: bruto.metrica,
      confianca: typeof bruto.confianca === "number" ? bruto.confianca : 0,
      alternativas: Array.isArray(bruto.alternativas)
        ? bruto.alternativas.filter((a): a is string => typeof a === "string")
        : [],
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * Estágio 3 · redigir
 * ------------------------------------------------------------------ */

const INSTRUCAO_DE_REDACAO = `Você escreve a resposta de um painel de controladoria, em português do Brasil.

Recebe um resultado JÁ CALCULADO. Sua tarefa é explicar, não calcular.

Regras que não se negociam:
- Use SOMENTE os números que estão no JSON. Não some, não arredonde para outro
  valor, não estime, não invente nenhum número que não esteja lá.
- Escreva os números exatamente como aparecem no campo "formatado".
- Explique o que entrou na conta, citando os itens de "consideracoes" e o que
  cada um faz com o resultado.
- Se houver "comparacao", use-a para situar o resultado contra o custo do
  dinheiro, dizendo de onde a taxa veio.
- Três a seis frases. Direto, sem saudação e sem repetir a pergunta.
- Nada de recomendação de investimento.`;

/** Pede ao modelo o texto da resposta, a partir do resultado já calculado. */
export async function redigirComGateway(
  pergunta: string,
  resultado: unknown,
): Promise<string | null> {
  return conversar(
    [
      { role: "system", content: INSTRUCAO_DE_REDACAO },
      {
        role: "user",
        content: `Pergunta: ${pergunta}\n\nResultado:\n${JSON.stringify(resultado, null, 2)}`,
      },
    ],
    TETO_DE_SAIDA_REDACAO,
  );
}
