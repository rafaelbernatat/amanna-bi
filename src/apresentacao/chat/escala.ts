/**
 * Quanto a tipografia da conversa cresce no celular (T-370).
 *
 * A escala da conversa foi desenhada para a coluna de 392 px ao lado do
 * painel, lida a meio metro de distância. No celular a largura é quase a
 * mesma, mas a distância de leitura é maior e a tela é menor — e ali 9,5 px
 * viram um texto que ninguém lê numa plateia. Um quarto a mais resolve sem
 * refazer o desenho, e sem tocar o modo coluna, onde a escala continua a de
 * sempre.
 *
 * Um número, e não uma folha de estilo: os tamanhos moram em objetos de estilo
 * em linha (T-124), e um `!important` para vencê-los seria pior. Mora num
 * módulo próprio porque o convite da Dreamy o lê também.
 */
export const ESCALA_NO_CELULAR = 1.28;

/** O tamanho de fonte daquele papel, no modo em que o chat está. */
export function px(base: number, cheio: boolean): string {
  return `${cheio ? Math.round(base * ESCALA_NO_CELULAR * 10) / 10 : base}px`;
}
