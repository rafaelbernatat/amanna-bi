/**
 * O estágio 1 sem modelo: casamento por sinônimo do catálogo.
 *
 * A seção 7.1 põe a Claude no estágio 1 — ela lê a pergunta e devolve uma
 * intenção estruturada. Este módulo é o **caminho de baixo**: quando não há
 * chave de gateway configurada, o chat continua respondendo, interpretando pelo
 * que o catálogo declara como sinônimo de cada métrica.
 *
 * ## Por que existir, em vez de exigir a chave
 *
 * Três razões, e nenhuma é preguiça:
 *
 * 1. **O produto precisa subir sem depender de terceiro.** Uma demonstração que
 *    morre porque um gateway está fora não demonstra o produto, demonstra o
 *    gateway.
 * 2. **A fronteira fica visível.** Com dois interpretadores atrás da mesma
 *    interface, o que o modelo faz e o que ele não faz deixa de ser conversa: o
 *    estágio 2 é idêntico nos dois, e o número sai igual.
 * 3. **Dá contra o que medir.** O conjunto de avaliação de 7.7 precisa de uma
 *    linha de base; esta é ela.
 *
 * ## O que ele não é
 *
 * Não é o chat do protótipo. O achado 8 do Anexo D descreve aquele: casamento
 * de *substring* com desempate por "maior string vence", sem confiança e sem
 * desambiguação. Aqui a interpretação **devolve confiança** e devolve as
 * alternativas quando está em dúvida — que é o contrato do estágio 1 (7.2), e é
 * o que permite recusar com utilidade em vez de chutar.
 */

import { CATALOGO_GERADO } from "@/semantica/catalogo-gerado";
import { QUERY_PADRAO, type Query } from "@/semantica/contrato";
import { codigosDe, rotuloDe } from "@/semantica/dimensoes";

/** O que o estágio 1 devolve, com ou sem modelo (seção 7.2). */
export type Intencao = {
  /**
   * Precisa existir no catálogo. Quem confere é o estágio 2.
   *
   * Vazia (`""`) é a recusa do estágio 1: o modelo não achou métrica que
   * responda, que é o que o contrato do gateway pede nesse caso. O chat recusa
   * antes de o estágio 2 ver a intenção — `resolver("")` lançaria de qualquer
   * jeito, então isto é seguro por construção.
   */
  readonly metrica: string;
  readonly filtros: Query;
  /** 0 a 1. Abaixo do limiar, a resposta vira pergunta de desambiguação. */
  readonly confianca: number;
  /** Métricas próximas, para quando a confiança é baixa. */
  readonly alternativas: readonly string[];
};

/** Abaixo disto, o chat pergunta em vez de responder (seção 7.2). */
export const CONFIANCA_MINIMA = 0.45;

/**
 * Abaixo disto o casamento não responde: recusa, nunca estimativa (seção 7.5).
 *
 * Uma sigla de três letras escrita inteira — PMR, DSO, FCO — é o sinal mais
 * fraco que ainda diz o que se pergunta. Abaixo só sobra palavra solta de nome
 * ("por" em "Custo por FTE" vale 3 × 0,8 = 2,4) e "uf" (2). Sem o piso, "Por
 * que isso?" empatava oito métricas em 2,4 e respondia a primeira em ordem
 * alfabética, porque a confiança mede distância para o segundo colocado e não
 * o tamanho do casamento.
 */
export const PONTUACAO_MINIMA = 3;

/**
 * As letras acentuadas do português e a sua forma sem acento.
 *
 * Um mapa explícito na primeira passada, e a decomposição Unicode na segunda,
 * para o que o mapa não cobre. O mapa entrou numa investigação de 2026-09-03
 * em que "equilíbrio" parecia não virar "equilibrio" em produção; a causa
 * real era o cliente de teste, que mandava o acento em Latin-1 na URL
 * (`%e9`, não `%C3%A9`) — o navegador manda UTF-8 e sempre funcionou. O
 * mapa ficou porque não custa nada e não depende da biblioteca de Unicode
 * do runtime. Teste por HTTP com acento: só com a URL já codificada em
 * UTF-8, ou pelo navegador.
 */
const SEM_ACENTO: Readonly<Record<string, string>> = {
  á: "a",
  à: "a",
  â: "a",
  ã: "a",
  ä: "a",
  é: "e",
  è: "e",
  ê: "e",
  ë: "e",
  í: "i",
  ì: "i",
  î: "i",
  ï: "i",
  ó: "o",
  ò: "o",
  ô: "o",
  õ: "o",
  ö: "o",
  ú: "u",
  ù: "u",
  û: "u",
  ü: "u",
  ç: "c",
  ñ: "n",
};

/** Texto sem acento e em minúsculas, para o casamento não depender de digitação. */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .replace(
      /[áàâãäéèêëíìîïóòôõöúùûüçñ]/g,
      (letra) => SEM_ACENTO[letra] ?? letra,
    )
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/**
 * O termo aparece na pergunta como palavra inteira, não dentro de outra.
 *
 * `includes` puro achava "divida" em "endividamento" e "paga" em "pagamos" —
 * coincidência de letras, não de vocabulário — e a primeira levava "nosso
 * endividamento está alto?" ao financiamento com confiança 0,81. Fronteira de
 * palavra nos dois lados; só o plural em `s` é tolerado, para que
 * "treinamentos" ainda encontre "treinamento". Os rótulos "Investimento (FCI)"
 * e "Financiamento (FCF)" têm parênteses, daí o escape.
 */
function contemTermo(alvo: string, termo: string): boolean {
  const escapado = termo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escapado}s?(?=$|[^a-z0-9])`).test(alvo);
}

/**
 * Palavras de ligação que aparecem em nome de métrica e não dizem nada sozinhas.
 *
 * "Encargos sobre salários" e "Despesa de pessoal sobre receita" contêm
 * "sobre"; "Área mais crítica" e "Superior ou mais" contêm "mais". Sem esta
 * lista, "retorno **sobre** o capital investido" empatava as duas primeiras e
 * "compensa **mais** aplicar no CDI?" empatava as duas últimas — e o chat
 * respondia encargos a quem perguntou ROIC.
 */
const PALAVRAS_VAZIAS: ReadonlySet<string> = new Set([
  "sobre",
  "por",
  "para",
  "com",
  "sem",
  "ate",
  "entre",
  "mais",
  "menos",
  "que",
  "nao",
]);

/** Quanto a métrica combinou, e se foi por termo inteiro ou por palavra solta. */
type Casamento = { readonly pontos: number; readonly inteiro: boolean };

/**
 * Quanto uma métrica combina com a pergunta.
 *
 * Sinônimo inteiro encontrado vale mais que palavra solta, e sinônimo longo
 * vale mais que curto — "custo de pessoal" é sinal mais forte que "custo". O
 * achado 9 do Anexo D é o que acontece sem isso: `vaga` existe em duas
 * intenções, e o desempate por comprimento deixava uma inalcançável.
 */
function pontuar(pergunta: string, id: string): Casamento {
  const nada: Casamento = { pontos: 0, inteiro: false };
  const entrada = CATALOGO_GERADO[id];
  if (entrada === undefined) return nada;

  const alvo = normalizar(pergunta);

  /*
   * Palavra solta só conta quando vem do **nome** da métrica, e a razão
   * apareceu em duas perguntas de verdade.
   *
   * "qual o lucro apurado do ano" contém "lucro". A palavra está no nome de
   * `lucro_liquido` e também dentro de um sinônimo de `conversao_de_caixa`
   * ("qualidade do lucro"). Com peso igual, as duas empatavam e o desempate
   * alfabético entregava a resposta à conversão de caixa — certa pela regra,
   * errada pela pergunta.
   *
   * "qual é o ROE da empresa?" contém "empresa". A palavra está dentro de um
   * sinônimo do eNPS ("recomendaria a empresa"), era o único casamento, e por
   * isso saía com confiança 1,00 — o chat respondia eNPS a quem perguntou ROE.
   *
   * Palavra que aparece no nome da métrica é sinal do que se pergunta; palavra
   * solta dentro de um sinônimo é coincidência de vocabulário, e vale zero. Um
   * sinônimo diz o que se pergunta quando aparece inteiro.
   */
  const PESO_DO_NOME = 0.8;

  const candidatos: readonly { texto: string; doNome: boolean }[] = [
    { texto: entrada.rotulo, doNome: true },
    { texto: id.replace(/_/g, " "), doNome: true },
    ...entrada.sinonimos.map((s) => ({ texto: s, doNome: false })),
  ];

  let melhor = nada;
  const considerar = (pontos: number, inteiro: boolean) => {
    if (pontos > melhor.pontos) melhor = { pontos, inteiro };
  };

  for (const candidato of candidatos) {
    const termo = normalizar(candidato.texto);
    if (termo.length === 0) continue;

    // Termo inteiro na pergunta: o sinal mais forte que existe.
    if (contemTermo(alvo, termo)) {
      considerar(termo.length, true);
      continue;
    }

    const palavras = termo.split(/\s+/).filter((p) => p.length > 2);

    // Todas as palavras presentes, ainda que separadas.
    if (palavras.length > 1 && palavras.every((p) => contemTermo(alvo, p))) {
      considerar(termo.length - 1, true);
      continue;
    }

    // Crédito parcial: uma palavra forte do nome da métrica.
    if (!candidato.doNome) continue;
    for (const palavra of palavras) {
      if (PALAVRAS_VAZIAS.has(palavra)) continue;
      if (contemTermo(alvo, palavra)) {
        considerar(palavra.length * PESO_DO_NOME, false);
      }
    }
  }
  return melhor;
}

/**
 * Os filtros que a pergunta pede, sobre os que já estão na tela.
 *
 * Exportada porque a orquestração usa o mesmo extrator quando a métrica vem do
 * modelo: o recorte é vocabulário fechado nosso, e sai da pergunta — não do
 * palpite local, que é `null` sempre que nada casa.
 */
export function filtrosDaPergunta(pergunta: string, atuais: Query): Query {
  const alvo = normalizar(pergunta);
  let saida = atuais;

  for (const dimensao of [
    "entidade",
    "area",
    "modalidade",
    "periodo",
  ] as const) {
    for (const codigo of codigosDe(dimensao)) {
      const rotulo = normalizar(rotuloDe(dimensao, codigo));
      if (rotulo.length > 3 && alvo.includes(rotulo)) {
        saida = { ...saida, [dimensao]: codigo };
      }
    }
  }

  const ano = /\b(20\d{2})\b/.exec(pergunta);
  if (ano?.[1] !== undefined) saida = { ...saida, ano: ano[1] };

  return saida;
}

/**
 * Interpreta a pergunta contra o catálogo.
 *
 * Devolve `null` quando nada combina acima do piso — e `null` aqui é resposta,
 * não falha: o chat recusa com as métricas próximas (RF-16), em vez de
 * responder qualquer coisa.
 */
export function interpretarLocalmente(
  pergunta: string,
  atuais: Query = QUERY_PADRAO,
): Intencao | null {
  const ranking = Object.keys(CATALOGO_GERADO)
    .map((id) => ({ id, ...pontuar(pergunta, id) }))
    .filter((x) => x.pontos >= PONTUACAO_MINIMA)
    .sort((a, b) => b.pontos - a.pontos || a.id.localeCompare(b.id));

  const primeiro = ranking[0];
  if (primeiro === undefined) return null;

  /*
   * A confiança sai da **distância** para o segundo colocado, e não do tamanho
   * do casamento. Duas métricas empatadas significam pergunta ambígua, e é isso
   * que o número precisa dizer para o chat saber pedir desambiguação.
   *
   * Dois casos valem zero de propósito. Empate exato: a fórmula sozinha daria
   * 0,5, acima do limiar, e "qual é a margem de contribuição?" respondia a
   * margem bruta por ordem alfabética. E casamento só por palavra solta do nome
   * com alguém disputando: "despesa", em "Despesa de pessoal", não diz que a
   * pergunta é sobre a folha quando "custo" também casou com outra métrica. Nos
   * dois, o chat pergunta em vez de chutar — é a desambiguação da seção 7.2.
   */
  const segundo = ranking[1]?.pontos ?? 0;
  const empate = segundo === primeiro.pontos;
  const parcialDisputado = !primeiro.inteiro && ranking.length > 1;
  const CHEIA = 1;
  const confianca =
    empate || parcialDisputado
      ? 0
      : CHEIA - segundo / (primeiro.pontos + segundo);

  const QUANTAS_ALTERNATIVAS = 3;
  return {
    metrica: primeiro.id,
    filtros: filtrosDaPergunta(pergunta, atuais),
    confianca,
    alternativas: ranking.slice(1, 1 + QUANTAS_ALTERNATIVAS).map((x) => x.id),
  };
}
