/**
 * Aplica os cabeçalhos de segurança a toda resposta (T-139).
 *
 * Mora no middleware, e não em `next.config`, por causa do *nonce*: um valor
 * por resposta não sai de configuração estática. Ele viaja em dois lugares —
 * no cabeçalho da requisição, para o Next injetá-lo nos seus próprios scripts,
 * e na CSP da resposta, para o navegador só executar quem o traz.
 */

import { NextResponse, type NextRequest } from "next/server";

import {
  CABECALHOS_FIXOS,
  montarCsp,
  gerarNonce,
} from "@/seguranca/cabecalhos";

export function middleware(requisicao: NextRequest) {
  const nonce = gerarNonce();
  const csp = montarCsp(nonce);

  /*
   * O Next injeta o nonce nos seus proprios scripts lendo a CSP **da
   * requisicao** — nao um cabecalho proprio. Descobrimos empiricamente: com
   * so um `x-nonce`, a politica bloqueava os chunks do proprio framework e a
   * tela subia sem JavaScript nenhum.
   */
  const paraONext = new Headers(requisicao.headers);
  paraONext.set("Content-Security-Policy", csp);
  paraONext.set("x-nonce", nonce);

  const resposta = NextResponse.next({
    request: { headers: paraONext },
  });

  for (const [nome, valor] of Object.entries(CABECALHOS_FIXOS)) {
    resposta.headers.set(nome, valor);
  }
  resposta.headers.set("Content-Security-Policy", csp);

  return resposta;
}

export const config = {
  /*
   * Fora os artefatos estáticos.
   *
   * `_next/static` e as imagens já saem com cache imutável e não executam
   * nada; passá-los pelo middleware custaria uma invocação por arquivo sem
   * fechar superfície nenhuma.
   */
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
