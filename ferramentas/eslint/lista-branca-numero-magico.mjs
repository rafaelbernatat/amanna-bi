/**
 * A lista branca da regra `painel/sem-numero-magico` (T-181).
 *
 * Está vazia, e isso é o resultado, não uma pendência.
 *
 * Os 74 números de `paineis.ts` e os ~56 dos componentes passaram todos por
 * nome estrutural, constante nomeada ou índice. Não foi preciso dispensar
 * nenhum caso individual — o que significa que a regra descreve o código em
 * vez de negociar com ele.
 *
 * ## Por que mora num arquivo só dela
 *
 * O aceite de T-181 pede que a lista seja "revisada no CI quando cresce", e
 * quem faz essa revisão é um teste. Enquanto ela era um literal dentro de
 * `eslint.config.mjs`, o teste precisava importar a configuração inteira para
 * ler um array vazio — e junto vinham `eslint-config-next` e
 * `typescript-eslint`. Sob carga esse import chegou a 78 s e estourou o limite
 * de 30 s: vermelho sem defeito, que é o que ensina a ignorar vermelho (T-123.1).
 *
 * Separada, ela é lida em microssegundos, e um segundo caso confere que
 * `eslint.config.mjs` realmente a usa — de modo que a configuração não pode
 * divergir deste arquivo sem reprovar.
 *
 * ## Como crescer
 *
 * Cada entrada é `{ arquivo, valor, motivo }`, e o `motivo` é exigido pelo
 * schema da própria regra: uma dispensa sem razão escrita é indistinguível de
 * uma desistência.
 */

/** @type {readonly { arquivo: string, valor: number, motivo: string }[]} */
export const LISTA_BRANCA = [];
