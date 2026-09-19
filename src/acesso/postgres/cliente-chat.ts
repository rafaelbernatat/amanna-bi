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
 * A URL que a consulta livre usa.
 *
 * `DATABASE_URL_CHAT` quando existe — é a conexão do papel restrito, e é o que
 * se quer com dado real. Senão, a conexão de sempre: Produto decidiu em
 * 2026-09-19 que no protótipo, com base fictícia, a consulta vale sem
 * provisionar papel nenhum. A tranca que resta é a do esquema `amanna_chat`
 * (as views, o recorte por perfil) mais a transação somente-leitura — o
 * suficiente para nada ser escrito, e não o suficiente para conter quem
 * escrever `FROM amanna.…` de propósito.
 */
function urlDoChat(
  ambiente: Record<string, string | undefined>,
): string | null {
  const propria = ambiente["DATABASE_URL_CHAT"];
  if (propria !== undefined && propria.trim() !== "") return propria;
  const padrao = ambiente["DATABASE_URL"];
  return padrao !== undefined && padrao.trim() !== "" ? padrao : null;
}

/**
 * A consulta livre está disponível nesta instalação?
 *
 * Basta haver banco. Em `fixtures` não há, e por isso a ferramenta nem é
 * oferecida ao modelo — que é o que faz o arnês de e2e nunca a alcançar.
 */
export function consultaLivreConfigurada(
  ambiente: Record<string, string | undefined> = process.env,
): boolean {
  return urlDoChat(ambiente) !== null;
}

/** O cliente do chat, um por processo e por URL. */
export function clienteDoChat(
  ambiente: Record<string, string | undefined> = process.env,
): ClientePostgres {
  const url = urlDoChat(ambiente);
  if (url === null) {
    throw new Error("sem banco configurado para a consulta do chat");
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
