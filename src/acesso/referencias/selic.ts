/**
 * A taxa Selic, lida do Banco Central.
 *
 * O chat compara o resultado da empresa com o custo do dinheiro: um lucro de
 * -R$ 8 mi diz uma coisa; o mesmo lucro num ano de Selic a 14% diz outra, e a
 * segunda é a que muda decisão. É a pergunta que a diretoria faz de qualquer
 * jeito — "valeu a pena operar ou era melhor ter deixado no CDI?" —, e o
 * produto passa a respondê-la em vez de deixá-la para a conversa.
 *
 * ## Este número não é do cliente, e por isso não está no catálogo
 *
 * O catálogo da seção 9.4 descreve **as métricas da empresa**: fórmula, view de
 * origem, grão. A Selic não tem view de origem nem fórmula — é uma taxa
 * pública, decidida pelo Copom. Enfiá-la no catálogo faria parecer que ela sai
 * do warehouse do cliente, que é exatamente o tipo de confusão que a seção 9.4
 * existe para impedir.
 *
 * Fica aqui, na camada de acesso, como o que é: uma **referência externa**, com
 * origem e data declaradas.
 *
 * ## A saída de rede é decisão registrada
 *
 * A seção 11 do PRD diz que só o catálogo, a pergunta e os números agregados
 * saem do ambiente. Uma chamada ao BCB é saída nova — e nela **não vai nada do
 * cliente**: é um GET sem corpo, sem cabeçalho de identificação, para uma série
 * pública. A decisão de fazê-la é de Produto, de 2026-08-30, e está em
 * `docs/decisoes/D-CHAT-openrouter.md` junto com a do gateway.
 *
 * ## Falhar aqui não pode derrubar a resposta
 *
 * Se o BCB não responder, o chat responde **sem** a comparação, e diz que não
 * conseguiu a taxa. A alternativa — deixar a resposta inteira falhar porque uma
 * referência de contexto não veio — trocaria uma resposta boa por nenhuma.
 */

/** A série 432 do SGS: meta Selic definida pelo Copom, em % ao ano. */
const SERIE_META_SELIC = 432;

const ENDERECO = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${String(SERIE_META_SELIC)}/dados/ultimos/1?formato=json`;

/** Quanto se espera pelo BCB antes de desistir e responder sem a comparação. */
const LIMITE_MS = 4000;

/**
 * Por quanto tempo a taxa lida vale.
 *
 * O Copom se reúne a cada 45 dias; uma hora de cache é folga de duas ordens de
 * grandeza sobre a frequência com que o número muda, e evita uma ida à rede por
 * pergunta do chat.
 */
const VALIDADE_MS = 60 * 60 * 1000;

/** A taxa, com de onde veio e de quando é. */
export type TaxaDeReferencia = {
  readonly nome: string;
  /** Em % ao ano. */
  readonly valor: number;
  /** A data a que a taxa se refere, em ISO. */
  readonly vigenteDesde: string;
  readonly fonte: string;
};

type Cache = { readonly taxa: TaxaDeReferencia; readonly lidaEm: number };
let cache: Cache | null = null;

/** Uma linha do SGS: `{ "data": "16/09/2026", "valor": "14.00" }`. */
type LinhaDoSgs = { readonly data?: unknown; readonly valor?: unknown };

/** `16/09/2026` vira `2026-09-16`. O SGS responde em pt-BR. */
function comoIso(data: string): string {
  const partes = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(data);
  if (partes === null) return data;
  return `${String(partes[3])}-${String(partes[2])}-${String(partes[1])}`;
}

/**
 * A meta Selic vigente, ou `null` se o BCB não respondeu.
 *
 * Devolve `null` em vez de lançar porque quem chama precisa seguir sem ela. A
 * ausência é informação — o chat escreve "não consegui a Selic agora" — e não
 * um erro que derruba a resposta inteira.
 */
export async function lerSelic(): Promise<TaxaDeReferencia | null> {
  const agora = Date.now();
  if (cache !== null && agora - cache.lidaEm < VALIDADE_MS) return cache.taxa;

  try {
    const resposta = await fetch(ENDERECO, {
      signal: AbortSignal.timeout(LIMITE_MS),
      headers: { accept: "application/json" },
    });
    if (!resposta.ok) return null;

    const corpo: unknown = await resposta.json();
    if (!Array.isArray(corpo) || corpo.length === 0) return null;

    const linha = corpo[0] as LinhaDoSgs;
    const valor = Number(linha.valor);
    if (!Number.isFinite(valor)) return null;

    const taxa: TaxaDeReferencia = {
      nome: "Meta Selic",
      valor,
      vigenteDesde: comoIso(String(linha.data ?? "")),
      fonte: "Banco Central do Brasil · SGS série 432",
    };
    cache = { taxa, lidaEm: agora };
    return taxa;
  } catch {
    // Rede fora, timeout, JSON quebrado: todos significam a mesma coisa para
    // quem chama, que é seguir sem a comparação.
    return null;
  }
}

/** Só para teste: esquece a taxa em cache. */
export function esquecerSelic(): void {
  cache = null;
}
