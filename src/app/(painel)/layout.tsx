import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { lerCoresAplicadas } from "@/marca/tela";

import { lerVisitante } from "@/acesso/leitura";
import { Chat } from "@/apresentacao/chat/Chat";
import {
  CONTEINER_DA_TELA,
  EstiloDoMenu,
} from "@/apresentacao/navegacao/EstiloDoMenu";
import { estadoDoMenu } from "@/apresentacao/navegacao/menu-ativo";
import { MenuLateral } from "@/apresentacao/navegacao/MenuLateral";
import { PALETA } from "@/apresentacao/tema/tema";
import { ROTA_DA_CONVERSA } from "@/semantica/url";

/**
 * O quadro das 13 telas: o menu de telas a esquerda, a tela no meio, a
 * conversa a direita.
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
 * ## O menu lateral, e o conteiner que o recolhe (T-421)
 *
 * As telas do modulo ativo moram num menu a esquerda, que recolhe a uma faixa
 * fina e lembra a escolha num cookie — lido **aqui**, no servidor, para o
 * primeiro quadro ja sair com a largura certa. Menu e tela ficam num
 * conteiner de CSS: quando a conversa abre ao lado e a coluna fica estreita
 * demais para os dois, uma consulta de conteiner recolhe o menu sem que
 * nenhum JavaScript meca coisa alguma (`EstiloDoMenu`).
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
  const [cores, visitante, menu, cabecalhos] = await Promise.all([
    lerCoresAplicadas(),
    lerVisitante(),
    estadoDoMenu(),
    headers(),
  ]);

  /*
   * O publico do QR fica no chat (D-CONVIDADO-cadastro, T-429). O proxy ja
   * redireciona, mas o proxy nao e o controle: o prefetch o pula, e no arnes
   * `fixtures` ele segue tudo. Esta e a conferencia que vale.
   */
  if (visitante !== null) redirect(ROTA_DA_CONVERSA);

  // A folha do menu leva o nonce da resposta, como a do tema.
  const nonce = cabecalhos.get("x-nonce");

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
      <EstiloDoMenu {...(nonce === null ? {} : { nonce })} />
      <div
        data-teste="quadro-da-tela"
        style={{
          flex: "1 1 auto",
          minWidth: 0,
          minHeight: 0,
          display: "flex",
          overflow: "hidden",
          containerType: "inline-size",
          containerName: CONTEINER_DA_TELA,
        }}
      >
        <MenuLateral recolhidoInicial={menu === "recolhido"} />
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
      </div>
      <Chat cores={cores} />
    </div>
  );
}
