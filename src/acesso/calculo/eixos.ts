/**
 * O grão em que o dado é **armazenado** (T-110).
 *
 * ## O agregado nunca é uma linha
 *
 * `Consolidado` e `Todas` não existem nas fixtures. Eles são o resultado de
 * somar as linhas que existem — e isso é a correção do achado 3 do Anexo D,
 * que é o defeito estrutural do protótipo:
 *
 * > `entidade: 'Unidade SP'` multiplica todos os valores por `0.62`; `área`
 * > multiplica pela participação daquela área no total.
 *
 * No protótipo o consolidado é o dado, e o recorte é um fator de escala. A
 * consequência está no achado 4: a reconciliação **parece** correta porque KPI
 * e painel escalam pelo mesmo fator, não porque somam o mesmo dado. Guardar só
 * o grão fino e derivar o agregado é o que torna RF-03 verificável de verdade.
 *
 * Consequência prática: `soma(Unidade SP) + soma(Demais unidades)` é igual a
 * `Consolidado` porque são a mesma soma feita duas vezes, e não porque
 * `0.62 + 0.38 = 1`.
 *
 * ## Por que os eixos são derivados, e não digitados
 *
 * Vêm de `dimensoes.ts` (T-186) com o código agregado removido. Uma área nova
 * no vocabulário entra aqui sozinha; uma lista escrita à mão sairia de sincronia
 * no primeiro valor novo, e o sintoma seria uma área que existe no filtro e não
 * existe no dado.
 */

import { codigosDe } from "@/semantica/dimensoes";

/**
 * Os códigos que significam "todo o resto somado".
 *
 * São recorte, não valor: nenhuma linha de fato os carrega. Um teste confere
 * que cada um deles é de fato um código da sua dimensão — senão a filtragem
 * abaixo não removeria nada e o agregado viraria linha em silêncio.
 */
export const AGREGADO_DE_ENTIDADE = "consolidado";
export const AGREGADO_DE_AREA = "todas";
export const AGREGADO_DE_MODALIDADE = "todas";

/** As duas entidades reais. `consolidado` é a soma delas. */
export const ENTIDADES_ARMAZENADAS: readonly string[] = codigosDe(
  "entidade",
).filter((c) => c !== AGREGADO_DE_ENTIDADE);

/** As sete áreas. `todas` é a soma delas. */
export const AREAS_ARMAZENADAS: readonly string[] = codigosDe("area").filter(
  (c) => c !== AGREGADO_DE_AREA,
);

/** As três modalidades. `todas` é a soma delas. */
export const MODALIDADES_ARMAZENADAS: readonly string[] = codigosDe(
  "modalidade",
).filter((c) => c !== AGREGADO_DE_MODALIDADE);

/**
 * Os doze meses de um ano, como chave ordenável.
 *
 * `2026-01` a `2026-12`. Texto e não `Date` de propósito: mês de competência é
 * um rótulo de calendário, não um instante — construir um `Date` faria
 * `2026-01` virar dezembro de 2025 a oeste de Greenwich, que é o mesmo defeito
 * que o módulo de formatação já documenta.
 */
export function mesesDe(ano: string): readonly string[] {
  const DOZE = 12;
  return Array.from({ length: DOZE }, (_, i) =>
    i + 1 < 10 ? `${ano}-0${i + 1}` : `${ano}-${i + 1}`,
  );
}

/** O ano de uma chave de mês: `2026-07` → `2026`. */
export function anoDoMes(mes: string): string {
  return mes.slice(0, mes.indexOf("-"));
}

/** Uma célula do grão armazenado, sem o mês. */
export type Celula = {
  readonly entidade: string;
  readonly area: string;
  readonly modalidade: string;
};

/**
 * As células do grão entidade × área × modalidade, em ordem fixa.
 *
 * Ordem fixa porque a repartição por maior resto desempata pelo índice: mudar a
 * ordem mudaria qual célula recebe a unidade que sobra, e a fixture deixaria de
 * ser reproduzível byte a byte entre execuções.
 */
export function celulas(): readonly Celula[] {
  const saida: Celula[] = [];
  for (const entidade of ENTIDADES_ARMAZENADAS) {
    for (const area of AREAS_ARMAZENADAS) {
      for (const modalidade of MODALIDADES_ARMAZENADAS) {
        saida.push({ entidade, area, modalidade });
      }
    }
  }
  return saida;
}
