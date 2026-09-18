/**
 * `npm run dados:conferir`
 *
 * Roda as conferências do dicionário contra o banco de DATABASE_URL e sai com
 * código 1 se alguma divergir acima da tolerância. Ver conferencia.ts.
 */

import {
  caDoAmbiente,
  criarCliente,
} from "../../src/acesso/postgres/cliente.ts";
import { conferirBase, relatorioDeConferencia } from "./conferencia.ts";

const url = process.env["DATABASE_URL_CARGA"] ?? process.env["DATABASE_URL"];
if (url === undefined || url.trim() === "") {
  console.error("Falta DATABASE_URL (ou DATABASE_URL_CARGA) no ambiente.");
  process.exit(1);
}

/*
 * A autoridade certificadora, quando o ambiente a entrega.
 *
 * O pooler do Supabase apresenta a cadeia propria da Supabase, que nao esta
 * nas raizes do Node — sem a CA, a conexao e recusada com
 * `SELF_SIGNED_CERT_IN_CHAIN`. Entregar a raiz e a saida; desligar a
 * verificacao nunca e (ver o cabecalho de src/acesso/postgres/cliente.ts).
 *
 * A URL nao deve levar `sslmode`: com ele presente o driver monta o TLS a
 * partir da string e ignora esta CA.
 */
const ca = caDoAmbiente();
const cliente = criarCliente(url, {
  max: 1,
  ...(ca === undefined ? {} : { ca }),
});
try {
  const lista = await conferirBase(cliente);
  console.log(relatorioDeConferencia(lista));
  const erros = lista.filter((c) => !c.ok);
  console.log(
    `\n${String(lista.length - erros.length)} de ${String(lista.length)} conferências fecham.`,
  );
  if (erros.length > 0) process.exitCode = 1;
} finally {
  await cliente.encerrar();
}
