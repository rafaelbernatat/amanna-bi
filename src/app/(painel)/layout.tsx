import type { ReactNode } from "react";

import { Chat } from "@/apresentacao/chat/Chat";
import { PALETA } from "@/apresentacao/tema/tema";

/**
 * O quadro das 13 telas: a tela à esquerda, a conversa à direita.
 *
 * ## Por que um grupo de rota, e por que o chat mora aqui
 *
 * Um layout **preserva estado e não é remontado** quando a navegação troca de
 * página por baixo dele (documentação do Next desta versão). O chat responde
 * levando a pessoa a outra tela, e a conversa precisa continuar lá — então o
 * componente fica num layout acima de `[modulo]/[tela]`, e não na página.
 *
 * O grupo `(painel)` não muda URL nenhuma: `/rh/visao` continua `/rh/visao`.
 * Ele existe para que este layout envolva só as telas do produto. A galeria
 * de verificação e a página de 404 ficam de fora, e sem conversa.
 *
 * ## A conversa encosta, não sobrepõe
 *
 * Aberta, ela é uma coluna própria e a tela encolhe para caber ao lado. Uma
 * sobreposição cobriria o painel que a resposta acabou de destacar — o gráfico
 * ficaria atrás da conversa que fala dele.
 */
export default function LayoutDoPainel({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <div
      data-teste="quadro"
      style={{
        display: "flex",
        height: "100vh",
        overflow: "hidden",
        background: PALETA.fundo,
      }}
    >
      <div
        style={{
          flex: "1 1 auto",
          minWidth: 0,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {children}
      </div>
      <Chat />
    </div>
  );
}
