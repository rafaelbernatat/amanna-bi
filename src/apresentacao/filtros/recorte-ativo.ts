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

/**
 * O subtítulo de um painel sob recorte (T-133, PRD seção 6.3).
 *
 * > "detecta valores absolutos no texto e suprime a nota, trocando o subtítulo
 * > por 'No recorte ativo · área'."
 *
 * O subtítulo próprio de um painel descreve o que ele mostra no consolidado —
 * "Headcount FTE e participação no total", por exemplo. Sob recorte ele deixa
 * de descrever o que está na tela, do mesmo jeito que a nota deixa. Trocá-lo
 * por "No recorte ativo · Tecnologia" diz duas coisas de uma vez: que a
 * descrição antiga não vale mais, e qual recorte está no lugar dela.
 *
 * ## Por que a área, e não a lista inteira
 *
 * O banner de recorte ativo (T-128) já lista os cinco filtros fora do padrão,
 * e ele fica no topo da tela. Repetir a lista em cada painel encheria a tela
 * de texto igual — e o subtítulo tem uma linha.
 *
 * A área é o que o protótipo escolheu mostrar, e a escolha faz sentido: dos
 * cinco filtros, é o que mais muda a leitura de um gráfico quebrado por
 * categoria. Quando o recorte está ativo por outro filtro que não a área, o
 * subtítulo fica em "No recorte ativo", sem sufixo — que continua verdadeiro.
 */
export function subtituloSobRecorte(
  q: Query,
  subtituloProprio: string | null = null,
): string | null {
  if (!temRecorteAtivo(q)) return subtituloProprio;

  const area = filtrosForaDoPadrao(q).find((f) => f.campo === "area");
  return area === undefined
    ? "No recorte ativo"
    : `No recorte ativo · ${area.rotuloDoValor}`;
}
