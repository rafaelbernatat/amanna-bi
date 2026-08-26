/**
 * A nota de um painel, produzida para o recorte em tela (T-133).
 *
 * ## Por que a nota nasce aqui, e não na apresentação
 *
 * A seção 9.3 põe `note` dentro do envelope de painel, ao lado de `total` e
 * `formula`. A nota é parte da resposta, e não decoração de quem desenha —
 * duas telas que mostrassem o mesmo painel precisariam chegar à mesma frase, e
 * chegariam por caminhos diferentes se cada uma a compusesse.
 *
 * Isso cria uma tensão com a regra 2 da seção 9.2 — *"a formatação acontece só
 * na apresentação"* —, porque a frase carrega um número escrito. O PRD resolve
 * a tensão sozinho: o exemplo da 9.3 é literalmente
 * `"Operacoes e Comercial respondem por 71% do estouro."`. A nota é prosa, e
 * prosa com número dentro é o que ela é.
 *
 * O que **não** acontece aqui é formatação de valor: nada de `Intl`, nada de
 * `toFixed`, nada de separador de milhar. A única conta é uma porcentagem
 * inteira, e ela sai de aritmética de inteiros — pelo mesmo motivo que o resto
 * da camada: a saída precisa ser idêntica em qualquer máquina.
 *
 * ## O que garante que a frase vale no recorte
 *
 * Ela é calculada sobre o **envelope que o recorte produziu**. Não há texto
 * guardado, então não há texto escrito sobre outro recorte para sobreviver a
 * este. Sob recorte de uma área, as categorias são as daquela área, e a
 * proporção é a daquela área.
 *
 * Uma nota de escopo `so_no_padrao` é diferente: é texto, escrito sobre o
 * consolidado, e **some** fora do padrão. Suprimida, não adaptada (RF-09).
 */

import type { Query } from "@/semantica/contrato";
import { QUERY_PADRAO } from "@/semantica/contrato";
import { rotuloDe } from "@/semantica/dimensoes";
import { type NotaDeclarada, notaDeclarada } from "@/semantica/nota-de-painel";

/** Quantas categorias precisam existir para "as duas maiores" dizer algo. */
const MINIMO_DE_CATEGORIAS = 3;

/** Quantas categorias a frase de concentração cita. */
const MAIORES_CITADAS = 2;

/** A base da porcentagem inteira. */
const CEM = 100;

/** O recorte está no padrão dos cinco filtros? */
export function noPadrao(q: Query): boolean {
  return (
    q.periodo === QUERY_PADRAO.periodo &&
    q.ano === QUERY_PADRAO.ano &&
    q.entidade === QUERY_PADRAO.entidade &&
    q.area === QUERY_PADRAO.area &&
    q.modalidade === QUERY_PADRAO.modalidade
  );
}

/** O desenho de onde a nota tira os números, quando ele tem categorias. */
export type CargaParaNota = {
  readonly categorias: readonly string[];
  readonly valores: readonly (readonly (number | null)[])[];
};

/**
 * A nota do painel neste recorte, ou `null`.
 *
 * `null` é resposta, e a mais comum: RF-09 diz que um painel sem narrativa
 * para o recorte mostra o gráfico **sem narrativa**. Silêncio é melhor que
 * frase que ninguém conferiu.
 */
export function notaDoPainel(
  painel: string,
  q: Query,
  carga: CargaParaNota | null,
  /*
   * A declaração entra por parâmetro para que a supressão tenha teste próprio.
   *
   * Nenhum painel declara `so_no_padrao` hoje — a narrativa do produto está em
   * H-59 —, então o ramo que suprime a nota do consolidado nunca é percorrido
   * pela varredura dos 768 recortes. Uma provocação que apagava a supressão
   * **não derrubava teste nenhum**: o caso que a verificava reproduzia a
   * lógica dentro do próprio teste, em vez de cobrá-la desta função.
   *
   * É o mesmo defeito de teste que T-122 já tinha cometido: o teste certo
   * sobre o objeto errado. Com a declaração injetável dá para forjar uma nota
   * do consolidado e exigir que ela suma.
   */
  declarada: NotaDeclarada = notaDeclarada(painel),
): string | null {
  if (declarada.escopo === "sem_nota") return null;

  if (declarada.escopo === "so_no_padrao") {
    return noPadrao(q) ? declarada.texto : null;
  }

  if (carga === null) return null;
  return concentracao(carga);
}

/**
 * "As duas maiores respondem por N% do total."
 *
 * Devolve `null` quando a frase não diria nada: menos de três categorias (com
 * duas, "as duas maiores" são todas, e a resposta é sempre 100%), total
 * ausente ou zero.
 *
 * A porcentagem é inteira e arredondada por meia-unidade em aritmética de
 * inteiros. Uma casa decimal aqui sugeriria precisão que a frase não tem — ela
 * é uma leitura do gráfico, não uma medida.
 */
function concentracao(carga: CargaParaNota): string | null {
  const primeira = carga.valores[0];
  if (primeira === undefined) return null;
  if (carga.categorias.length < MINIMO_DE_CATEGORIAS) return null;

  /*
   * Categoria e valor andam juntos, e as sem valor saem antes de qualquer
   * conta (PR-4).
   *
   * A primeira versão ordenava com `primeira[i] ?? 0`, e a regra de T-141
   * reprovou — com razão, e não só por formalismo: com `?? 0`, uma categoria
   * cujo valor é **desconhecido** entra na ordenação valendo zero, e pode
   * acabar citada como uma das duas maiores num recorte onde quase tudo é
   * nulo. A frase sairia afirmando concentração sobre dado que não existe.
   *
   * Descartando antes, "as duas maiores" são as duas maiores **entre as que
   * têm valor**, e o total é o das mesmas. A frase passa a falar de um
   * conjunto coerente.
   */
  const comValor = carga.categorias
    .map((nome, i) => ({ nome, valor: primeira[i] }))
    .filter(
      (c): c is { nome: string; valor: number } =>
        c.valor !== null && c.valor !== undefined,
    );

  if (comValor.length < MINIMO_DE_CATEGORIAS) return null;

  const total = comValor.reduce((a, c) => a + c.valor, 0);
  if (total <= 0) return null;

  const maiores = [...comValor]
    .sort((a, b) => b.valor - a.valor)
    .slice(0, MAIORES_CITADAS);
  const soma = maiores.reduce((a, c) => a + c.valor, 0);

  /*
   * Arredondamento por meia-unidade sem `toFixed` e sem ponto flutuante no
   * corte: `(soma * 200 + total) / (total * 2)` truncado é o mesmo que
   * `round(soma / total * 100)`, e não depende da representação binária.
   */
  const pct = Math.floor((soma * CEM * 2 + total) / (total * 2));

  /*
   * O rótulo, e não o código.
   *
   * As categorias chegam como `operacoes`, que é o que o tipo `Area` carrega —
   * há um nome só no produto, e ele é o código (ver `dimensoes.ts`). Numa
   * frase lida por gente isso vira "operacoes e comercial respondem por 56%",
   * sem acento e sem maiúscula, e parece defeito porque é.
   *
   * `rotuloDe` devolve o código quando não conhece a dimensão, então uma
   * categoria que não seja área — faixa etária, UF — atravessa intacta em vez
   * de virar vazio.
   */
  const nomes = maiores.map((c) => rotuloDe("area", c.nome));

  return `${nomes.join(" e ")} respondem por ${String(pct)}% do total.`;
}
