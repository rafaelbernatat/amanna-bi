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
