import { cookies } from "next/headers";

import {
  paletaDoTema,
  temaValido,
  type ChaveDePaletaClara,
  type Tema,
} from "@/apresentacao/tema/tema";

/**
 * O tema desta requisição, para o que o servidor precisa resolver (T-372).
 *
 * ## Por que existe um cookie, se o CSS já sabe o tema
 *
 * A moldura não precisa disto: ela troca sozinha pelas propriedades que
 * `EstiloDoTema` emite, seguindo o sistema operacional. O **gráfico** precisa,
 * e a razão é a de sempre — `var()` não pinta atributo de SVG, então a cor tem
 * de sair do servidor já resolvida, e o servidor não enxerga
 * `prefers-color-scheme`.
 *
 * ## Dois cookies, com sentidos diferentes (T-422)
 *
 * O primeiro é a **escolha** da pessoa, gravada pelo botão. O segundo é o que
 * o sistema dela **pede**, observado por um script de três linhas a cada
 * página. Escolha vence observação; observação vence o claro de recuo.
 *
 * Não se grava a observação no cookie de escolha, e a razão é de sentido: um
 * sistema que escurece à noite deixaria de ser seguido no dia seguinte, preso
 * numa escolha que a pessoa nunca fez. Separados, a moldura continua
 * seguindo o sistema por CSS, e o gráfico passa a segui-lo a partir da segunda
 * tela — a primeira ainda sai clara, porque nenhum servidor enxerga a
 * preferência antes de o navegador contá-la.
 */

/** O nome do cookie que guarda a escolha. */
export const NOME_DO_COOKIE_DE_TEMA = "amanna-bi.tema";

/** O nome do cookie que guarda o que o sistema pede, observado no navegador. */
export const NOME_DO_COOKIE_DO_TEMA_DO_SISTEMA = "amanna-bi.tema-do-sistema";

/** Quanto a escolha dura: um ano, como qualquer preferência de leitura. */
export const DURACAO_DO_TEMA = 60 * 60 * 24 * 365;

async function lerCookieDeTema(nome: string): Promise<Tema | null> {
  const bruto = (await cookies()).get(nome)?.value;
  return bruto !== undefined && temaValido(bruto) ? bruto : null;
}

/**
 * O tema que a pessoa escolheu, ou `null` quando ela nunca escolheu.
 *
 * A diferenca importa no `<html>`: emitir o atributo para quem nao escolheu
 * **forcaria** um tema e anularia o `prefers-color-scheme`, que e o
 * comportamento que a maioria quer sem pedir.
 */
export function temaEscolhido(): Promise<Tema | null> {
  return lerCookieDeTema(NOME_DO_COOKIE_DE_TEMA);
}

/** O que o sistema da pessoa pede, quando o navegador ja contou. */
export function temaObservado(): Promise<Tema | null> {
  return lerCookieDeTema(NOME_DO_COOKIE_DO_TEMA_DO_SISTEMA);
}

/**
 * O tema para o que o servidor precisa resolver.
 *
 * Escolha, depois observacao do sistema, depois claro — nesta ordem.
 */
export async function temaAtivo(): Promise<Tema> {
  return (await temaEscolhido()) ?? (await temaObservado()) ?? "claro";
}

/** A pele literal desta requisição, para o gráfico. */
export async function peleAtiva(): Promise<
  Readonly<Record<ChaveDePaletaClara, string>>
> {
  return paletaDoTema(await temaAtivo());
}
