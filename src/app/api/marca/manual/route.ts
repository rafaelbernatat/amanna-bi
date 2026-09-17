import { guardarProposta, lerMarcaAtiva } from "@/marca/leitura";
import {
  lerEntradaManual,
  montarPropostaManual,
  TETO_DO_PEDIDO_MANUAL,
} from "@/marca/manual";
import { conferirPedidoDeMarca, verTela } from "@/marca/rota";

/**
 * `POST /api/marca/manual` — nome, cores e logo informados à mão viram uma
 * proposta.
 *
 * Rota própria, e não uma ação dentro de `extrair`: aquela busca um site e
 * esta não sai da máquina, e a diferença precisa aparecer no endereço — é
 * por endereço que a política de segurança e a auditoria de saídas de rede
 * raciocinam.
 *
 * Envio de formulário comum, `multipart` por causa do arquivo, sem
 * JavaScript. A resposta é um 303 de volta à tela, que mostra a proposta.
 * Nada é aplicado aqui.
 *
 * ## A ordem das conferências
 *
 * Origem e perfil antes de qualquer byte do corpo; o tamanho declarado antes
 * de ler o corpo; só então o `multipart` é lido. Recusar depois de processar
 * seria processar o pedido de quem não podia mandá-lo — e ler 50 MB para
 * então dizer "grande demais" é fazer o trabalho que a recusa existe para
 * evitar.
 */

export const dynamic = "force-dynamic";

const TELA = "/configuracoes/marca";

function tamanhoDeclarado(pedido: Request): number | null {
  const bruto = pedido.headers.get("content-length");
  if (bruto === null) return null;
  const n = Number(bruto);
  return Number.isFinite(n) ? n : null;
}

export async function POST(pedido: Request): Promise<Response> {
  const recusa = await conferirPedidoDeMarca(pedido);
  if (recusa !== null) return recusa.resposta;

  const tamanho = tamanhoDeclarado(pedido);
  if (tamanho !== null && tamanho > TETO_DO_PEDIDO_MANUAL) {
    return verTela(pedido, `${TELA}?erro=grande`);
  }

  let formulario: FormData;
  try {
    formulario = await pedido.formData();
  } catch {
    return verTela(pedido, `${TELA}?erro=envio`);
  }

  const entrada = await lerEntradaManual(formulario);
  // A marca em uso: é dela que o logo é mantido quando nenhum arquivo vem.
  const atual = await lerMarcaAtiva();
  const montada = montarPropostaManual(entrada, atual);
  if (!montada.ok) return verTela(pedido, `${TELA}?erro=${montada.erro}`);

  try {
    await guardarProposta(montada.proposta);
  } catch {
    // Gravação que falha precisa aparecer: a tela diz que nada foi guardado.
    return verTela(pedido, `${TELA}?erro=gravacao`);
  }

  return verTela(pedido, TELA);
}
