import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { PALETA, TIPOGRAFIA } from "@/apresentacao/tema/tema";

export const metadata: Metadata = {
  title: "Painel BI de Controladoria",
  description:
    "Painel executivo de RH e Financeiro com chat de IA que responde com numero, formula e grafico.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

/**
 * O `overflowX: hidden` no `body` e requisito de T-126: o corpo da pagina nunca
 * rola na horizontal. Quem rola e a area de conteudo, e a tira de abas rola
 * dentro de si mesma.
 */
export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          background: PALETA.fundo,
          color: PALETA.texto,
          fontFamily: TIPOGRAFIA.texto,
          overflowX: "hidden",
        }}
      >
        {children}
      </body>
    </html>
  );
}

/**
 * Renderizacao por requisicao em toda rota, e nao pre-renderizada na build
 * (T-139).
 *
 * Medido, nao suposto: a CSP com nonce **so funciona** assim. HTML gerado na
 * build nao tem requisicao, entao nao tem nonce, e o Next nao consegue assinar
 * os proprios scripts. Com pre-renderizacao, a politica bloqueava sete chunks e
 * dois scripts de hidratacao por pagina — a tela subia sem JavaScript e os
 * graficos nao desenhavam. Com renderizacao por requisicao, zero violacoes.
 *
 * A alternativa seria devolver `unsafe-inline` ao `script-src`, e o aceite de
 * T-139 pede o contrario.
 *
 * Fica no layout raiz porque vale para **todas** as rotas: aplicar so na rota
 * de tela deixava `/` e `/verificacao/svg` estaticas, e a CSP as quebrava.
 *
 * Nao e sacrificio. A partir de F2 as telas leem por `Query` e por perfil
 * (secao 11), e conteudo que depende da sessao nunca poderia ser
 * pre-renderizado — isto so chega antes onde o produto ia parar de qualquer
 * jeito. Continua tudo renderizado **no servidor**: nada aqui move trabalho
 * para o cliente nem mexe no CLS medido em T-129.
 */
export const dynamic = "force-dynamic";
