/**
 * O laço de ferramentas: a pergunta composta, respondida por leituras que o
 * modelo **pede** e o nosso código executa (D-CHAT-ferramentas, T-350).
 *
 * ```
 *  pergunta composta
 *     │
 *     ├─ classificar   NOSSO CÓDIGO. Sinais na pergunta. Sem gateway aqui.
 *     ├─ laço          modelo pede leituras por nome; validador e executor
 *     │                (nosso código) leem pela fronteira; o modelo escreve.
 *     ├─ principal     NOSSO CÓDIGO. A métrica principal vira a Resolucao
 *     │                de sempre — prévia, ações de tela, sugestões.
 *     └─ verificar     todo número do texto tem de existir nas leituras,
 *                      e ponto de série só com o rótulo por perto.
 * ```
 *
 * O número continua nascendo no estágio 2: nenhuma ferramenta recebe texto
 * livre que vire consulta, e o que o modelo devolve passa pelo mesmo
 * verificador do caminho simples. O que muda é que o modelo escolhe **o que
 * ler**, e não só o que dizer.
 *
 * ## Sem gateway
 *
 * Duas perguntas compostas ainda respondem sem modelo, porque são
 * determinísticas: "o que esse gráfico mostra?" com um painel em foco, e um
 * ranking cuja métrica e dimensão a própria pergunta nomeia. O resto recebe
 * uma recusa útil — "sem o modelo, respondo uma métrica por vez" — com as
 * métricas mais próximas como atalho. Nunca uma estimativa.
 *
 * ## Falhou
 *
 * Gateway fora, inspetor bloqueou, texto vazio: `null`. Quem chama degrada
 * ao caminho simples e **diz** no texto que a parte composta não foi feita.
 */

import { consultaDisponivel, dicionarioDoChat } from "@/acesso/consulta";
import { classificar, type Sinal } from "@/chat/classificar";
import type { ContextoDaTela } from "@/chat/contexto";
import { rotularFiltros } from "@/chat/contexto";
import { ferramentas } from "@/chat/ferramentas/catalogo";
import {
  criarExecutor,
  executarPedido,
  LeituraRecusada,
  type Portas,
  PORTAS_DO_PRODUTO,
} from "@/chat/ferramentas/executar";
import { inspecionarSaida } from "@/chat/ferramentas/inspetor";
import { fraseDePasso, PASSO_DE_REDACAO } from "@/chat/ferramentas/passos";
import {
  LIMITE_MS_POR_RODADA,
  MAXIMO_DE_CHAMADAS,
  MAXIMO_DE_RODADAS,
  TETO_DE_SAIDA_COMPOSTA,
  TOP_N_PADRAO,
} from "@/chat/ferramentas/limites";
import type { ResultadoDeFerramenta } from "@/chat/ferramentas/resultado";
import { registrarIncidente } from "@/chat/incidente";
import {
  CONFIANCA_MINIMA,
  interpretarLocalmente,
  type Intencao,
  type TurnoAnterior,
  linhaDaConversa,
} from "@/chat/interpretar";
import { REGRAS_DE_FORMA, REGRAS_DE_NUMERO } from "@/chat/regras";
import { resolver, type Resolucao } from "@/chat/resolver";
import { destinoDaMetrica, metricasComDestino } from "@/chat/roteamento";
import {
  conversarComFerramentas,
  gatewayConfigurado,
  modeloEmUso,
  type Mensagem,
} from "@/gateway/openrouter";
import { CATALOGO_GERADO } from "@/semantica/catalogo-gerado";
import type {
  DimensaoDeRanking,
  PanelResponse,
  Query,
} from "@/semantica/contrato";

/** O que o laço entrega: a resolução principal, com as leituras, e o texto. */
export type Composta = {
  readonly tipo: "composta";
  readonly resolucao: Resolucao;
  /** O texto que o modelo escreveu no próprio laço; `null` sem modelo. */
  readonly texto: string | null;
};

/**
 * O que o laço conta enquanto trabalha (T-434).
 *
 * `aoAndamento` recebe uma frase por leitura e uma quando a redação começa.
 * `aoPrevia` recebe a resolução da primeira leitura que nomeia uma métrica —
 * é o que põe o número e o gráfico na tela enquanto o modelo ainda escreve.
 */
export type EventosDoLaco = {
  readonly aoAndamento?: (passo: string) => void;
  readonly aoPrevia?: (resolucao: Resolucao) => void;
};

/** A recusa útil de uma pergunta que o laço não respondeu. */
export type CompostaRecusada = {
  readonly tipo: "recusa";
  readonly texto: string;
  /**
   * Por que não houve resposta, que é o que decide o texto na tela.
   *
   * `sem_gateway`: não há chave, e o laço só sabe as duas leituras
   * determinísticas. `sem_leitura`: o laço correu, com modelo, e nenhuma
   * leitura nomeou métrica — dizer "sem o modelo configurado" aqui seria
   * mentira, e era o que saía antes de T-446.
   */
  readonly motivo: "sem_gateway" | "sem_leitura";
  readonly alternativas: readonly {
    readonly id: string;
    readonly rotulo: string;
  }[];
};

/* ------------------------------------------------------------------ *
 * A instrução do laço
 * ------------------------------------------------------------------ */

export const INSTRUCAO_DO_LACO = `Você responde perguntas sobre um painel de controladoria, em português do Brasil,
no tom de um CFO explicando um número à diretoria.

Você NÃO calcula nem estima número nenhum. Para saber qualquer número, chame
uma ferramenta: cada uma lê o dado pela mesma regra do painel e devolve os
números já formatados. Use SOMENTE os números devolvidos pelas ferramentas.

ANTES DE LER, decida o que a pergunta pede:
- um número → ler_metrica (com "mes" quando a pergunta nomeia um mês);
- o maior, o menor, os maiores, "o que mais" → ranking;
- como se divide, a composição, "por área", "por conta" → decompor;
- a evolução, o pior mês, o melhor mês → serie_da_metrica;
- uma métrica ao lado da outra → comparar_metricas;
- contra o ano passado → variacao;
- "esse gráfico", "esse painel", a tela → explicar_grafico, que usa o painel
  em foco do contexto;
- não sei o id da métrica → listar_metricas antes.

Como usar as ferramentas:
- Peça primeiro; escreva só depois de ter os números. No máximo ${String(MAXIMO_DE_CHAMADAS)} leituras
  por pergunta — escolha as que respondem à pergunta.
- Um erro devolvido por uma ferramenta é resposta: ajuste o pedido ou diga que
  não há esse dado. Nunca preencha com estimativa.
- A pergunta que exclui alguma coisa ("fora a despesa com pessoal, o que
  mais…") pede a lista sem aquele item: leia a lista e deixe o item de fora
  da resposta.

Como escrever (regras que não se negociam):
${REGRAS_DE_NUMERO}
${REGRAS_DE_FORMA}
- Ao citar um ponto de série, de gráfico ou de ranking, escreva o rótulo do
  ponto na mesma frase, colado ao número: "em mar/2026, 5,2%"; "Cliente Alfa,
  R$ 12,0 mi". Nunca some pontos, nunca calcule média, diferença nem
  participação: as que existem já vêm calculadas nos resultados.
- Cite o recorte (período, mês, entidade, área) quando ele não for o padrão.

A FORMA SEGUE A PERGUNTA. Não existe estrutura fixa.
- A primeira frase responde a pergunta, com as palavras dela. Sem abertura de
  contexto, sem repetir a pergunta.
- Pediu uma lista ("quais", "os maiores", "me mostra") → escreva uma LISTA, um
  item por linha começando com "- ", rótulo e valor ao lado, na ordem em que a
  leitura os devolveu.
- Pediu um número → de uma a três frases.
- Perguntou o que uma coisa é ("esses lançamentos são o que?") → nomeie os
  itens concretos que a leitura trouxe; a definição da métrica não responde.
- No máximo três parágrafos, separados por uma linha em branco.
- NUNCA escreva o que falta ("não há comparação disponível", "o recorte não
  traz", "o envelope não mostra"). O que não existe simplesmente não aparece
  — a menos que a coisa que falta seja a própria resposta, e aí é uma frase
  só.
- A conversa até aqui diz de que assunto se fala: "e quanto eles custam?"
  depois do headcount é a folha; "e esses lançamentos são o que?" pede os
  lançamentos que a resposta anterior contou. Resolva pronomes e elipses por
  ela antes de escolher o que ler.
- Feche com uma pergunta curta de próximo passo só quando houver um passo de
  verdade a oferecer.`;

function contextoParaOModelo(contexto: ContextoDaTela): string {
  const filtros = Object.entries(rotularFiltros(contexto.filtros))
    .map(([rotulo, valor]) => `${rotulo}: ${valor}`)
    .join(" · ");
  const linhas = [
    `Tela aberta: ${contexto.tituloDaTela ?? "nenhuma"}`,
    `Filtros da tela: ${filtros}`,
    `Painel em foco: ${contexto.painelEmFoco ?? "nenhum"}`,
    `Anos carregados: ${contexto.anos.length === 0 ? "não informado" : contexto.anos.join(", ")}`,
    ...(contexto.primeiroNome === null
      ? []
      : [`Quem pergunta: ${contexto.primeiroNome}`]),
  ];
  return linhas.join("\n");
}

/**
 * O esquema de `amanna_chat`, como o modelo precisa vê-lo para escrever SQL.
 *
 * Sai do dicionário semeado na migração 012 — objeto, coluna, unidade e uma
 * descrição curta —, e não de `information_schema`: a ordem do catálogo do
 * Postgres muda, e a seção 7.4 chama isso de defeito, não de variação.
 */
async function esquemaParaOModelo(): Promise<string> {
  const dicionario = await dicionarioDoChat();
  if (dicionario.length === 0) return "";
  const porObjeto = new Map<string, string[]>();
  for (const c of dicionario) {
    const unidade = c.unidade === null ? "" : ` (${c.unidade})`;
    const descricao = c.descricao === null ? "" : ` — ${c.descricao}`;
    porObjeto.set(c.objeto, [
      ...(porObjeto.get(c.objeto) ?? []),
      `${c.coluna}${unidade}${descricao}`,
    ]);
  }
  const linhas = [...porObjeto].map(
    ([objeto, colunas]) => `${objeto}: ${colunas.join("; ")}`,
  );
  return (
    "\n\nViews de consultar_dados (esquema amanna_chat; escreva sem o nome do " +
    "esquema). Cada uma já vem recortada pelo perfil de quem pergunta:\n" +
    linhas.join("\n")
  );
}

function conversaParaOModelo(historico: readonly TurnoAnterior[]): string {
  if (historico.length === 0) return "";
  const linhas = historico.map(linhaDaConversa);
  return `\n\nConversa até aqui:\n${linhas.join("\n")}`;
}

/**
 * A resolução de uma resposta que não tem métrica do catálogo (T-454).
 *
 * **Sentinela, e não tipo novo.** Tornar `Resolucao.metrica` anulável se
 * espalharia por `Previa`, `previaDe`, `conversa.ts` e todos os literais de
 * `Resolucao` dos testes; a sentinela custa quatro guardas — a prévia, as
 * sugestões, a saída do laço e o rodapé — e elas estão nomeadas nos três
 * arquivos que as têm.
 *
 * `metrica: ""` é o que os leitores já toleram: `PROXIMO_PASSO[""]` é
 * `undefined`, `rotuloDaMetrica("")` devolve `""`, e o verificador lê os
 * permitidos das leituras, que é onde eles estão.
 */
function resolucaoSemMetrica(
  leituras: readonly ResultadoDeFerramenta[],
  daConsulta: ResultadoDeFerramenta,
  contexto: ContextoDaTela,
): Resolucao {
  const l = daConsulta.leitura;
  const consulta = l.tipo === "consulta" ? l : null;
  return {
    metrica: "",
    rotulo: "",
    valor: null,
    unidade: "contagem",
    formula: "",
    decisao: null,
    asOf: consulta?.asOf ?? "",
    consideracoes: [],
    familia: null,
    referencias: [],
    comparacao: null,
    comparacaoIndisponivelPorque: null,
    acoes: { filtros: contexto.filtros, tela: null, painel: null },
    fontes: consulta?.fontes ?? [],
    serieMensal: [],
    pontoPedido: null,
    painel: painelDaComposta(leituras),
    leituras,
    caminho: "composto",
  };
}

/* ------------------------------------------------------------------ *
 * A métrica principal
 * ------------------------------------------------------------------ */

/** A métrica cujo painel de destino é o dado, se alguma. */
export function metricaDoPainel(painel: string): string | null {
  for (const metrica of metricasComDestino()) {
    if (destinoDaMetrica(metrica)?.painel === painel) return metrica;
  }
  return null;
}

/**
 * A métrica que vira a `Resolucao` de sempre — prévia, ações, sugestões.
 *
 * A primeira leitura que nomeia uma métrica; o painel explicado, pela métrica
 * que ele detalha; senão o palpite local, se confiante. `null` quando nada
 * nomeia métrica alguma.
 */
export function metricaPrincipal(
  leituras: readonly ResultadoDeFerramenta[],
  palpite: Intencao | null,
  filtrosDaTela: Query,
): { readonly metrica: string; readonly filtros: Query } | null {
  for (const { leitura } of leituras) {
    switch (leitura.tipo) {
      case "metrica":
      case "serie":
      case "variacao":
      case "ranking":
      case "decomposicao":
        return { metrica: leitura.metrica, filtros: leitura.filtros };
      case "comparacao": {
        const primeiro = leitura.itens[0];
        if (primeiro !== undefined) {
          return { metrica: primeiro.metrica, filtros: leitura.filtros };
        }
        break;
      }
      case "grafico": {
        const metrica = metricaDoPainel(leitura.resumo.id);
        if (metrica !== null) return { metrica, filtros: leitura.filtros };
        break;
      }
      case "catalogo":
        break;
    }
  }
  if (
    palpite !== null &&
    palpite.metrica !== "" &&
    palpite.confianca >= CONFIANCA_MINIMA
  ) {
    return { metrica: palpite.metrica, filtros: palpite.filtros };
  }
  void filtrosDaTela;
  return null;
}

/**
 * O painel que a resposta composta desenha (T-432).
 *
 * Precedência: o gráfico que a pergunta pediu para explicar; senão a série
 * lida; senão o ranking ou a decomposição, em barras; senão o painel da
 * métrica principal, que `resolver` já escolheu. É a leitura que a pessoa
 * pediu, e não a métrica de que ela deriva, que aparece na bolha.
 */
export function painelDaComposta(
  leituras: readonly ResultadoDeFerramenta[],
): PanelResponse | null {
  for (const { leitura } of leituras) {
    if (leitura.tipo === "grafico") return leitura.desenho;
  }
  for (const { leitura } of leituras) {
    if (leitura.tipo === "serie") return leitura.desenho;
  }
  for (const { leitura } of leituras) {
    if (leitura.tipo === "ranking" || leitura.tipo === "decomposicao") {
      return leitura.desenho;
    }
  }
  return null;
}

/** A identidade de uma métrica principal, para reaproveitar a prévia. */
function chaveDe(p: { readonly metrica: string; readonly filtros: Query }) {
  return `${p.metrica}|${JSON.stringify(p.filtros)}`;
}

/* ------------------------------------------------------------------ *
 * Sem gateway: o que ainda dá para responder
 * ------------------------------------------------------------------ */

/** A dimensão de ranking que a pergunta nomeia, quando nomeia uma. */
export function dimensaoNaPergunta(pergunta: string): DimensaoDeRanking | null {
  const texto = pergunta
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  const TABELA: readonly [RegExp, DimensaoDeRanking][] = [
    [/\bclientes?\b/, "cliente"],
    [/\bfornecedor(?:es)?\b/, "fornecedor"],
    [/\bcentros? de custo\b/, "centro_custo"],
    [/\blinhas? da dre\b/, "linha_dre"],
    [/\bcontas?\b/, "conta"],
    [/\bsegmentos?\b/, "segmento"],
    [/\b(?:ufs?|estados?)\b/, "uf"],
    [/\bareas?\b/, "area"],
  ];
  for (const [padrao, dimensao] of TABELA) {
    if (padrao.test(texto)) return dimensao;
  }
  return null;
}

const SEM_GATEWAY =
  "Sem o modelo configurado, respondo uma métrica por vez. Pergunte por uma métrica, ou escolha uma destas:";

/** O laço correu com modelo e nada nomeou métrica: não há o que oferecer. */
const SEM_LEITURA =
  "Não consigo responder a isso com os dados do painel. Posso responder perguntas sobre as métricas de RH e financeiro.";

function recusaUtil(
  palpite: Intencao | null,
  motivo: CompostaRecusada["motivo"] = "sem_gateway",
): CompostaRecusada {
  const ids = [
    ...(palpite === null || palpite.metrica === "" ? [] : [palpite.metrica]),
    ...(palpite?.alternativas ?? []),
  ].filter((id) => CATALOGO_GERADO[id] !== undefined);
  const QUANTAS = 3;
  return {
    tipo: "recusa",
    texto: motivo === "sem_gateway" ? SEM_GATEWAY : SEM_LEITURA,
    motivo,
    alternativas: [...new Set(ids)].slice(0, QUANTAS).map((id) => ({
      id,
      rotulo: CATALOGO_GERADO[id]?.rotulo ?? id,
    })),
  };
}

/* ------------------------------------------------------------------ *
 * O laço
 * ------------------------------------------------------------------ */

/**
 * Responde uma pergunta composta.
 *
 * `null` é "o laço não concluiu": quem chama degrada ao caminho simples. A
 * recusa útil é resposta, não falha.
 */
export async function resolverComposta(
  pergunta: string,
  contexto: ContextoDaTela,
  historico: readonly TurnoAnterior[],
  portas: Portas = PORTAS_DO_PRODUTO,
  eventos: EventosDoLaco = {},
): Promise<Composta | CompostaRecusada | null> {
  const palpite = interpretarLocalmente(pergunta, contexto.filtros);
  const { sinais } = classificar(pergunta, palpite);

  if (!gatewayConfigurado()) {
    const leituras = await leiturasDeterministicas(
      pergunta,
      sinais,
      palpite,
      contexto,
      portas,
    );
    if (leituras.length === 0) return recusaUtil(palpite);
    const principal = metricaPrincipal(leituras, palpite, contexto.filtros);
    if (principal === null) return recusaUtil(palpite);
    const resolucao = await resolver(principal.metrica, principal.filtros);
    return {
      tipo: "composta",
      resolucao: {
        ...resolucao,
        painel: painelDaComposta(leituras) ?? resolucao.painel,
        leituras,
        caminho: "composto",
      },
      texto: null,
    };
  }

  /*
   * A prévia cedo (T-434): na primeira leitura que nomeia uma métrica, a
   * resolução principal é montada e entregue — número e gráfico chegam à
   * tela enquanto o laço continua. Se a principal no fim for a mesma, a
   * resolução é reaproveitada; senão, resolve-se de novo.
   */
  /*
   * Um portador, e não um `let`: a atribuição acontece dentro do fechamento
   * de `aoLida`, e a análise de fluxo do TypeScript não a enxerga — depois do
   * laço ela estreitava a variável para `never`.
   */
  const guardada: {
    previa: { readonly chave: string; readonly resolucao: Resolucao } | null;
  } = { previa: null };
  const executor = criarExecutor(contexto, portas, {
    aoLeitura: (pedido) => eventos.aoAndamento?.(fraseDePasso(pedido)),
    aoLida: async (resultado) => {
      if (guardada.previa !== null || eventos.aoPrevia === undefined) return;
      const primeira = metricaPrincipal([resultado], null, contexto.filtros);
      if (primeira === null) return;
      const resolucao = await resolver(primeira.metrica, primeira.filtros);
      guardada.previa = { chave: chaveDe(primeira), resolucao };
      eventos.aoPrevia(resolucao);
    },
  });
  const modelo = modeloEmUso("ferramentas");
  /*
   * O esquema vai na mensagem do **usuário**, e não na de sistema.
   *
   * A de sistema é conferida byte a byte pelo inspetor antes de cada rodada, e
   * é onde mora o ponto de corte do cache (T-438): mexer nela por instalação
   * custaria as duas coisas. O esquema é estável dentro de uma instalação, e
   * caber no sufixo é o preço de manter a instrução intocada.
   */
  const comConsulta = consultaDisponivel();
  const esquema = comConsulta ? await esquemaParaOModelo() : "";
  const mensagens: readonly Mensagem[] = [
    { role: "system", content: INSTRUCAO_DO_LACO },
    {
      role: "user",
      content: `${contextoParaOModelo(contexto)}${esquema}${conversaParaOModelo(historico)}\n\nPergunta: ${pergunta}`,
    },
  ];

  const resultado = await conversarComFerramentas(
    mensagens,
    ferramentas(contexto, comConsulta),
    executor.executar,
    {
      maximoDeRodadas: MAXIMO_DE_RODADAS,
      tetoDeSaida: TETO_DE_SAIDA_COMPOSTA,
      limiteMsPorRodada: LIMITE_MS_POR_RODADA,
    },
    {
      inspetor: (conversa) => {
        const bloqueio = inspecionarSaida(conversa, INSTRUCAO_DO_LACO);
        if (bloqueio !== null) {
          registrarIncidente({
            tipo: "inspetor_bloqueou",
            detalhe: { motivo: bloqueio.motivo, mensagem: bloqueio.mensagem },
          });
        }
        return bloqueio;
      },
      modelo,
      aoRodada: (rodada) => {
        if (rodada > 1) eventos.aoAndamento?.(PASSO_DE_REDACAO);
      },
      aoFalhar: (falha, rodada) => {
        registrarIncidente({
          tipo: "gateway_falhou",
          detalhe: {
            estagio: "ferramentas",
            modelo,
            rodada,
            status: falha.status,
            erro: falha.erro,
          },
        });
      },
    },
  );

  if (resultado === null) {
    registrarIncidente({
      tipo: "laco_falhou",
      detalhe: {
        modelo,
        leituras: executor.leituras().length,
        recusadas: executor.recusadas(),
      },
    });
    return null;
  }

  const leituras = executor.leituras();
  const principal = metricaPrincipal(leituras, palpite, contexto.filtros);
  if (principal === null) {
    /*
     * O laço leu, mas nada do que leu é métrica do catálogo (T-454).
     *
     * É o caso normal de uma resposta que veio só da consulta: "quais os
     * colaboradores mais caros" não deriva de métrica nenhuma. Antes disto o
     * código caía em `recusaUtil`, cujo texto diz "sem o modelo configurado" —
     * numa resposta bem-sucedida, com o modelo presente.
     */
    const daConsulta = leituras.find((l) => l.leitura.tipo === "consulta");
    if (daConsulta === undefined) return recusaUtil(palpite, "sem_leitura");
    return {
      tipo: "composta",
      resolucao: resolucaoSemMetrica(leituras, daConsulta, contexto),
      texto: resultado.texto,
    };
  }

  const resolucao =
    guardada.previa !== null && guardada.previa.chave === chaveDe(principal)
      ? guardada.previa.resolucao
      : await resolver(principal.metrica, principal.filtros);
  return {
    tipo: "composta",
    resolucao: {
      ...resolucao,
      painel: painelDaComposta(leituras) ?? resolucao.painel,
      leituras,
      caminho: "composto",
    },
    texto: resultado.texto,
  };
}

/**
 * Sem modelo: o gráfico em foco e o ranking nomeado, e nada mais.
 *
 * A dimensão sai da pergunta ("por cliente", "quais fornecedores"), e a
 * métrica do palpite local, quando confiante. Sem os dois, nada é lido.
 */
async function leiturasDeterministicas(
  pergunta: string,
  sinais: readonly Sinal[],
  palpite: Intencao | null,
  contexto: ContextoDaTela,
  portas: Portas,
): Promise<readonly ResultadoDeFerramenta[]> {
  const leituras: ResultadoDeFerramenta[] = [];
  if (sinais.includes("grafico") && contexto.painelEmFoco !== null) {
    try {
      leituras.push({
        ferramenta: "explicar_grafico",
        leitura: await executarPedido(
          {
            nome: "explicar_grafico",
            painel: contexto.painelEmFoco,
            filtros: contexto.filtros,
          },
          contexto,
          portas,
        ),
      });
    } catch (erro) {
      if (!(erro instanceof LeituraRecusada)) throw erro;
    }
  }
  const confiante =
    palpite !== null &&
    palpite.metrica !== "" &&
    palpite.confianca >= CONFIANCA_MINIMA;
  const dimensao = dimensaoNaPergunta(pergunta);
  if (sinais.includes("ranking") && confiante && dimensao !== null) {
    try {
      leituras.push({
        ferramenta: "ranking",
        leitura: await executarPedido(
          {
            nome: "ranking",
            metrica: palpite.metrica,
            dimensao,
            limite: TOP_N_PADRAO,
            ordem: "maior",
            filtros: palpite.filtros,
          },
          contexto,
          portas,
        ),
      });
    } catch (erro) {
      if (!(erro instanceof LeituraRecusada)) throw erro;
    }
  }
  return leituras;
}
