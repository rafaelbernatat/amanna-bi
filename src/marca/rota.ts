/**
 * As duas conferências que toda rota de escrita da marca faz antes de tudo.
 *
 * ## A origem do envio
 *
 * Uma ação de servidor do Next compara a origem com o anfitrião sozinha; uma
 * rota não ganha isso. Como este endereço muda a aparência da instalação
 * inteira, um envio vindo de outro site é falsificação de requisição de
 * verdade — e a política de segurança do produto já declara `form-action
 * 'self'`, o que só vale para o navegador que a respeita.
 *
 * ## O perfil
 *
 * Esconder o botão do cabeçalho é cortesia; **isto** é o controle. A sessão é
 * lida antes de o corpo do pedido ser tocado: recusar depois de processar
 * seria processar o pedido de quem não podia mandá-lo.
 */

import { lerIdentidade } from "@/acesso/leitura";
import { podeConfigurarMarca } from "@/marca/permissao";
import { origemPropria } from "@/seguranca/origem";

/*
 * A conferência de origem saiu daqui para `src/seguranca/origem.ts` quando a
 * rota do chat passou a precisar dela (D-CONVITE-apresentacao). Continua
 * exportada por este módulo: quem já a importava daqui não muda, e ela é
 * parte do que "conferir um pedido de marca" quer dizer.
 */
export { origemPropria };

export type PedidoRecusado = { readonly resposta: Response };

/** Uma recusa curta. O corpo não diz mais que o estado. */
function recusar(status: number, erro: string): PedidoRecusado {
  return { resposta: Response.json({ erro }, { status }) };
}

/**
 * Confere origem e perfil. `null` quer dizer que o pedido pode seguir.
 *
 * Devolve a resposta pronta quando recusa, para a rota não ter escolha sobre o
 * que responder — três rotas escrevendo a própria recusa dariam três formatos.
 */
export async function conferirPedidoDeMarca(
  pedido: Request,
): Promise<PedidoRecusado | null> {
  if (!origemPropria(pedido)) {
    return recusar(403, "origem do envio não confere");
  }

  const identidade = await lerIdentidade();
  if (!podeConfigurarMarca(identidade.perfil)) {
    return recusar(403, "seu perfil não configura a marca da instalação");
  }

  return null;
}

/**
 * O redirecionamento depois de um envio, sempre 303 e sempre relativo.
 *
 * ## Por que 303
 *
 * O `redirect` da navegação responde 307 fora de ação de servidor, e 307
 * preserva o método: o navegador refaria o envio contra uma rota de página que
 * só tem leitura, e a resposta seria 405. O 303 é o único que manda seguir com
 * leitura — é o que fecha o ciclo enviar, redirecionar, ler.
 *
 * ## Por que o caminho, e não o endereço inteiro
 *
 * Montar o destino absoluto a partir do endereço da requisição parece
 * inofensivo e não é: o que o servidor vê ali é o host **interno**, que pode
 * não ser o host pelo qual o navegador chegou. Foi o que aconteceu no arnês —
 * o navegador falava com `127.0.0.1` e o destino saía como `localhost`, outra
 * origem —, e a política de segurança bloqueou o envio com `form-action
 * 'self'`, exatamente como deve.
 *
 * Caminho relativo não tem essa dúvida: o navegador resolve contra a página em
 * que ele está. Também é o que sobrevive a proxy reverso, onde o host interno
 * quase nunca é o host público.
 */
export function verTela(_pedido: Request, caminho: string): Response {
  return new Response(null, {
    status: 303,
    headers: { location: caminho },
  });
}
