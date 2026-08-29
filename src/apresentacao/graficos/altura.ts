/**
 * A altura de desenho de cada uma das doze formas (T-132).
 *
 * ## Por que uma tabela, e não um número em cada chamada
 *
 * O aceite pede que o esqueleto tenha "altura igual à do gráfico final dentro
 * de 4 px". Duas maneiras de conseguir isso: medir e ajustar, ou **ler o mesmo
 * número**. A segunda é a única que continua verdadeira depois que alguém
 * mexer no gráfico.
 *
 * Com a tabela, o esqueleto e o desenho final recebem a altura da mesma linha,
 * e a diferença é zero por construção — não dentro de 4 px, exatamente zero. Os
 * 4 px do aceite viram folga que não se usa, e o teste que os mede vira uma
 * guarda contra alguém voltar a escrever a altura à mão nos dois lugares.
 *
 * ## Por que as alturas diferem entre formas
 *
 * Uma rosca precisa de espaço quadrado para o círculo não achatar; uma régua de
 * ciclo é uma faixa e não precisa de altura nenhuma além do rótulo; um mosaico
 * geográfico carrega a proporção do mapa. Igualar tudo em nome da simetria
 * deixaria metade dos painéis com espaço morto e a outra metade apertada.
 *
 * Os números vêm do protótipo, que é onde o layout foi aprovado. Ele não é
 * editado por este laço (EXECUTE.md) — é lido.
 */

import type { Forma } from "@/semantica/painel";

/**
 * A altura reservada para o desenho, em pixels, sem contar moldura nem fórmula.
 *
 * Tabela total sobre `Forma`: acrescentar uma forma sem decidir a altura dela
 * **para de compilar**. É a mesma disciplina do resto do módulo de painéis —
 * uma forma nova não pode entrar caindo num padrão silencioso.
 */
export const ALTURA_DA_FORMA: Readonly<Record<Forma, number>> = {
  /* As quatro cartesianas dividem a mesma caixa: elas aparecem lado a lado na
   * mesma tela, e alturas diferentes fariam a grade serrilhar. */
  barras: 216,
  linha: 216,
  "barras-horizontais": 216,
  "barras-empilhadas": 216,

  /** Sete a nove degraus empilhados, cada um com rótulo à esquerda. */
  cascata: 216,

  /** Quadrada, para o círculo não achatar. */
  rosca: 200,

  /** Quatro a seis etapas afunilando; mais baixa que a rosca por ser vertical. */
  funil: 200,

  /** Uma barra horizontal repartida, com legenda embaixo. */
  divisao: 96,

  /**
   * Três a cinco números grandes, em uma ou duas fileiras.
   *
   * Eram 120 px, que valiam para a fileira única de um painel largo. Num painel
   * de 4 colunas os mesmos três números não cabem lado a lado — a caixa fica
   * com 93 px e o valor sai cortado, "R$ 0,..." — então ali eles quebram em
   * duas fileiras, e duas fileiras precisam de altura.
   *
   * Quem decide quantas colunas é `DesenhoDePainel`, que conhece o `span`. A
   * altura é a mesma nos dois arranjos de propósito: uma altura por arranjo
   * faria a fileira da grade serrilhar entre um painel de estatísticas e o
   * gráfico ao lado.
   */
  estatisticas: 180,

  /** A proporção do mapa do Brasil, que é mais alto que largo. */
  "mosaico-geografico": 260,

  /** Nuvem de pontos: precisa de área nos dois eixos para não virar linha. */
  dispersao: 216,

  /**
   * Quatro faixas empilhadas mais a linha de marcos.
   *
   * Eram 88 px, estimados em T-132 a partir da descricao "uma faixa com marcas
   * de etapa" — antes de a primitiva existir. Ao desenhar `ct-ciclo` de
   * verdade, sao **quatro** faixas: PMP, PME, PMR e o ciclo sem caixa, que se
   * sobrepoem e por isso ocupam uma linha cada. Com 88 px a linha dos marcos
   * ficava cortada pela metade, e o dia de cada etapa — que e o que a regua
   * existe para mostrar — sumia.
   *
   * O esqueleto le esta mesma linha, entao o CLS continua em zero: a caixa
   * cresceu nos dois lugares ao mesmo tempo.
   */
  "regua-de-ciclo": 116,
};

/** A altura de uma forma. Existe para o esqueleto e o desenho não divergirem. */
export function alturaDaForma(forma: Forma): number {
  return ALTURA_DA_FORMA[forma];
}
