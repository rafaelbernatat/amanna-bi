/**
 * O menu lateral de telas: o que e puro e serve ao servidor e ao navegador
 * (D-NAVEGACAO-menu-lateral-e-filtros-vivos, T-421).
 *
 * O estado — aberto ou recolhido — vive num cookie que o **servidor** le antes
 * de pintar: o primeiro quadro ja sai certo, e o deslocamento de layout continua
 * zero. Quem grava o cookie e o navegador, no clique, sem ida ao servidor; o
 * servidor so o le na proxima navegacao.
 *
 * Sem `next/headers` aqui: este modulo e importado pelo componente de cliente.
 * A leitura do cookie fica em `menu-ativo.ts`.
 */

export const NOME_DO_COOKIE_DO_MENU = "amanna-bi.menu";

export const ESTADOS_DO_MENU = ["aberto", "recolhido"] as const;
export type EstadoDoMenu = (typeof ESTADOS_DO_MENU)[number];

export function estadoDoMenuValido(
  candidato: string,
): candidato is EstadoDoMenu {
  return (ESTADOS_DO_MENU as readonly string[]).includes(candidato);
}

/** Quanto a escolha dura: um ano, como o tema. */
export const DURACAO_DO_MENU = 60 * 60 * 24 * 365;

/** A largura do menu aberto, com o nome do modulo e a lista de telas. */
export const LARGURA_DO_MENU_ABERTO = 220;

/** A largura da faixa recolhida: so o botao de abrir. */
export const LARGURA_DO_MENU_RECOLHIDO = 44;

/**
 * Abaixo disto de largura para a tela, o menu recolhe sozinho, por consulta
 * de conteiner em CSS — sem medir nada em JavaScript. E o caso da conversa
 * aberta em 1280 px: a coluna da tela fica com 860, e um cabecalho de tres
 * colunas nao cabe com 220 a menos.
 */
export const LARGURA_MINIMA_PARA_MENU_ABERTO = 900;

/** O cookie que o navegador grava no clique. */
export function cookieDoMenu(estado: EstadoDoMenu, seguro: boolean): string {
  return (
    `${NOME_DO_COOKIE_DO_MENU}=${estado}; path=/; max-age=${String(DURACAO_DO_MENU)}; samesite=lax` +
    (seguro ? "; secure" : "")
  );
}
