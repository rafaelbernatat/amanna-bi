/**
 * Registra os dois armazéns de convidados na fábrica.
 *
 * Mesma divisão de `src/marca/registrar.ts`: memória por import comum, e o de
 * Postgres por **import dinâmico**, para que uma instalação sem banco não
 * carregue o driver que nunca vai chamar. Os dois são um por processo: o de
 * memória porque o estado é dele, o de Postgres porque memoriza o DDL.
 */

import {
  obterArmazemDeConvidados,
  registrarArmazemDeConvidados,
  type ArmazemDeConvidados,
} from "@/convidados/armazem";
import { criarArmazemDeConvidadosEmMemoria } from "@/convidados/armazens/memoria";

const EM_MEMORIA = criarArmazemDeConvidadosEmMemoria();

const CHAVE_DO_POSTGRES = Symbol.for("amanna-bi.convidados.postgres");
type Portador = { [CHAVE_DO_POSTGRES]?: Promise<ArmazemDeConvidados> };

/** Põe na fábrica os armazéns que o produto traz consigo. */
export function registrarArmazensDeConvidadosDoProduto(): void {
  registrarArmazemDeConvidados("memoria", async () => EM_MEMORIA);
  registrarArmazemDeConvidados("postgres", async (ambiente) => {
    const portador = globalThis as unknown as Portador;
    portador[CHAVE_DO_POSTGRES] ??= Promise.all([
      import("@/convidados/armazens/postgres"),
      import("@/acesso/postgres/cliente"),
    ]).then(([{ criarArmazemDeConvidadosEmPostgres }, { clienteDoProcesso }]) =>
      criarArmazemDeConvidadosEmPostgres({
        cliente: clienteDoProcesso(ambiente),
      }),
    );
    return portador[CHAVE_DO_POSTGRES];
  });
}

registrarArmazensDeConvidadosDoProduto();

/** O armazém desta instalação, já registrado. É por aqui que rota e tela leem. */
export function armazemDeConvidados(
  ambiente: Record<string, string | undefined> = process.env,
): Promise<ArmazemDeConvidados> {
  return obterArmazemDeConvidados(ambiente);
}
