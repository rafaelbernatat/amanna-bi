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

import type { TurnoAnterior } from "@/chat/interpretar";

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
- "confianca" baixa quando a pergunta couber em mais de uma métrica.
- Quando houver "Conversa até aqui", ela é contexto. Se a pergunta atual for
  continuação da anterior — só troca o recorte ("e em dezembro?", "e na
  Unidade SP?", "e no consolidado?", "e na área de tecnologia?") ou pede o
  mesmo número de outro jeito —, devolva a métrica da última resposta com
  confiança alta. Se a pergunta nomear outra métrica, escolha essa.`;

/** O que o modelo vê de cada métrica no estágio 1. */
export type MetricaParaOModelo = {
  readonly id: string;
  readonly rotulo: string;
  /**
   * Os sinônimos do catálogo. O modelo precisa deles: "tem custo classificado
   * errado?" só chega a `contas_com_classificacao_inconsistente` por quem
   * conhece o vocabulário do documento de CFO — sem a lista, um modelo mais
   * barato recusou 4 e trocou 11 das 33 perguntas (2026-09-03).
   */
  readonly sinonimos?: readonly string[];
};

/**
 * A conversa anterior, como o modelo a vê: pergunta e métrica, nada mais.
 *
 * Vai na mensagem de `user`, e não no `system`: o `system` é o prefixo estável
 * do cache de prompt (seção 7.4), e a conversa muda a cada turno.
 */
function conversaParaOModelo(historico: readonly TurnoAnterior[]): string {
  if (historico.length === 0) return "";
  const linhas = historico.map(
    (t, i) =>
      `${String(i + 1)}. "${t.pergunta}" → ${t.metrica ?? "sem métrica"}`,
  );
  return `Conversa até aqui:\n${linhas.join("\n")}\n\nPergunta atual: `;
}

/**
 * Pede ao modelo que escolha a métrica.
 *
 * A lista de métricas vai no `system` e a pergunta no `user` — nessa ordem, que
 * é o que a seção 7.4 pede para o cache de prompt funcionar: o catálogo é
 * prefixo estável e a pergunta é sufixo volátil. A conversa anterior, quando
 * há, vai junto da pergunta: é o que faz "e em dezembro?" chegar à métrica da
 * resposta anterior (seção 7.7, recorte implícito).
 */
export async function interpretarComGateway(
  pergunta: string,
  metricas: readonly MetricaParaOModelo[],
  historico: readonly TurnoAnterior[] = [],
): Promise<IntencaoBruta | null> {
  const lista = metricas
    .map((m) =>
      m.sinonimos !== undefined && m.sinonimos.length > 0
        ? `${m.id} — ${m.rotulo} (também: ${m.sinonimos.join("; ")})`
        : `${m.id} — ${m.rotulo}`,
    )
    .join("\n");

  const texto = await conversar(
    [
      {
        role: "system",
        content: `${INSTRUCAO_DE_INTERPRETACAO}\n\nMétricas disponíveis:\n${lista}`,
      },
      { role: "user", content: `${conversaParaOModelo(historico)}${pergunta}` },
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

const INSTRUCAO_DE_REDACAO = `Você escreve a resposta de um painel de controladoria, em português do Brasil,
no tom de um CFO explicando um número à diretoria.

Recebe um resultado JÁ CALCULADO. Sua tarefa é explicar, não calcular.

Regras que não se negociam:
- Use SOMENTE os números que estão no JSON. Não some, não subtraia, não
  arredonde para outro valor, não converta para outra unidade, não estime e não
  invente número nenhum — nem como exemplo, nem como hipótese, nem como
  "cerca de".
- Escreva cada número exatamente como está no campo "formatado", com o sinal, a
  vírgula e a unidade: "1,8 vezes" (nunca "1,8x"), "+2,1 p.p.", "R$ 1.200,0 mi".
- Número negativo leva o sinal: "devolveu -R$ 2,3", "ganho real de -6,4%".
  Se disser o sinal em palavra ("perda de R$ 2,3", "5,6 p.p. abaixo do CDI"),
  a palavra fica na mesma frase, colada ao número.
- Não calcule diferença, variação nem proporção: as que existem já estão em
  "leituras", com o valor pronto.
- Sem saudação, sem repetir a pergunta, sem título, sem lista com marcadores.

A estrutura, nesta ordem, num só parágrafo de até oito frases:
1. O número e o período: "{metrica} foi {formatado} nos {periodo} até
   {fechamento}". Se "formatado" for nulo, diga que não há dado neste recorte e
   pare.
2. "Traduzindo:" — o que o número quer dizer para o negócio. Se
   "traducao.emReais" existir, use a base de "traducao.base" com esse valor
   copiado como está, sinal incluído: porcentagem lê-se a cada R$ 100 ("a
   cada R$ 100 de patrimônio, o retorno foi -R$ 2,3", ou "perdeu R$ 2,3"),
   múltiplo lê-se para cada R$ 1,00 ("para cada R$ 1,00 de dívida, R$ 1,8 de
   ativo"). Retorno negativo nunca "devolve" nem "rende": ele perde, consome
   ou destrói. Se "traducao.emReais" for nulo — contagem, dias, valor em
   reais —, traduza em palavras, sem base e sem número novo: "é o faturamento
   mensal que cobre os custos fixos", "são os lançamentos que pedem um olhar
   antes do fechamento".
3. Se houver "comparacao", situe o número contra o custo do dinheiro com as
   "leituras": a referência pelo nome e valor ("CDI de 13,9% ao ano") e a
   diferença como está ("-5,6 p.p."; "ganho real de 3,7%"), sempre do ponto
   de vista da métrica ("o ROIC fica 2,8 p.p. abaixo do CDI"), nunca do da
   referência ("o CDI rendeu 2,8 p.p. acima"). Cite a fonte uma vez. Se
   houver "comparacaoIndisponivelPorque", diga-o numa frase curta. Não cite
   faixa saudável, benchmark de mercado nem regra de bolso que não esteja no
   JSON ("até 3 vezes é aceitável" é número inventado).
4. O que explica o número: cite as "consideracoes" de origem "apoio" pelo
   rótulo e pelo "formatado" ("com lucro líquido de -R$ 8,0 mi sobre patrimônio
   de R$ 350,0 mi"). As de origem "painel" são a composição; use-as quando
   ajudarem. Item com "formatado" nulo: diga "sem dado".
5. Feche com uma pergunta curta oferecendo o próximo passo. Se houver
   "proximoPasso", copie-o; senão, ofereça abrir uma das "consideracoes".

Leitura prática, não recomendação de investimento:
- Pode dizer o que os números implicam para a operação ("manter capital na
  operação só faz sentido com plano de recuperação de margem"; "cada real
  adicional investido hoje rende menos que o CDI").
- Não recomende comprar, vender, aplicar em, resgatar ou contratar ativo,
  produto financeiro ou instituição. CDI, Selic e IPCA são régua, não conselho.
- Não afirme causa que não esteja em "consideracoes"; se não estiver, diga que
  o envelope não a mostra.
- "leitura" diz a família da métrica; use o vocabulário dela: retorno (rende,
  remunera o capital), custo_de_capital (paga, spread), liquidez (cobre,
  sobra), alavancagem (múltiplo do EBITDA), cobertura (vezes os juros),
  qualidade (lançamentos, completude da base), resultado (sobra, consome).`;

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
