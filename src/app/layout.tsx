import { headers } from "next/headers";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { EstiloDaMarca } from "@/apresentacao/tema/EstiloDaMarca";
import { EstiloDoTema } from "@/apresentacao/tema/EstiloDoTema";
import { ScriptDoTemaDoSistema } from "@/apresentacao/tema/ScriptDoTemaDoSistema";
import { temaEscolhido } from "@/apresentacao/tema/ativo";
import { ATRIBUTO_DO_TEMA, PALETA, TIPOGRAFIA } from "@/apresentacao/tema/tema";
import { lerMarcaAtiva } from "@/marca/leitura";

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
export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  /*
   * A marca da instalacao, uma vez por requisicao.
   *
   * `lerMarcaAtiva` e memorizada pelo `cache` do React, entao o cabecalho le
   * a mesma coisa sem uma segunda ida ao armazem. O nonce vem do cabecalho da
   * requisicao, posto pelo proxy — hoje `style-src` tem `unsafe-inline`
   * e ele nao seria necessario, mas quando H-46 for pago esta folha precisa
   * continuar saindo assinada.
   */
  const [marca, cabecalhos] = await Promise.all([lerMarcaAtiva(), headers()]);
  const nonce = cabecalhos.get("x-nonce");
  const tema = await temaEscolhido();

  return (
    /*
     * O atributo carrega a escolha da pessoa, e so quando ela escolheu.
     *
     * Sem escolha nao se emite nada, e vale a preferencia do sistema
     * operacional — que e o que a maioria quer sem pedir. Emitir "claro" para
     * quem nunca escolheu forcaria o claro e anularia isso. Com escolha, o
     * seletor por atributo vence a consulta de midia, e por isso ele vem
     * depois na folha que `EstiloDoTema` emite.
     *
     * O nome do atributo e o valor vem de `tema.ts`, os mesmos que a folha
     * usa (T-418): escritos a mao aqui e la, os dois divergiram uma vez e o
     * botao de tema passou a nao fazer nada.
     */
    <html lang="pt-BR" {...(tema === null ? {} : { [ATRIBUTO_DO_TEMA]: tema })}>
      <head>
        {/*
          O tema vem antes da marca: a marca vence o tema, e em CSS quem
          vence e a cadeia de var(), nao a ordem da folha — mas ler nesta
          ordem conta a historia certa.
        */}
        <EstiloDoTema {...(nonce === null ? {} : { nonce })} />
        <ScriptDoTemaDoSistema {...(nonce === null ? {} : { nonce })} />
        <EstiloDaMarca
          cores={marca?.cores ?? null}
          {...(nonce === null ? {} : { nonce })}
        />
      </head>
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
