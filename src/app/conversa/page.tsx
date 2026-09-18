import { redirect } from "next/navigation";
import { lerCoresAplicadas } from "@/marca/tela";
import type { Metadata } from "next";

import { lerIdentidade } from "@/acesso/leitura";
import { Chat } from "@/apresentacao/chat/Chat";
import { acharTela, TELA_PADRAO } from "@/apresentacao/navegacao/telas";
import { PARAMETRO_DA_TELA, rotaDaConversa } from "@/semantica/url";
import { buscaParaQuery } from "@/semantica/url";

/**
 * A conversa em tela cheia: o chat no celular de quem escaneou o QR
 * (D-CONVITE-apresentacao).
 *
 * Fora do grupo `(painel)`: não tem cabeçalho de módulos, não tem barra de
 * filtros e não tem grade de painéis — uma tela de 390 px não comporta as
 * três coisas, e a plateia não veio navegar, veio perguntar. O gráfico que a
 * resposta cita aparece **dentro** da bolha (T-351).
 *
 * ## A tela vem por parâmetro, e é validada
 *
 * `/conversa?tela=rh/visao&periodo=dezembro` diz de que tela a conversa fala e
 * em que recorte. Tela fora do inventário redireciona para a padrão em vez de
 * abrir uma conversa sobre nada — é o mesmo tratamento que a rota de painel dá
 * a um slug inválido, e o motivo é o mesmo: o que a URL pede ou existe ou é
 * corrigido à vista.
 *
 * ## A sessão é a de sempre
 *
 * `lerIdentidade` monta a sessão pelo provedor configurado. Com
 * `AUTH_PROVIDER=convite`, quem não tem cookie assinado não chega aqui — o
 * proxy manda para `/entrar`, e o provedor recusaria de qualquer forma.
 */

export const metadata: Metadata = {
  title: "Conversa · Painel BI",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Busca = Record<string, string | string[] | undefined>;

function primeiro(valor: string | string[] | undefined): string | null {
  if (valor === undefined) return null;
  return Array.isArray(valor) ? (valor.at(-1) ?? null) : valor;
}

export default async function Pagina({
  searchParams,
}: {
  searchParams: Promise<Busca>;
}) {
  const [busca] = await Promise.all([searchParams, lerIdentidade()]);

  const parametros = new URLSearchParams(
    Object.entries(busca).flatMap(([chave, valor]) => {
      const unico = primeiro(valor);
      return unico === null ? [] : [[chave, unico] as [string, string]];
    }),
  );

  const pedida = (parametros.get(PARAMETRO_DA_TELA) ?? "").replace(/^\//, "");
  const [modulo = "", slug = ""] = pedida.split("/");
  const achada = acharTela(modulo, slug);
  const { query, painelDestacado } = buscaParaQuery(parametros);

  if (achada === undefined) {
    // Tela inválida: a conversa abre na padrão, com o recorte que veio.
    redirect(
      rotaDaConversa(TELA_PADRAO.slice(1), query, painelDestacado ?? undefined),
    );
  }

  const tela = `${achada.modulo.id}/${achada.tela.slug}`;

  /*
   * A canonização da URL não acontece aqui de propósito.
   *
   * A tela de painel reescreve a busca para a forma canônica porque a URL é o
   * que se compartilha. Aqui a URL vem de um QR e muda a cada resposta do
   * chat; um redirecionamento a cada carga faria o celular navegar duas vezes
   * por pergunta. O leitor já é tolerante: o que não casa cai no padrão.
   */
  return <Chat modo="cheio" tela={tela} cores={await lerCoresAplicadas()} />;
}
