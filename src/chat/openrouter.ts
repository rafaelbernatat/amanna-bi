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
 *
 * ## O que saiu daqui
 *
 * O **transporte** — chave, modelo, tempo limite e a chamada em si — mora em
 * `src/gateway/openrouter.ts` desde que a extração de marca passou a precisar
 * do mesmo gateway (D-MARCA). O que ficou é o que é do chat: as duas
 * instruções e a forma do que vai e do que volta.
 */

import {
  conversar,
  jsonDaResposta,
  modeloEmUso,
  type AoFalhar,
} from "@/gateway/openrouter";
import { registrarIncidente } from "@/chat/incidente";
import type { TurnoAnterior } from "@/chat/interpretar";
import { REGRAS_DE_NUMERO } from "@/chat/regras";

export { gatewayConfigurado, modeloEmUso } from "@/gateway/openrouter";

/**
 * Esforço baixo no estágio 1, alto no 3 (seção 7.3).
 *
 * *"A alavanca de custo e latência é o esforço, não o modelo. Rebaixar de
 * modelo degrada a interpretação, que é onde erro vira número errado."*
 */
const TETO_DE_SAIDA_INTERPRETACAO = 400;
/** Subiu de 1.200 com T-433: até três parágrafos, até oito frases (T-441). */
const TETO_DE_SAIDA_REDACAO = 2000;

/** O registro de uma falha do gateway, com o estágio que a sofreu (T-430). */
function registrarFalha(
  estagio: "interpretar" | "redigir" | "corrigir",
): AoFalhar {
  return (falha) => {
    registrarIncidente({
      tipo: "gateway_falhou",
      detalhe: {
        estagio,
        modelo: modeloEmUso(),
        status: falha.status,
        erro: falha.erro,
      },
    });
  };
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
- Se a pergunta for sobre os dados da empresa mas não corresponder a nenhuma
  métrica da lista, devolva
  {"metrica": "", "confianca": 0, "alternativas": [os 3 ids mais próximos]}.
- Se a pergunta NÃO for sobre os dados da empresa (RH, financeiro, operação)
  — geografia, conversa, opinião, qualquer outro assunto —, devolva
  {"metrica": "", "confianca": 0, "alternativas": []}. Uma palavra em comum
  ("capital", "caixa") não torna uma métrica próxima de uma pergunta que não
  é sobre os dados.
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
    registrarFalha("interpretar"),
  );
  if (texto === null) return null;

  const bruto = jsonDaResposta(texto) as IntencaoBruta | null;
  if (bruto === null || typeof bruto.metrica !== "string") return null;

  return {
    metrica: bruto.metrica,
    confianca: typeof bruto.confianca === "number" ? bruto.confianca : 0,
    alternativas: Array.isArray(bruto.alternativas)
      ? bruto.alternativas.filter((a): a is string => typeof a === "string")
      : [],
  };
}

/* ------------------------------------------------------------------ *
 * Estágio 3 · redigir
 * ------------------------------------------------------------------ */

const INSTRUCAO_DE_REDACAO = `Você escreve a resposta de um painel de controladoria, em português do Brasil,
no tom de um CFO explicando um número à diretoria.

Recebe um resultado JÁ CALCULADO. Sua tarefa é explicar, não calcular.

Regras que não se negociam:
${REGRAS_DE_NUMERO}

A estrutura, nesta ordem, em até três parágrafos curtos SEPARADOS POR UMA
LINHA EM BRANCO, com no máximo oito frases no total e sem lista. Cada
parágrafo diz uma coisa, em frases curtas, sem repetir o parágrafo anterior:
1. O número e o período: "{metrica} foi {formatado} nos {periodo} até
   {fechamento}". Se houver "pontoPedido", a pessoa perguntou por um mês, e a
   PRIMEIRA frase é sobre ele — "{metrica} em {pontoPedido.rotulo} foi
   {pontoPedido.valor}" —; o número do período inteiro vem na frase seguinte,
   como contexto, nunca antes. Se "formatado" for nulo, diga que não há dado
   neste recorte e pare.
2. Um parágrafo próprio, que começa exatamente com "Traduzindo:" — uma ou
   duas frases sobre o que o número quer dizer para o negócio. Se
   "traducao.emReais" existir, use a base de "traducao.base" com esse valor
   copiado como está, sinal incluído: porcentagem lê-se a cada R$ 100 ("a
   cada R$ 100 de patrimônio, o retorno foi -R$ 2,3", ou "perdeu R$ 2,3"),
   múltiplo lê-se para cada R$ 1,00 ("para cada R$ 1,00 de dívida, R$ 1,8 de
   ativo"). Retorno negativo nunca "devolve" nem "rende": ele perde, consome
   ou destrói. Se "traducao.emReais" for nulo — contagem, dias, valor em
   reais —, traduza numa frase só, concreta para o negócio, sem base e sem
   número novo: "é o faturamento mensal que cobre os custos fixos", "são os
   lançamentos que pedem um olhar antes do fechamento". Se não houver nada
   concreto a dizer, pule o "Traduzindo": definição genérica da métrica não
   é tradução.
2b. Se houver "grafico", o terceiro parágrafo diz o que ele mostra: o pico e o
   vale pelos "destaques" (rótulo e valor na mesma frase), o último ponto, e
   a tendência em palavras (subiu, caiu, oscilou, ficou estável) — sem número
   novo, sem média, sem diferença entre pontos.
3. No mesmo terceiro parágrafo, se houver "comparacao", situe o número contra o custo do dinheiro com as
   "leituras": a referência pelo nome e valor ("CDI de 13,9% ao ano") e a
   diferença como está ("-5,6 p.p."; "ganho real de 3,7%"), sempre do ponto
   de vista da métrica ("o ROIC fica 2,8 p.p. abaixo do CDI"), nunca do da
   referência ("o CDI rendeu 2,8 p.p. acima"). Cite a fonte uma vez. Se
   houver "comparacaoIndisponivelPorque", diga-o numa frase curta. Não cite
   faixa saudável, benchmark de mercado nem regra de bolso que não esteja no
   JSON ("até 3 vezes é aceitável" é número inventado).
4. Ainda no terceiro parágrafo, o que explica o número: cite as "consideracoes" de origem "apoio" pelo
   rótulo e pelo "formatado" ("com lucro líquido de -R$ 8,0 mi sobre patrimônio
   de R$ 350,0 mi"). As de origem "painel" são a composição; use-as quando
   ajudarem. Item com "formatado" nulo: diga "sem dado".
5. Feche o último parágrafo com uma pergunta curta oferecendo o próximo passo. Se houver
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
  qualidade (lançamentos, completude da base), resultado (sobra, consome).

A tela e o gráfico:
- Se houver "tela", a pessoa está vendo essa tela com esses filtros. Cite o
  recorte quando ele não for o padrão ("na Unidade SP", "em dezembro").
- Se houver "grafico", é o painel que a resposta destaca, já resumido: pontos
  com rótulo, destaques e total. Você pode citar um ponto dele SOMENTE junto
  do rótulo do ponto, na mesma frase ("em mar/2026, 5,2%"). Nunca some
  pontos, nunca calcule média nem diferença entre eles.
- Se houver "serieMensal", são os meses da própria métrica, já formatados;
  vale a mesma regra do gráfico: um mês só junto do rótulo dele, na mesma
  frase, sem soma, média ou diferença.
- Se houver "leituras", são leituras adicionais já feitas para esta pergunta;
  cite-as pelo rótulo e pelo valor formatado, e nada além delas.
- Se houver "quemPergunta", é o primeiro nome de quem pergunta: use-o uma
  vez, na abertura, e nunca invente sobrenome, cargo ou empresa. Sem ele,
  sem saudação.`;

/**
 * A única rodada de correção (T-433).
 *
 * O verificador continua bloqueando: um texto com número fora do envelope
 * não vai para a tela. O que muda é que, antes de cair no texto montado, o
 * modelo recebe o próprio texto, os números recusados e a lista do que pode
 * citar, e reescreve uma vez. O resultado passa pelo mesmo verificador; se
 * falhar de novo, fica o montado, e os dois incidentes ficam registrados —
 * a frequência continua medida.
 */
const INSTRUCAO_DE_CORRECAO = `O texto acima foi recusado porque cita números que não existem no
resultado. Reescreva o texto INTEIRO, na mesma estrutura, citando SOMENTE
valores da lista de permitidos, exatamente como escritos ali. Ponto de
gráfico, de série ou de ranking só junto do rótulo, na mesma frase. Um número
recusado sem equivalente na lista: tire a frase. Não explique a correção;
devolva só o texto.`;

export async function corrigirComGateway(
  pergunta: string,
  resultado: unknown,
  textoRecusado: string,
  erradas: readonly string[],
  permitidos: readonly string[],
): Promise<string | null> {
  return conversar(
    [
      { role: "system", content: INSTRUCAO_DE_REDACAO },
      {
        role: "user",
        content: `Pergunta: ${pergunta}\n\nResultado:\n${JSON.stringify(resultado, null, 2)}`,
      },
      { role: "assistant", content: textoRecusado },
      {
        role: "user",
        content: `${INSTRUCAO_DE_CORRECAO}\n\nNúmeros recusados: ${erradas.join("; ")}\n\nPermitidos: ${permitidos.join(" | ")}`,
      },
    ],
    TETO_DE_SAIDA_REDACAO,
    registrarFalha("corrigir"),
  );
}

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
    registrarFalha("redigir"),
  );
}
