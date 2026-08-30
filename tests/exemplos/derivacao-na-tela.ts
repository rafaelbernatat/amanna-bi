/**
 * Exemplo que T-134 exige: o achado 3 do Anexo D, escrito em TypeScript.
 *
 * Este arquivo **precisa reprovar** o lint. Não é código do produto — é o caso
 * de teste da regra `sem-derivacao-exibida`, e existe para que a regra seja
 * provada contra um arquivo de verdade, e não contra uma string no teste.
 *
 * O que ele demonstra é o protótipo: `fctx()` devolve um multiplicador por
 * entidade e por área, e a tela multiplica o valor lido antes de mostrar.
 * Nenhuma destas linhas tem literal encostado no formatador — T-141 passa por
 * todas elas sem reclamar, e é essa a fresta que esta regra fecha.
 */

declare function formatarValor(v: number, unidade: string): string;

declare const lido: { readonly total: number; readonly anterior: number };
declare const fator: number;

// 1. O fator de escala do protótipo: `ent` 0,62 para Unidade SP.
const ENTIDADE_SP = 0.62;
export const escalado = formatarValor(lido.total * ENTIDADE_SP, "BRL_mi");

// 2. O mesmo, com o fator vindo de outra função — `fctx().hc`, `money`, `rev`.
export const porArea = formatarValor(lido.total * fator, "FTE");

// 3. Derivação por subtração: um número que a fonte não devolveu.
export const diferenca = formatarValor(lido.total - lido.anterior, "BRL_mi");

// 4. Derivação por divisão, disfarçada de média.
export const media = formatarValor(lido.total / lido.anterior, "pct");

// 5. A conta escondida atrás de um `??`, que ainda chega ao formatador.
export const comPadrao = formatarValor(
  lido.anterior ?? lido.total * fator,
  "FTE",
);

// 6. A conta dentro de uma seta anônima: embrulhar em `map` não escapa.
export const cadaUm = [lido].map((l) => formatarValor(l.total * fator, "FTE"));

/*
 * 7. O atalho local: a apresentação embrulha o formatador numa função de três
 *    linhas e chama o embrulho. Sem seguir o caminho até `formatarValor`, a
 *    regra deixaria o achado 3 passar por aqui inteiro.
 */
function texto(v: number, unidade: string): string {
  return formatarValor(v, unidade);
}

export const pelaPontePorta = texto(lido.total * fator, "FTE");
