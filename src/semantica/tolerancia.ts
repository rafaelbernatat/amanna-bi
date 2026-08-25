/**
 * A tolerância da suíte de contrato, por unidade (T-121).
 *
 * ## O que uma tolerância é para
 *
 * A suíte compara dois caminhos que deveriam dar o mesmo número — o KPI e o
 * painel que o detalha, a fixture e o warehouse. Exigir igualdade binária faria
 * a suíte reprovar por resto de divisão em ponto flutuante, e a resposta a isso
 * costuma ser afrouxar até parar de doer. Uma tolerância escrita, com critério,
 * evita as duas coisas.
 *
 * ## O critério
 *
 * **Metade do último dígito que a tela mostra.**
 *
 * A pergunta que a suíte responde é "estes dois números são o mesmo?", e o que
 * torna a diferença um problema é ela **aparecer**. Se o produto exibe `R$ 12,4
 * mi`, uma divergência de 0,04 mi é invisível: os dois caminhos escrevem a
 * mesma coisa na tela. Uma de 0,06 mi não é — um lado escreve 12,4 e o outro
 * 12,5, e alguém numa reunião vai perguntar qual está certo.
 *
 * Então a tolerância é exatamente o ponto em que a diferença deixa de ser
 * invisível: metade do incremento exibido. Nem mais, que deixaria passar
 * divergência que aparece; nem menos, que reprovaria por ruído de ponto
 * flutuante.
 *
 * ## Por que não é derivada de `CASAS`
 *
 * As casas decimais moram em `src/apresentacao/formato/formato.ts`, e a camada
 * de contrato não importa da apresentação — o contrato existe justamente para
 * não depender de quem desenha. Os números estão escritos aqui, e um **teste**
 * confere que nenhum deles é maior que metade do incremento exibido. A
 * verificação acontece onde as duas camadas podem se encontrar sem que uma
 * dependa da outra.
 */

import { UNIDADES, type Unidade } from "@/semantica/contrato";

/**
 * Quanto dois caminhos podem divergir sem que a suíte reprove.
 *
 * Zero em `contagem`: contar não tem meio-termo. Uma vaga a mais é uma vaga a
 * mais, e a divergência de uma unidade numa contagem é sempre defeito — nunca
 * arredondamento.
 */
export const TOLERANCIA: Readonly<Record<Unidade, number>> = {
  /** Exibido com uma casa: `R$ 12,4 mi`. */
  BRL_mi: 0.05,
  /** Exibido com uma casa: `12,1%`. */
  pct: 0.05,
  /** Exibido com uma casa: `+4,4 p.p.`. */
  pp: 0.05,
  /** Exibido inteiro: `52 dias`. */
  dias: 0.5,
  /** Exibido inteiro: `1.240 FTE`. Fracionário por natureza — meio período. */
  FTE: 0.5,
  /** Exibido com uma casa: `21.400,0 h`. */
  horas: 0.05,
  /** Contar não tem meio-termo. Ver o cabeçalho. */
  contagem: 0,
  /** Exibido inteiro: `28 pontos`. */
  pontos: 0.5,
  /** Exibido com uma casa: `3,1 anos`. */
  anos: 0.05,
};

/** Dois valores são o mesmo número, para a suíte de contrato? */
export function dentroDaTolerancia(
  a: number | null,
  b: number | null,
  unidade: Unidade,
): boolean {
  /*
   * Nulo só é igual a nulo.
   *
   * "Sem dado neste recorte" e "zero" são estados diferentes (princípio PR-4),
   * e tratá-los como equivalentes aqui apagaria justamente a distinção que a
   * regra 3 existe para proteger.
   */
  if (a === null || b === null) return a === b;
  return Math.abs(a - b) <= (TOLERANCIA[unidade] ?? 0);
}

/** As unidades que a tolerância cobre. Serve à conferência de cobertura. */
export function unidadesComTolerancia(): readonly Unidade[] {
  return UNIDADES.filter((u) => u in TOLERANCIA);
}
