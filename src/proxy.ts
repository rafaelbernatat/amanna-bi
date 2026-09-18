/**
 * Os cabeçalhos de segurança de toda resposta (T-139) e a negação cedo de
 * quem chega sem convite (D-CONVITE-apresentacao).
 *
 * Os cabeçalhos moram aqui, e não em `next.config`, por causa do *nonce*: um
 * valor por resposta não sai de configuração estática. Ele viaja em dois
 * lugares — no cabeçalho da requisição, para o Next injetá-lo nos seus
 * próprios scripts, e na CSP da resposta, para o navegador só executar quem o
 * traz.
 *
 * ## A negação não é o controle
 *
 * O matcher pula requisições de prefetch, e por isso o proxy **não pode**
 * ser a única verificação de sessão: quem verifica a cada leitura é o provedor
 * (`src/acesso/convite.ts`). O que acontece aqui é poupar render e pôr a tela
 * certa na frente de quem chegou sem o QR. Em modo `fixtures` e `oidc` nada é
 * negado — o arnês de ponta a ponta continua como sempre.
 */

import { NextResponse, type NextRequest } from "next/server";

import {
  CABECALHOS_FIXOS,
  montarCsp,
  gerarNonce,
} from "@/seguranca/cabecalhos";
import {
  decidirAcesso,
  decidirEntrada,
  NOME_DO_COOKIE,
  PARAMETRO_DE_DESTINO,
  PARAMETRO_DE_MOTIVO,
  PARAMETRO_DO_CONVITE,
} from "@/seguranca/convite";

/** O caminho onde se entra com o token do QR. */
const ENTRADA = "/entrar";

/** Segundos desde a época, como os envelopes os contam. */
function agoraEmSegundos(): number {
  return Math.floor(Date.now() / 1000);
}

/** Todo caminho de saída leva os mesmos cabeçalhos. */
function comCabecalhos(resposta: NextResponse, csp: string): NextResponse {
  for (const [nome, valor] of Object.entries(CABECALHOS_FIXOS)) {
    resposta.headers.set(nome, valor);
  }
  resposta.headers.set("Content-Security-Policy", csp);
  return resposta;
}

export async function proxy(requisicao: NextRequest) {
  const nonce = gerarNonce();
  const csp = montarCsp(nonce);
  const url = requisicao.nextUrl;

  /*
   * A entrada pelo QR.
   *
   * O token vem na URL, e a URL fica no histórico do navegador e no cabeçalho
   * de referência. Por isso a resposta é um redirecionamento **sem o token**:
   * o que sobra na barra é o destino, e o acesso passa a viver no cookie.
   */
  if (url.pathname === ENTRADA && url.searchParams.has(PARAMETRO_DO_CONVITE)) {
    const decidida = await decidirEntrada({
      token: url.searchParams.get(PARAMETRO_DO_CONVITE),
      ir: url.searchParams.get(PARAMETRO_DE_DESTINO),
      ambiente: process.env,
      agoraSegundos: agoraEmSegundos(),
    });

    if (decidida.tipo === "recusar") {
      const destino = new URL(ENTRADA, url);
      destino.searchParams.set(PARAMETRO_DE_MOTIVO, decidida.motivo);
      return comCabecalhos(NextResponse.redirect(destino, 303), csp);
    }

    const resposta = NextResponse.redirect(new URL(decidida.destino, url), 303);
    resposta.cookies.set({
      name: NOME_DO_COOKIE,
      value: decidida.cookie,
      httpOnly: true,
      sameSite: "lax",
      secure: url.protocol === "https:",
      path: "/",
      maxAge: decidida.maxAge,
    });
    return comCabecalhos(resposta, csp);
  }

  const acesso = await decidirAcesso({
    caminho: url.pathname,
    busca: url.searchParams.toString(),
    cookie: requisicao.cookies.get(NOME_DO_COOKIE)?.value ?? null,
    ambiente: process.env,
    agoraSegundos: agoraEmSegundos(),
  });

  if (acesso.tipo === "negar") {
    return comCabecalhos(
      NextResponse.json({ erro: "sessão ausente ou vencida" }, { status: 401 }),
      csp,
    );
  }
  if (acesso.tipo === "redirecionar") {
    return comCabecalhos(
      NextResponse.redirect(new URL(acesso.para, url), 303),
      csp,
    );
  }

  /*
   * O Next injeta o nonce nos seus proprios scripts lendo a CSP **da
   * requisicao** — nao um cabecalho proprio. Descobrimos empiricamente: com
   * so um `x-nonce`, a politica bloqueava os chunks do proprio framework e a
   * tela subia sem JavaScript nenhum.
   */
  const paraONext = new Headers(requisicao.headers);
  paraONext.set("Content-Security-Policy", csp);
  paraONext.set("x-nonce", nonce);

  return comCabecalhos(
    NextResponse.next({ request: { headers: paraONext } }),
    csp,
  );
}

export const config = {
  /*
   * Fora os artefatos estáticos, e fora o logo da marca.
   *
   * `_next/static` e as imagens já saem com cache imutável e não executam
   * nada; passá-los pelo proxy custaria uma invocação por arquivo sem
   * fechar superfície nenhuma.
   *
   * `api/marca/logo` sai por outra razão, e ela é de segurança: aquela rota
   * serve **bytes de terceiro**, e por isso declara uma política própria e
   * mais dura que a do produto — `default-src 'none'; sandbox`, que não
   * permite nada. Como o proxy escreve a política do site em toda
   * resposta que atravessa, passar por aqui **afrouxaria** a política daquele
   * arquivo em vez de endurecê-la. A rota manda os próprios cabeçalhos,
   * `nosniff` incluído.
   */
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|api/marca/logo).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
