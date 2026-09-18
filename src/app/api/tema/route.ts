import { NextResponse } from "next/server";

import {
  DURACAO_DO_TEMA,
  NOME_DO_COOKIE_DE_TEMA,
} from "@/apresentacao/tema/ativo";
import { temaValido, type Tema } from "@/apresentacao/tema/tema";
import { origemPropria } from "@/seguranca/origem";

/**
 * `POST /api/tema` — a pessoa escolhe claro ou escuro (T-372).
 *
 * Formulário comum, sem JavaScript, como as demais rotas de preferência. A
 * escolha vira cookie porque o **servidor** precisa dela: a moldura troca
 * sozinha pelas propriedades CSS, mas o gráfico recebe a cor já resolvida, e
 * `var()` não pinta atributo de SVG.
 *
 * O redirecionamento é para um **caminho**, nunca para o endereço inteiro: o
 * host que o servidor enxerga pode não ser o host pelo qual o navegador
 * chegou, e a política de segurança bloqueia o envio inteiro quando os dois
 * divergem. É a mesma lição de `verTela` e de `/api/entrar`.
 */

export const dynamic = "force-dynamic";

const DESTINO_PADRAO = "/";

/** Só caminho relativo de uma barra, como `destinoSeguro` do convite. */
function voltarPara(bruto: FormDataEntryValue | null): string {
  if (typeof bruto !== "string" || bruto === "") return DESTINO_PADRAO;
  if (!bruto.startsWith("/")) return DESTINO_PADRAO;
  if (bruto.startsWith("//")) return DESTINO_PADRAO;
  if (bruto.includes("\\")) return DESTINO_PADRAO;
  return bruto;
}

export async function POST(pedido: Request): Promise<NextResponse> {
  if (!origemPropria(pedido)) {
    return NextResponse.json({ erro: "origem cruzada" }, { status: 403 });
  }

  let formulario: FormData;
  try {
    formulario = await pedido.formData();
  } catch {
    return NextResponse.json({ erro: "envio inválido" }, { status: 400 });
  }

  const pedido_ = formulario.get("tema");
  const escolhido: Tema =
    typeof pedido_ === "string" && temaValido(pedido_) ? pedido_ : "claro";

  const resposta = new NextResponse(null, {
    status: 303,
    headers: { location: voltarPara(formulario.get("de")) },
  });
  resposta.cookies.set({
    name: NOME_DO_COOKIE_DE_TEMA,
    value: escolhido,
    httpOnly: false,
    sameSite: "lax",
    secure:
      (pedido.headers.get("x-forwarded-proto") ??
        new URL(pedido.url).protocol.replace(":", "")) === "https",
    path: "/",
    maxAge: DURACAO_DO_TEMA,
  });
  return resposta;
}
