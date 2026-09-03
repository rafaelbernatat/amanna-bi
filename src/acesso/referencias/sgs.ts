/**
 * As séries do SGS do Banco Central que o chat usa como régua.
 *
 * A Selic entrou primeiro, por decisão de Produto de 2026-08-30 (D-CHAT). CDI e
 * IPCA entram pela mesma porta e pela mesma disciplina, para as perguntas de
 * CFO: "o ROE de 8,3% rende menos que o CDI de 13,9%; descontada a inflação de
 * 4,4%, o ganho real é de 3,7%". Nenhuma das três é métrica da empresa, e por
 * isso nenhuma está no catálogo — são **referências externas**, com fonte e
 * vigência declaradas na resposta.
 *
 * ## O que sai do ambiente
 *
 * Um GET sem corpo e sem cabeçalho de identificação, para uma série pública.
 * Nada do cliente atravessa. A saída de rede está registrada em
 * docs/decisoes/D-CHAT-openrouter.md.
 *
 * ## Falhar aqui não derruba a resposta
 *
 * Série que não responde vira `null`, e quem chama segue sem ela: o chat
 * responde sem a comparação e diz por quê. Trocar uma resposta boa por nenhuma,
 * porque um dado de contexto não veio, seria o pior dos dois mundos.
 */

export const REFERENCIAS = ["selic", "cdi", "ipca_12m"] as const;
export type IdDeReferencia = (typeof REFERENCIAS)[number];

/** Uma série do SGS que o produto lê, com o nome que o texto usa. */
export type SerieDoSgs = {
  readonly id: IdDeReferencia;
  readonly serie: number;
  readonly nome: string;
  /** Como a taxa se lê em voz alta. Vai para o texto e para o modelo. */
  readonly periodicidade: "ao ano" | "acumulado em 12 meses";
};

/** A taxa, com de onde veio e de quando é. */
export type TaxaDeReferencia = {
  readonly id: IdDeReferencia;
  readonly nome: string;
  /** Em %. */
  readonly valor: number;
  readonly periodicidade: SerieDoSgs["periodicidade"];
  /** A data a que a taxa se refere, em ISO. */
  readonly vigenteDesde: string;
  readonly fonte: string;
};

/** Quanto se espera pelo BCB antes de desistir e responder sem a taxa. */
const LIMITE_MS = 4000;

/**
 * Por quanto tempo a taxa lida vale.
 *
 * O Copom se reúne a cada 45 dias, o CDI muda por dia útil e o IPCA por mês;
 * uma hora de cache é folga sobre todos, e evita uma ida à rede por pergunta.
 */
const VALIDADE_MS = 60 * 60 * 1000;

type Guardada = { readonly taxa: TaxaDeReferencia; readonly lidaEm: number };
const cache = new Map<number, Guardada>();

/** Uma linha do SGS: `{ "data": "16/09/2026", "valor": "14.00" }`. */
type LinhaDoSgs = { readonly data?: unknown; readonly valor?: unknown };

function enderecoDa(serie: number): string {
  return `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${String(serie)}/dados/ultimos/1?formato=json`;
}

/** `16/09/2026` vira `2026-09-16`. O SGS responde em pt-BR. */
function comoIso(data: string): string {
  const partes = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(data);
  if (partes === null) return data;
  return `${String(partes[3])}-${String(partes[2])}-${String(partes[1])}`;
}

/**
 * A última observação da série, ou `null` se o BCB não respondeu.
 *
 * Devolve `null` em vez de lançar porque quem chama precisa seguir sem ela. A
 * ausência é informação — o chat escreve "não consegui a taxa agora" — e não
 * um erro que derruba a resposta inteira.
 */
export async function lerSerieDoSgs(
  definicao: SerieDoSgs,
): Promise<TaxaDeReferencia | null> {
  const agora = Date.now();
  const guardada = cache.get(definicao.serie);
  if (guardada !== undefined && agora - guardada.lidaEm < VALIDADE_MS) {
    return guardada.taxa;
  }

  try {
    const resposta = await fetch(enderecoDa(definicao.serie), {
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
      id: definicao.id,
      nome: definicao.nome,
      valor,
      periodicidade: definicao.periodicidade,
      vigenteDesde: comoIso(String(linha.data ?? "")),
      fonte: `Banco Central do Brasil · SGS série ${String(definicao.serie)}`,
    };
    cache.set(definicao.serie, { taxa, lidaEm: agora });
    return taxa;
  } catch {
    // Rede fora, timeout, JSON quebrado: todos significam a mesma coisa para
    // quem chama, que é seguir sem a taxa.
    return null;
  }
}

/** Só para teste: esquece todas as séries em cache. */
export function esquecerSeries(): void {
  cache.clear();
}
