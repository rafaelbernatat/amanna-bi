import type { CoresDaMarca } from "@/apresentacao/tema/tema";

/**
 * Como cada papel de marca se chama para quem lê, e o que ele faz na tela.
 *
 * Um lugar só, porque dois componentes o usam: a proposta (que mostra as
 * cores escolhidas) e o formulário manual (que pede cada uma). Se o nome do
 * papel fosse escrito duas vezes, um dia a proposta diria "Ação" e o
 * formulário "Principal", e a pessoa não saberia que é a mesma cor.
 */
export const NOME_DO_PAPEL: Readonly<Record<keyof CoresDaMarca, string>> = {
  marca: "Ação",
  marcaEscura: "Ação escura",
  destaque: "Destaque",
  destaqueSuave: "Destaque suave",
  barraLateral: "Barra escura",
};

/** O que cada papel faz na tela, em uma linha. */
export const PARA_QUE_SERVE: Readonly<Record<keyof CoresDaMarca, string>> = {
  marca: "Botões, links e o que se clica",
  marcaEscura: "Estado pressionado e texto sobre fundo claro",
  destaque: "O contorno do gráfico que a IA citou",
  destaqueSuave: "Apoio do destaque, em bordas e faixas",
  barraLateral: "Fundo escuro das abas e do chat",
};
