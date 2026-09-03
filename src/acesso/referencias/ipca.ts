/**
 * O IPCA acumulado em 12 meses, lido do Banco Central.
 *
 * É o que transforma retorno nominal em ganho de poder de compra: "descontando
 * a inflação de 4,4%, o ganho real dos sócios foi de 3,7%". A série 13522 do
 * SGS é o IPCA acumulado nos últimos 12 meses, em %, com a data do mês de
 * referência do IBGE.
 */

import {
  lerSerieDoSgs,
  type SerieDoSgs,
  type TaxaDeReferencia,
} from "@/acesso/referencias/sgs";

const IPCA_12_MESES: SerieDoSgs = {
  id: "ipca_12m",
  serie: 13522,
  nome: "IPCA 12 meses",
  periodicidade: "acumulado em 12 meses",
};

/** O IPCA acumulado em 12 meses, ou `null` se o BCB não respondeu. */
export function lerIpca12m(): Promise<TaxaDeReferencia | null> {
  return lerSerieDoSgs(IPCA_12_MESES);
}
