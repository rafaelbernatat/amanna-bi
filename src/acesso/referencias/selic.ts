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
 * pública, decidida pelo Copom. Fica na camada de acesso como o que é: uma
 * **referência externa**, com origem e data declaradas.
 *
 * ## A saída de rede é decisão registrada
 *
 * A decisão de ler o BCB é de Produto, de 2026-08-30, e está em
 * `docs/decisoes/D-CHAT-openrouter.md` junto com a do gateway. O motor da
 * leitura — cache, tempo limite, `null` na falha — mora em `sgs.ts` e é o
 * mesmo do CDI e do IPCA.
 */

import {
  esquecerSeries,
  lerSerieDoSgs,
  type SerieDoSgs,
  type TaxaDeReferencia,
} from "@/acesso/referencias/sgs";

export type { TaxaDeReferencia } from "@/acesso/referencias/sgs";

/** A série 432 do SGS: meta Selic definida pelo Copom, em % ao ano. */
const META_SELIC: SerieDoSgs = {
  id: "selic",
  serie: 432,
  nome: "Meta Selic",
  periodicidade: "ao ano",
};

/** A meta Selic vigente, ou `null` se o BCB não respondeu. */
export function lerSelic(): Promise<TaxaDeReferencia | null> {
  return lerSerieDoSgs(META_SELIC);
}

/** Só para teste: esquece a taxa em cache. */
export function esquecerSelic(): void {
  esquecerSeries();
}
