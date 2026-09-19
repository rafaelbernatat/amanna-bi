/**
 * A segunda conexão: a do chat, autenticada como `amanna_chat_ro` (T-450).
 *
 * **É ela a defesa.** O papel tem GRANT só em `amanna_chat`, e nenhum em
 * `amanna`. `SET LOCAL ROLE` na conexão do produto não serviria: dentro de uma
 * transação somente-leitura, `set_config('role', <session_user>, false)` volta
 * à role autenticada, e `query_to_xml` planeja a consulta interna depois disso
 * — medido em PGlite 0.5.8 antes de este arquivo existir. Uma role que a
 * conexão nunca teve não se recupera por `set_config`.
 *
 * Não importa `pg`: o pool sai de `criarCliente`, em `cliente.ts`, que é o
 * único arquivo do produto autorizado a isso (`fronteira-obrigatoria.test.ts`).
 *
 * Pool pequeno de propósito: `max: 2`. O Supavisor conta clientes, e o pool
 * principal já usa três; uma pergunta de chat por vez é o caso, e a fila de
 * seis segundos que o comentário de `cliente.ts` descreve é o que se evita.
 */

import {
  caDoAmbiente,
  criarCliente,
  type ClientePostgres,
} from "@/acesso/postgres/cliente";

/** Quantas conexões o chat abre. Ver o comentário do módulo. */
const MAXIMO_DE_CONEXOES_DO_CHAT = 2;

const GUARDADO = Symbol.for("amanna-bi.postgres.cliente-chat");
type Portador = {
  [GUARDADO]?: { url: string; cliente: ClientePostgres };
};

/**
 * A consulta livre está configurada nesta instalação?
 *
 * Sem `DATABASE_URL_CHAT` a capacidade fica desligada, e a ferramenta nem é
 * oferecida ao modelo — que é o que faz `fixtures` e o arnês de e2e nunca a
 * alcançarem.
 */
export function consultaLivreConfigurada(
  ambiente: Record<string, string | undefined> = process.env,
): boolean {
  const url = ambiente["DATABASE_URL_CHAT"];
  return url !== undefined && url.trim() !== "";
}

/** O cliente do chat, um por processo e por URL. */
export function clienteDoChat(
  ambiente: Record<string, string | undefined> = process.env,
): ClientePostgres {
  const url = ambiente["DATABASE_URL_CHAT"];
  if (url === undefined || url.trim() === "") {
    throw new Error("DATABASE_URL_CHAT não configurada");
  }
  const portador = globalThis as unknown as Portador;
  const atual = portador[GUARDADO];
  if (atual !== undefined && atual.url === url) return atual.cliente;

  const cliente = criarCliente(url, {
    max: MAXIMO_DE_CONEXOES_DO_CHAT,
    ...(caDoAmbiente(ambiente) === undefined
      ? {}
      : { ca: caDoAmbiente(ambiente) as string }),
  });
  portador[GUARDADO] = { url, cliente };
  return cliente;
}

/** Só para teste: esquece o cliente guardado. */
export function esquecerClienteDoChat(): void {
  delete (globalThis as unknown as Portador)[GUARDADO];
}
