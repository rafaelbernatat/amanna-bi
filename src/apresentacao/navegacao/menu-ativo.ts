import { cookies } from "next/headers";

import {
  estadoDoMenuValido,
  NOME_DO_COOKIE_DO_MENU,
  type EstadoDoMenu,
} from "@/apresentacao/navegacao/menu";

/**
 * O estado do menu lateral nesta requisicao (T-421).
 *
 * Lido no servidor, no layout do painel, para o primeiro quadro ja sair com a
 * largura certa. Sem cookie, aberto: e o que a maioria quer sem pedir, e o
 * conteiner recolhe sozinho quando nao cabe.
 */
export async function estadoDoMenu(): Promise<EstadoDoMenu> {
  const bruto = (await cookies()).get(NOME_DO_COOKIE_DO_MENU)?.value;
  return bruto !== undefined && estadoDoMenuValido(bruto) ? bruto : "aberto";
}
