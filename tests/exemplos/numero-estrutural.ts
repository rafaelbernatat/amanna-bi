/**
 * O contraexemplo: número estrutural que **não** pode reprovar.
 *
 * Sem este arquivo, a regra passaria a valer alguma coisa proibindo tudo — e
 * uma regra que proíbe tudo é desligada na primeira sexta-feira.
 */

/** Limiar de layout declarado, com nome em maiúsculas. */
const COLUNAS_DA_GRADE = 12;

export const painel = {
  id: "orc-desvio",
  // Grade da seção 5: geometria, não dado.
  span: 4,
};

export const estilo = {
  fontSize: 11,
  top: 8,
  gap: 5,
  borderRadius: 12,
};

export function ultimaColuna(colunas: readonly string[]): string | undefined {
  // Índice, e aritmética sobre `.length`: posição, não medida.
  return colunas[colunas.length - 1];
}

export const largura = COLUNAS_DA_GRADE;
