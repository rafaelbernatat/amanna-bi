import { FalhaNoCadastro } from "@/convidados/armazem";
import { FORMA_DO_ID, origemValida } from "@/convidados/interesse";
import { armazemDeConvidados } from "@/convidados/registrar";
import { origemPropria } from "@/seguranca/origem";

/**
 * `POST /api/interesse` — quem clicou no convite da Dreamy
 * (D-CONVIDADO-cadastro, T-426).
 *
 * ## Pública, e por quê
 *
 * O clique que mais importa é o que acontece **depois** de a sessão vencer: o
 * relógio de cinco horas abre o convite, e nesse instante não há mais cookie
 * válido. Uma rota que exigisse sessão perderia justamente esse registro. Por
 * isso ela está em `CAMINHOS_PUBLICOS` e identifica o convidado pelo id
 * sorteado do cadastro — 122 bits de aleatoriedade que só quem se cadastrou
 * recebeu —, com a origem conferida como em toda rota de escrita.
 *
 * Responde 204 sempre que o pedido tem forma: id desconhecido é silêncio, e
 * não um oráculo de quais ids existem.
 */

export const dynamic = "force-dynamic";

function recusar(status: number, erro: string): Response {
  return Response.json({ erro }, { status });
}

export async function POST(pedido: Request): Promise<Response> {
  if (!origemPropria(pedido)) return recusar(403, "origem cruzada");

  let corpo: unknown;
  try {
    corpo = await pedido.json();
  } catch {
    return recusar(400, "corpo não é JSON");
  }
  if (typeof corpo !== "object" || corpo === null) {
    return recusar(400, "pedido malformado");
  }
  const { id, origem } = corpo as { id?: unknown; origem?: unknown };
  if (
    typeof id !== "string" ||
    !FORMA_DO_ID.test(id) ||
    typeof origem !== "string" ||
    !origemValida(origem)
  ) {
    return recusar(400, "pedido malformado");
  }

  try {
    await (await armazemDeConvidados()).registrarInteresse(id, origem);
  } catch (erro) {
    if (!(erro instanceof FalhaNoCadastro)) throw erro;
    console.error(
      JSON.stringify({
        evento: "interesse.gravacao_falhou",
        motivo: erro.motivo,
        em: new Date().toISOString(),
      }),
    );
  }
  return new Response(null, { status: 204 });
}
