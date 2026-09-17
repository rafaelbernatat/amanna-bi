import { extrairMarca } from "@/marca/extrair/extrair";
import { guardarProposta } from "@/marca/leitura";
import { conferirPedidoDeMarca, verTela } from "@/marca/rota";

/**
 * `POST /api/marca/extrair` — o site informado vira uma proposta.
 *
 * Envio de formulario comum, sem JavaScript, como a barra de filtros ja faz.
 * A resposta e um redirecionamento 303 de volta a tela, que entao mostra a
 * proposta com o antes e o depois de cada ajuste. Nada e aplicado aqui: quem
 * aplica e a pessoa, na tela seguinte, com um clique.
 */

export const dynamic = "force-dynamic";

/** Onde a tela mora. O redirecionamento sempre volta para ca. */
const TELA = "/configuracoes/marca";

export async function POST(pedido: Request): Promise<Response> {
  const recusa = await conferirPedidoDeMarca(pedido);
  if (recusa !== null) return recusa.resposta;

  const formulario = await pedido.formData();
  const site = String(formulario.get("site") ?? "").trim();
  if (site === "") return verTela(pedido, `${TELA}?erro=vazio`);

  const extraida = await extrairMarca(site);
  if (!extraida.ok) {
    return verTela(
      pedido,
      `${TELA}?recusa=${encodeURIComponent(extraida.motivo)}`,
    );
  }

  try {
    await guardarProposta(extraida.proposta);
  } catch {
    // Gravacao que falha precisa aparecer: a tela diz que nada foi guardado.
    return verTela(pedido, `${TELA}?erro=gravacao`);
  }

  return verTela(pedido, TELA);
}
