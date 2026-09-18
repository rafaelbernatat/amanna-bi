import { NextResponse } from "next/server";

import {
  NOME_DO_COOKIE,
  PARAMETRO_DE_DESTINO,
  PARAMETRO_DE_MOTIVO,
  type MotivoDeEntrada,
} from "@/seguranca/convite";
import { origemPropria } from "@/seguranca/origem";
import { decidirEntradaPorSenha } from "@/seguranca/senha";
import { controleDeTentativasDoProcesso } from "@/seguranca/tentativas";

/**
 * `POST /api/entrar` — a senha do painel vira sessão.
 *
 * Formulário comum, sem JavaScript, como as rotas de marca. A senha vai no
 * corpo e **nunca** na URL: é a diferença que motivou esta porta existir ao
 * lado do link assinado, cujo token fica no histórico do navegador até a
 * entrada apagá-lo.
 *
 * ## A ordem das conferências
 *
 * Origem antes de tudo, porque um formulário montado em outro site mandaria a
 * senha de quem estiver com a sessão aberta. Depois o limite de tentativas,
 * antes de ler o corpo — recusar quem já passou do limite não deve custar o
 * trabalho de processar o pedido dele. Só então a senha é conferida, em tempo
 * constante.
 *
 * ## A resposta não diz o que errou
 *
 * Senha vazia e senha errada saem com o mesmo motivo. Distinguir as duas
 * entrega ao atacante um oráculo de graça, e não ajuda ninguém que esteja
 * digitando de boa-fé.
 */

export const dynamic = "force-dynamic";

const ENTRADA = "/entrar";

/** O endereço de quem pediu, para a janela de tentativas. */
function origemDoPedido(pedido: Request): string {
  return (
    pedido.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    pedido.headers.get("x-real-ip") ??
    "desconhecida"
  );
}

/**
 * Um 303 para um **caminho**, nunca para um endereço inteiro.
 *
 * Montar o destino absoluto a partir de `pedido.url` parece inofensivo e não
 * é: o que o servidor vê ali é o host interno, que pode não ser o host pelo
 * qual o navegador chegou. No arnês o navegador fala com `127.0.0.1` e o
 * destino saía como `localhost` — outra origem —, e a política de segurança
 * bloqueou o envio inteiro com `form-action 'self'`, exatamente como deve. O
 * sintoma engana: o console acusa o endereço do formulário, não o do
 * redirecionamento.
 *
 * É a mesma lição de `verTela`, em `src/marca/rota.ts`, e o mesmo remédio.
 */
function paraCaminho(caminho: string): NextResponse {
  return new NextResponse(null, {
    status: 303,
    headers: { location: caminho },
  });
}

function deVolta(motivo: MotivoDeEntrada, ir: string | null): NextResponse {
  const busca = new URLSearchParams();
  busca.set(PARAMETRO_DE_MOTIVO, motivo);
  if (ir !== null && ir !== "") busca.set(PARAMETRO_DE_DESTINO, ir);
  return paraCaminho(`${ENTRADA}?${busca.toString()}`);
}

export async function POST(pedido: Request): Promise<NextResponse> {
  if (!origemPropria(pedido)) {
    return NextResponse.json({ erro: "origem cruzada" }, { status: 403 });
  }

  const controle = controleDeTentativasDoProcesso();
  if (!controle.admitir(origemDoPedido(pedido), Date.now())) {
    return deVolta("tentativas", null);
  }

  let formulario: FormData;
  try {
    formulario = await pedido.formData();
  } catch {
    return deVolta("senha", null);
  }

  const senha = formulario.get("senha");
  const ir = formulario.get(PARAMETRO_DE_DESTINO);
  const destinoPedido = typeof ir === "string" ? ir : null;

  const decidida = await decidirEntradaPorSenha({
    senha: typeof senha === "string" ? senha : null,
    ir: destinoPedido,
    ambiente: process.env,
    agoraSegundos: Math.floor(Date.now() / 1000),
  });

  if (decidida.tipo === "recusar") {
    return deVolta(decidida.motivo, destinoPedido);
  }

  /*
   * Acertou: a contagem daquele endereço zera.
   *
   * Sem isto, alguém que erra cinco vezes e acerta na sexta ficaria um minuto
   * trancado do lado de dentro, e a janela puniria quem digitou errado em vez
   * de quem está chutando.
   */
  controle.esquecer(origemDoPedido(pedido));

  const resposta = paraCaminho(decidida.destino);
  resposta.cookies.set({
    name: NOME_DO_COOKIE,
    value: decidida.cookie,
    httpOnly: true,
    sameSite: "lax",
    /*
     * O esquema pelo qual o **navegador** chegou, não o que o servidor vê: o
     * proxy reverso da nuvem fala HTTP com a aplicação e HTTPS com o mundo, e
     * um cookie sem `Secure` ali viajaria em claro na próxima requisição.
     */
    secure:
      (pedido.headers.get("x-forwarded-proto") ??
        new URL(pedido.url).protocol.replace(":", "")) === "https",
    path: "/",
    maxAge: decidida.maxAge,
  });
  return resposta;
}
