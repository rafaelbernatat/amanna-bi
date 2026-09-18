import { NextResponse } from "next/server";

import { lerVisitante } from "@/acesso/leitura";
import { FalhaNoCadastro } from "@/convidados/armazem";
import {
  lerCadastro,
  PARAMETRO_DE_ERRO,
  type ErroDeCadastro,
} from "@/convidados/cadastro";
import { armazemDeConvidados } from "@/convidados/registrar";
import { MILISSEGUNDOS_POR_SEGUNDO } from "@/seguranca/convite";
import { origemPropria } from "@/seguranca/origem";
import { ROTA_DA_CONVERSA } from "@/semantica/url";

/**
 * `POST /api/convidado` — quem entrou pelo QR diz quem é
 * (D-CONVIDADO-cadastro, T-425).
 *
 * Formulário comum, sem JavaScript, como `/api/entrar` e `/api/tema`. A ordem
 * das conferências: origem, depois a sessão — só o público do QR se cadastra;
 * quem apresenta não passa por aqui —, depois o corpo. Erro de campo volta
 * por 303 à conversa com `erro=nome|email`, e a tela marca o campo; erro de
 * gravação volta com `erro=gravacao` e um registro no servidor sem nome nem
 * e-mail.
 *
 * O redirecionamento é para um **caminho**, nunca para o endereço inteiro: é a
 * lição de `/api/entrar` — o host que o servidor vê pode não ser o do
 * navegador, e a política de segurança bloqueia o envio quando divergem.
 */

export const dynamic = "force-dynamic";

/** Só caminho relativo de uma barra, como `destinoSeguro` do convite. */
function voltarPara(bruto: FormDataEntryValue | null): string {
  if (typeof bruto !== "string" || bruto === "") return ROTA_DA_CONVERSA;
  if (!bruto.startsWith("/")) return ROTA_DA_CONVERSA;
  if (bruto.startsWith("//")) return ROTA_DA_CONVERSA;
  if (bruto.includes("\\")) return ROTA_DA_CONVERSA;
  return bruto;
}

/** O caminho com o erro trocado — ou sem erro nenhum. */
function comErro(caminho: string, erro: ErroDeCadastro | null): string {
  const url = new URL(caminho, "http://caminho.local");
  url.searchParams.delete(PARAMETRO_DE_ERRO);
  if (erro !== null) url.searchParams.set(PARAMETRO_DE_ERRO, erro);
  return `${url.pathname}${url.search}`;
}

function paraCaminho(caminho: string): NextResponse {
  return new NextResponse(null, {
    status: 303,
    headers: { location: caminho },
  });
}

export async function POST(pedido: Request): Promise<NextResponse> {
  if (!origemPropria(pedido)) {
    return NextResponse.json({ erro: "origem cruzada" }, { status: 403 });
  }

  const visitante = await lerVisitante();
  if (visitante === null) {
    return NextResponse.json(
      { erro: "o cadastro é de quem entrou pelo QR" },
      { status: 403 },
    );
  }

  let formulario: FormData;
  try {
    formulario = await pedido.formData();
  } catch {
    return NextResponse.json({ erro: "envio inválido" }, { status: 400 });
  }

  const de = comErro(voltarPara(formulario.get("de")), null);
  const lido = lerCadastro({
    nome: formulario.get("nome"),
    email: formulario.get("email"),
  });
  if (!lido.ok) return paraCaminho(comErro(de, lido.erro));

  try {
    const armazem = await armazemDeConvidados();
    await armazem.registrar({
      sala: visitante.sala,
      dispositivo: visitante.dispositivo,
      ...lido.cadastro,
      expiraEm: new Date(
        visitante.expira * MILISSEGUNDOS_POR_SEGUNDO,
      ).toISOString(),
    });
  } catch (erro) {
    if (erro instanceof FalhaNoCadastro) {
      // Só a sala e o motivo: nunca o nome, nunca o e-mail.
      console.error(
        JSON.stringify({
          evento: "convidado.gravacao_falhou",
          sala: visitante.sala,
          motivo: erro.motivo,
          em: new Date().toISOString(),
        }),
      );
      return paraCaminho(comErro(de, "gravacao"));
    }
    throw erro;
  }

  return paraCaminho(de);
}
