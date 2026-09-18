import { redirect } from "next/navigation";
import { lerCoresAplicadas } from "@/marca/tela";
import type { Metadata } from "next";

import { lerIdentidade, lerVisitante } from "@/acesso/leitura";
import { Chat } from "@/apresentacao/chat/Chat";
import { CadastroDeConvidado } from "@/apresentacao/convidados/CadastroDeConvidado";
import { acharTela, TELA_PADRAO } from "@/apresentacao/navegacao/telas";
import { perguntasRestantes } from "@/chat/protocolo";
import { erroValido, PARAMETRO_DE_ERRO } from "@/convidados/cadastro";
import { armazemDeConvidados } from "@/convidados/registrar";
import { emMilissegundos } from "@/seguranca/convite";
import {
  PARAMETRO_DA_TELA,
  ROTA_DA_CONVERSA,
  rotaDaConversa,
} from "@/semantica/url";
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
 * ## A porta do cadastro (D-CONVIDADO-cadastro)
 *
 * Quem entrou pelo QR com o perfil do público e ainda não disse quem é vê o
 * formulário de nome e e-mail em vez da conversa. O cadastro é lido pela
 * chave da sessão — sala e dispositivo —, e não por um cookie novo: quem tem
 * o passe tem o cadastro. Com cadastro, o chat recebe o nome, quantas
 * perguntas restam e quando a sessão vence. Quem apresenta, e o modo
 * `fixtures` sem convite, nunca veem o formulário.
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
  const [busca, , visitante] = await Promise.all([
    searchParams,
    lerIdentidade(),
    lerVisitante(),
  ]);

  const parametros = new URLSearchParams(
    Object.entries(busca).flatMap(([chave, valor]) => {
      const unico = primeiro(valor);
      return unico === null ? [] : [[chave, unico] as [string, string]];
    }),
  );

  // O erro do cadastro vem na URL e sai dela: não é parte do recorte.
  const erroBruto = parametros.get(PARAMETRO_DE_ERRO);
  parametros.delete(PARAMETRO_DE_ERRO);

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
  const cores = await lerCoresAplicadas();

  /*
   * A canonização da URL não acontece aqui de propósito.
   *
   * A tela de painel reescreve a busca para a forma canônica porque a URL é o
   * que se compartilha. Aqui a URL vem de um QR e muda a cada resposta do
   * chat; um redirecionamento a cada carga faria o celular navegar duas vezes
   * por pergunta. O leitor já é tolerante: o que não casa cai no padrão.
   */
  if (visitante === null) {
    return <Chat modo="cheio" tela={tela} cores={cores} />;
  }

  const cadastro = await (await armazemDeConvidados()).ler(visitante);
  if (cadastro === null) {
    const de = `${ROTA_DA_CONVERSA}?${parametros.toString()}`;
    return (
      <CadastroDeConvidado
        de={de}
        erro={erroBruto !== null && erroValido(erroBruto) ? erroBruto : null}
      />
    );
  }

  return (
    <Chat
      modo="cheio"
      tela={tela}
      cores={cores}
      convidado={{
        id: cadastro.id,
        nome: cadastro.nome,
        perguntasRestantes: perguntasRestantes(cadastro.perguntas),
        expiraEm: emMilissegundos(visitante.expira),
      }}
    />
  );
}
