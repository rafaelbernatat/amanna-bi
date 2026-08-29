/**
 * A ordem em que as cores da paleta entram num painel de varias partes.
 *
 * ## Por que um arquivo, e nao mais chaves na paleta
 *
 * `PALETA` tem 24 chaves e cada uma nomeia um **papel** — `positivo` e o
 * sentido do numero, `comparacao` e a serie de referencia. Uma rosca de cinco
 * fatias nao precisa de cinco papeis novos: precisa de cinco cores que se
 * distingam, na mesma ordem toda vez. Acrescentar `fatia1`..`fatia5` a paleta
 * inventaria papel onde ha so ordem, e o teste de T-124 conta 24 chaves de
 * proposito.
 *
 * Aqui nao ha cor nova: a sequencia e uma **leitura** da paleta. Trocar um
 * token no tema troca a rosca junto, que e o que T-124 queria dizer com "cor e
 * decisao de tema".
 *
 * ## Por que a ordem e esta
 *
 * As quatro primeiras sao as da marca, que e como o prototipo pinta as partes
 * de um todo (a rampa `b1..b5` de `mkDonut` e `mkFunnel`). Depois vem as de
 * sentido, que so aparecem quando ha mais partes que cores de marca — e nesse
 * ponto a distincao entre fatias ja importa mais que a leitura de sentido.
 *
 * Cor nunca e o unico sinal (PRD secao 13): todo painel que usa esta sequencia
 * traz rotulo ou legenda ao lado da cor.
 */

import { PALETA } from "@/apresentacao/tema/tema";
import type { Sentido } from "@/semantica/contrato";

/** A rampa categorica, na ordem de uso. */
export const SEQUENCIA_CATEGORICA: readonly string[] = [
  PALETA.marca,
  PALETA.destaque,
  PALETA.comparacao,
  PALETA.destaqueSuave,
  PALETA.marcaEscura,
  PALETA.positivo,
  PALETA.neutro,
  PALETA.meta,
];

/**
 * A cor da n-esima parte.
 *
 * Da a volta quando as partes passam de oito. Repetir cor e pior que inventar
 * uma: a repeticao e visivel e o rotulo ao lado desfaz a duvida, enquanto uma
 * cor fora da paleta quebraria a regra de T-124 sem ninguem notar.
 */
export function corDaCategoria(indice: number): string {
  const cor = SEQUENCIA_CATEGORICA[indice % SEQUENCIA_CATEGORICA.length];
  return cor ?? PALETA.marca;
}

/**
 * A cor do sentido de uma medida (secao 13).
 *
 * `neutro` nao e ausencia de decisao: e a decisao de que subir nao e nem bom
 * nem ruim para aquela medida — headcount, por exemplo.
 */
export const COR_DO_SENTIDO: Readonly<Record<Sentido, string>> = {
  maior_melhor: PALETA.positivo,
  menor_melhor: PALETA.negativo,
  neutro: PALETA.texto,
};
