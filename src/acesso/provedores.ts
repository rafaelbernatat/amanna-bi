/**
 * Registra os provedores de sessão que trazem dependência de requisição.
 *
 * Mesma divisão de `src/acesso/registrar.ts`: `fixtures` se registra no
 * próprio módulo da fábrica porque são dois objetos literais; o de convite
 * entra aqui porque lê `next/headers`, e importá-lo da fábrica levaria API de
 * requisição para dentro de quem só queria a lista de modos.
 *
 * Importado por `leitura.ts`, que é o único caminho da tela até o dado.
 */

import "@/acesso/convite";
