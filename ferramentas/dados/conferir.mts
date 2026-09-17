/**
 * `npm run dados:conferir`
 *
 * Roda as conferências do dicionário contra o banco de DATABASE_URL e sai com
 * código 1 se alguma divergir acima da tolerância. Ver conferencia.ts.
 */

import { criarCliente } from "../../src/acesso/postgres/cliente.ts";
import { conferirBase, relatorioDeConferencia } from "./conferencia.ts";

const url = process.env["DATABASE_URL_CARGA"] ?? process.env["DATABASE_URL"];
if (url === undefined || url.trim() === "") {
  console.error("Falta DATABASE_URL (ou DATABASE_URL_CARGA) no ambiente.");
  process.exit(1);
}

const cliente = criarCliente(url, { max: 1 });
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
