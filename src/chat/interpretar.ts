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
  /** Precisa existir no catálogo. Quem confere é o estágio 2. */
  readonly metrica: string;
  readonly filtros: Query;
  /** 0 a 1. Abaixo do limiar, a resposta vira pergunta de desambiguação. */
  readonly confianca: number;
  /** Métricas próximas, para quando a confiança é baixa. */
  readonly alternativas: readonly string[];
};

/** Abaixo disto, o chat pergunta em vez de responder (seção 7.2). */
export const CONFIANCA_MINIMA = 0.45;

/** Texto sem acento e em minúsculas, para o casamento não depender de digitação. */
function normalizar(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Quanto uma métrica combina com a pergunta.
 *
 * Sinônimo inteiro encontrado vale mais que palavra solta, e sinônimo longo
 * vale mais que curto — "custo de pessoal" é sinal mais forte que "custo". O
 * achado 9 do Anexo D é o que acontece sem isso: `vaga` existe em duas
 * intenções, e o desempate por comprimento deixava uma inalcançável.
 */
function pontuar(pergunta: string, id: string): number {
  const entrada = CATALOGO_GERADO[id];
  if (entrada === undefined) return 0;

  const alvo = normalizar(pergunta);

  /*
   * O nome da métrica pesa mais que um sinônimo, e a razão apareceu no primeiro
   * teste com a pergunta de verdade.
   *
   * "qual o lucro apurado do ano" contém "lucro". A palavra está no nome de
   * `lucro_liquido` e também dentro de um sinônimo de `conversao_de_caixa`
   * ("qualidade do lucro"). Com peso igual, as duas empatavam e o desempate
   * alfabético entregava a resposta à conversão de caixa — certa pela regra,
   * errada pela pergunta.
   *
   * Palavra que aparece no **nome** da métrica é sinal do que se pergunta;
   * palavra solta dentro de um sinônimo é coincidência de vocabulário.
   */
  const PESO_DO_NOME = 0.8;
  const PESO_DO_SINONIMO = 0.35;

  const candidatos: readonly { texto: string; peso: number }[] = [
    { texto: entrada.rotulo, peso: PESO_DO_NOME },
    { texto: id.replace(/_/g, " "), peso: PESO_DO_NOME },
    ...entrada.sinonimos.map((s) => ({ texto: s, peso: PESO_DO_SINONIMO })),
  ];

  let melhor = 0;
  for (const candidato of candidatos) {
    const termo = normalizar(candidato.texto);
    if (termo.length === 0) continue;

    // Termo inteiro na pergunta: o sinal mais forte que existe.
    if (alvo.includes(termo)) {
      melhor = Math.max(melhor, termo.length);
      continue;
    }

    const palavras = termo.split(/\s+/).filter((p) => p.length > 2);

    // Todas as palavras presentes, ainda que separadas.
    if (palavras.length > 1 && palavras.every((p) => alvo.includes(p))) {
      melhor = Math.max(melhor, termo.length - 1);
      continue;
    }

    // Crédito parcial: uma palavra forte, com o peso da origem dela.
    for (const palavra of palavras) {
      if (alvo.includes(palavra)) {
        melhor = Math.max(melhor, palavra.length * candidato.peso);
      }
    }
  }
  return melhor;
}

/** Os filtros que a pergunta pede, sobre os que já estão na tela. */
function filtrosDa(pergunta: string, atuais: Query): Query {
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
 * Devolve `null` quando nada combina — e `null` aqui é resposta, não falha: o
 * chat recusa com as métricas próximas (RF-16), em vez de responder qualquer
 * coisa.
 */
export function interpretarLocalmente(
  pergunta: string,
  atuais: Query = QUERY_PADRAO,
): Intencao | null {
  const ranking = Object.keys(CATALOGO_GERADO)
    .map((id) => ({ id, pontos: pontuar(pergunta, id) }))
    .filter((x) => x.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos || a.id.localeCompare(b.id));

  const primeiro = ranking[0];
  if (primeiro === undefined) return null;

  /*
   * A confiança sai da **distância** para o segundo colocado, e não do tamanho
   * do casamento. Duas métricas empatadas significam pergunta ambígua, e é isso
   * que o número precisa dizer para o chat saber pedir desambiguação.
   */
  const segundo = ranking[1]?.pontos ?? 0;
  const CHEIA = 1;
  const confianca =
    primeiro.pontos === 0 ? 0 : CHEIA - segundo / (primeiro.pontos + segundo);

  const QUANTAS_ALTERNATIVAS = 3;
  return {
    metrica: primeiro.id,
    filtros: filtrosDa(pergunta, atuais),
    confianca,
    alternativas: ranking.slice(1, 1 + QUANTAS_ALTERNATIVAS).map((x) => x.id),
  };
}
