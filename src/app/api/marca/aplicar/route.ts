import { lerIdentidade } from "@/acesso/leitura";
import { VERSAO_DA_MARCA } from "@/marca/documento";
import {
  aplicarMarca,
  descartarProposta,
  lerPropostaPendente,
  limparMarca,
} from "@/marca/leitura";
import { conferirPedidoDeMarca, verTela } from "@/marca/rota";

/**
 * `POST /api/marca/aplicar` — a decisao sobre a proposta.
 *
 * Tres acoes, e a tela manda qual: aplicar a proposta pendente, descarta-la, ou
 * voltar ao tema padrao. Aplicar le a proposta **do armazem**, e nao do corpo
 * do envio: o que vai para a tela e o que o estagio 3 conferiu, e nao o que
 * chegou pela rede.
 */

export const dynamic = "force-dynamic";

const TELA = "/configuracoes/marca";

export async function POST(pedido: Request): Promise<Response> {
  const recusa = await conferirPedidoDeMarca(pedido);
  if (recusa !== null) return recusa.resposta;

  const formulario = await pedido.formData();
  const acao = String(formulario.get("acao") ?? "");

  try {
    if (acao === "descartar") {
      await descartarProposta();
      return verTela(pedido, TELA);
    }

    if (acao === "limpar") {
      await limparMarca();
      return verTela(pedido, `${TELA}?feito=limpou`);
    }

    if (acao !== "aplicar") return verTela(pedido, `${TELA}?erro=acao`);

    const proposta = await lerPropostaPendente();
    if (proposta === null) return verTela(pedido, `${TELA}?erro=sem-proposta`);

    const identidade = await lerIdentidade();
    await aplicarMarca({
      versao: VERSAO_DA_MARCA,
      site: proposta.site,
      cores: proposta.cores,
      logo: proposta.logo,
      aplicadaEm: new Date().toISOString(),
      aplicadaPor: {
        sujeito: identidade.sujeito,
        perfil: identidade.perfil,
      },
      extracao: proposta.extracao,
    });
    return verTela(pedido, `${TELA}?feito=aplicou`);
  } catch {
    return verTela(pedido, `${TELA}?erro=gravacao`);
  }
}
