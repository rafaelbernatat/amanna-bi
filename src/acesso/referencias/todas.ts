/**
 * As três referências de uma vez, para o estágio 2 do chat.
 *
 * Em paralelo, porque são três idas à mesma API e a pergunta espera pela mais
 * lenta, não pela soma. A que falhar fica de fora, e a resposta diz por quê.
 */

import { lerCdi } from "@/acesso/referencias/cdi";
import { lerIpca12m } from "@/acesso/referencias/ipca";
import { lerSelic } from "@/acesso/referencias/selic";
import type { TaxaDeReferencia } from "@/acesso/referencias/sgs";

/** Selic, CDI e IPCA, na ordem, sem as que o BCB não devolveu. */
export async function lerReferencias(): Promise<readonly TaxaDeReferencia[]> {
  const lidas = await Promise.all([lerSelic(), lerCdi(), lerIpca12m()]);
  return lidas.filter((t): t is TaxaDeReferencia => t !== null);
}
