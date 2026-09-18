import {
  LARGURA_DO_MENU_RECOLHIDO,
  LARGURA_MINIMA_PARA_MENU_ABERTO,
} from "@/apresentacao/navegacao/menu";

/** O nome do conteiner que envolve menu e tela, para a consulta de conteiner. */
export const CONTEINER_DA_TELA = "quadro-da-tela";

/**
 * A unica regra que estilo em linha nao escreve: o menu recolhe quando a tela
 * nao tem largura para ele (T-421).
 *
 * Consulta de **conteiner**, e nao de viewport: e a coluna da tela que
 * encolhe quando a conversa abre ao lado, e uma consulta de viewport nao a
 * enxergaria. Nenhum JavaScript mede nada — o teste de arquitetura proibe
 * `offsetWidth` e companhia na apresentacao, e o CSS resolve sem eles.
 *
 * `!important` em cada declaracao, porque tudo o que esta folha vence e
 * estilo em linha — largura, `display`, alinhamento —, e estilo em linha
 * ganha de folha sem isso. Sob a consulta, os titulos, o nome do modulo e o
 * botao somem, e ficam os icones das telas, clicaveis (T-442): expandir num
 * espaco que nao cabe seria um botao que nao faz nada.
 */
export function EstiloDoMenu({ nonce }: { readonly nonce?: string }) {
  const menu = '[data-teste="menu-lateral"]';
  const folha =
    `@container ${CONTEINER_DA_TELA} (max-width: ${String(LARGURA_MINIMA_PARA_MENU_ABERTO - 1)}px){` +
    `${menu}{width:${String(LARGURA_DO_MENU_RECOLHIDO)}px !important}` +
    `${menu} [data-parte="titulo"],${menu} [data-parte="modulo"],${menu} [data-teste="recolher-menu"]{display:none !important}` +
    `${menu} [data-parte="topo"]{justify-content:center !important;padding:14px 0 6px !important}` +
    `${menu} [data-parte="telas"]{padding:0 4px 12px !important}` +
    `${menu} [data-parte="telas"] a{justify-content:center !important;padding:9px 0 !important;border-left-color:transparent !important}` +
    "}";

  return (
    <style
      data-teste="estilo-do-menu"
      {...(nonce === undefined ? {} : { nonce })}
    >
      {folha}
    </style>
  );
}
