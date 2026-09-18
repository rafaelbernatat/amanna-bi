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
 * O preço está escrito: numa primeira visita, com o sistema em escuro e sem
 * cookie, a moldura abre escura e os gráficos saem com a pele clara até a
 * pessoa escolher. É feio por um instante e não é errado — e a alternativa,
 * adivinhar o tema no cliente e repintar, custaria a segunda pintura que T-129
 * zerou.
 */

/** O nome do cookie que guarda a escolha. */
export const NOME_DO_COOKIE_DE_TEMA = "amanna-bi.tema";

/** Quanto a escolha dura: um ano, como qualquer preferência de leitura. */
export const DURACAO_DO_TEMA = 60 * 60 * 24 * 365;

/**
 * O tema que a pessoa escolheu, ou `null` quando ela nunca escolheu.
 *
 * A diferenca importa no `<html>`: emitir `data-theme="claro"` para quem nao
 * escolheu **forcaria** o claro e anularia o `prefers-color-scheme`, que e o
 * comportamento que a maioria quer sem pedir.
 */
export async function temaEscolhido(): Promise<Tema | null> {
  const bruto = (await cookies()).get(NOME_DO_COOKIE_DE_TEMA)?.value;
  return bruto !== undefined && temaValido(bruto) ? bruto : null;
}

/** O tema para o que o servidor precisa resolver; `claro` sem escolha. */
export async function temaAtivo(): Promise<Tema> {
  const bruto = (await cookies()).get(NOME_DO_COOKIE_DE_TEMA)?.value;
  return bruto !== undefined && temaValido(bruto) ? bruto : "claro";
}

/** A pele literal desta requisição, para o gráfico. */
export async function peleAtiva(): Promise<
  Readonly<Record<ChaveDePaletaClara, string>>
> {
  return paletaDoTema(await temaAtivo());
}
