/**
 * O CDI, lido do Banco Central.
 *
 * É a régua das perguntas de CFO: "o capital dos sócios rende X p.p. abaixo do
 * que renderia numa aplicação sem risco". A série 4389 do SGS é a taxa DI
 * anualizada na base de 252 dias úteis, em % ao ano — a que um CDB "100% do
 * CDI" paga bruto.
 */

import {
  lerSerieDoSgs,
  type SerieDoSgs,
  type TaxaDeReferencia,
} from "@/acesso/referencias/sgs";

const CDI: SerieDoSgs = {
  id: "cdi",
  serie: 4389,
  nome: "CDI",
  periodicidade: "ao ano",
};

/** O CDI vigente, ou `null` se o BCB não respondeu. */
export function lerCdi(): Promise<TaxaDeReferencia | null> {
  return lerSerieDoSgs(CDI);
}
