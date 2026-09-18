import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { lerCoresAplicadas } from "@/marca/tela";

import { lerVisitante } from "@/acesso/leitura";
import { Chat } from "@/apresentacao/chat/Chat";
import { PALETA } from "@/apresentacao/tema/tema";
import { ROTA_DA_CONVERSA } from "@/semantica/url";

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
export default async function LayoutDoPainel({
  children,
}: Readonly<{ children: ReactNode }>) {
  /*
   * As cores da marca descem ate o grafico dentro da conversa.
   *
   * Por propriedade, e nao por `var()`: o chat e componente de cliente e o
   * SVG nao resolve propriedade CSS (ver `DesenhoDePainel`).
   */
  const [cores, visitante] = await Promise.all([
    lerCoresAplicadas(),
    lerVisitante(),
  ]);

  /*
   * O publico do QR fica no chat (D-CONVIDADO-cadastro, T-429). O proxy ja
   * redireciona, mas o proxy nao e o controle: o prefetch o pula, e no arnes
   * `fixtures` ele segue tudo. Esta e a conferencia que vale.
   */
  if (visitante !== null) redirect(ROTA_DA_CONVERSA);

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
      <Chat cores={cores} />
    </div>
  );
}
