/**
 * Quais filtros estão fora do padrão (T-128, PRD seção 6.2 e RF-02).
 *
 * "Quando qualquer filtro sai do padrão, um **banner de recorte ativo** aparece
 * acima dos KPIs, listando o que está fora do padrão."
 *
 * Módulo sem React de propósito. A regra "o banner aparece se e somente se ao
 * menos um filtro difere do padrão" é a parte que precisa ser verificada em
 * todos os casos, e verificá-la desenhando a tela custaria um navegador por
 * caso. Aqui ela é uma função pura sobre `Query`, e o componente só decide
 * desenhar ou não a partir do que ela devolve.
 */

import type { Query } from "@/semantica/contrato";
import { QUERY_PADRAO } from "@/semantica/contrato";
import {
  FILTROS,
  ROTULO_DO_FILTRO,
  rotuloDe,
  type NomeDeFiltro,
} from "@/semantica/dimensoes";

/** Um filtro que difere do padrão da tabela 6.2. */
export type FiltroForaDoPadrao = {
  readonly campo: NomeDeFiltro;
  /** "Área" — como a coluna Filtro da 6.2 escreve. */
  readonly rotuloDoCampo: string;
  /** "Operações" — o rótulo acentuado do valor, nunca o código. */
  readonly rotuloDoValor: string;
  /** O código, para quem precisar montar link ou atributo de teste. */
  readonly codigo: string;
};

/**
 * Os filtros fora do padrão, na ordem da tabela 6.2.
 *
 * Vazio é o recorte consolidado. A ordem é a de `FILTROS`, e não a de
 * digitação: o banner precisa ler igual toda vez, senão duas pessoas no mesmo
 * recorte veem listas diferentes e acham que estão em recortes diferentes.
 */
export function filtrosForaDoPadrao(q: Query): readonly FiltroForaDoPadrao[] {
  const fora: FiltroForaDoPadrao[] = [];
  for (const campo of FILTROS) {
    const valor = q[campo];
    if (valor === QUERY_PADRAO[campo]) continue;
    fora.push({
      campo,
      rotuloDoCampo: ROTULO_DO_FILTRO[campo],
      rotuloDoValor: rotuloDe(campo, valor),
      codigo: valor,
    });
  }
  return fora;
}

/** Há recorte ativo? É a condição exata do banner (RF-02). */
export function temRecorteAtivo(q: Query): boolean {
  return filtrosForaDoPadrao(q).length > 0;
}
