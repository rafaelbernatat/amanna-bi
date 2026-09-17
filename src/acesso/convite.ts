/**
 * O provedor de sessão por convite (D-CONVITE-apresentacao).
 *
 * Lê o cookie assinado e devolve uma `Session` como qualquer outro provedor.
 * É o **controle**, e não o middleware: o matcher do middleware pula
 * requisições de prefetch, e uma rota que só confiasse nele serviria dado a
 * quem chegasse por esse caminho. Aqui a verificação acontece a cada leitura,
 * junto com o escopo.
 *
 * ## O único lugar que lê `cookies()`
 *
 * `next/headers` é API de requisição do servidor, e concentrá-la num módulo
 * mantém o resto da camada de acesso testável sem subir servidor — a mesma
 * razão de `getSession` existir.
 *
 * ## O escopo de quem entra pelo QR
 *
 * Perfil de leitura, todas as entidades e áreas: a apresentação mostra o
 * consolidado e os recortes na tela grande, e a plateia precisa ver o mesmo.
 * O que o perfil **não** dá continua valendo — `auditor` não configura a marca
 * e não abre a tela de apresentação.
 */

import { cookies } from "next/headers";

import { registrarProvedor } from "@/acesso/sessao";
import {
  NOME_DO_COOKIE,
  SessaoAusente,
  segredoDoConvite,
  sujeitoDe,
  verificarSessao,
  type SessaoDeConvite,
} from "@/seguranca/convite";
import type { Session } from "@/seguranca/identidade";
import { AREAS, ENTIDADES } from "@/semantica/contrato";

/** A sessão de convite, a partir do envelope já verificado. */
export function sessaoDeConvite(sessao: SessaoDeConvite): Session {
  return {
    sujeito: sujeitoDe(sessao),
    perfil: sessao.perfil,
    entidades: [...ENTIDADES],
    areas: [...AREAS],
  };
}

/** Segundos desde a época, como os envelopes os contam. */
function agoraEmSegundos(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * O envelope do cookie desta requisição, ou `null`.
 *
 * Nunca lança por ausência: quem decide o que fazer sem sessão é quem chama.
 */
export async function lerConvite(
  ambiente: Record<string, string | undefined> = process.env,
): Promise<SessaoDeConvite | null> {
  const segredo = segredoDoConvite(ambiente);
  if (segredo === null) return null;
  const bruto = (await cookies()).get(NOME_DO_COOKIE)?.value;
  if (bruto === undefined || bruto === "") return null;
  return verificarSessao(bruto, segredo, agoraEmSegundos());
}

registrarProvedor("convite", async () => {
  const sessao = await lerConvite();
  if (sessao === null) {
    throw new SessaoAusente("cookie ausente, adulterado ou vencido");
  }
  return sessaoDeConvite(sessao);
});
