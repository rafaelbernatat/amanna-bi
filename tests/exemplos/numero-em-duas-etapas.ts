/**
 * Exemplo que T-181 exige: o número que T-141 não pegava.
 *
 * Este arquivo **precisa reprovar** o lint. Não é código do produto — é o
 * caso de teste da regra `sem-numero-magico`, e existe para que a regra seja
 * provada contra um arquivo de verdade, e não contra uma string no teste.
 *
 * O caminho que ele demonstra tem duas etapas, e é por isso que a regra
 * anterior não via nada:
 *
 *   1. o número é declarado numa variável de nome comum;
 *   2. a variável é formatada numa linha diferente.
 *
 * Em nenhum momento existe um literal encostado no formatador.
 */

declare function formatarValor(v: number, unidade: string): string;

// O achado 5 do Anexo D em duas linhas: a idade média do protótipo.
const x = 34.2;
export const idadeExibida = formatarValor(x, "anos");

// A mesma coisa com nome plausível — o disfarce mais comum.
const idadeMedia = 34.2;
export const outraLeitura = formatarValor(idadeMedia, "anos");

// E direto num campo de dado, sem passar por formatador nenhum.
export const cartao = { rotulo: "Cobertura da pesquisa", valor: 74 };
