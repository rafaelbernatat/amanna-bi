import { PALETA, TIPOGRAFIA } from "@/apresentacao/tema/tema";

/**
 * Primitiva `mosaico-geografico` (T-165).
 *
 * Uma célula por UF, arrumadas numa grade que lembra o mapa do Brasil sem
 * ser um. Mapa de verdade traria projeção, fronteira e um arquivo de geometria
 * — e desenharia o Amazonas do tamanho de vinte São Paulos para representar um
 * headcount vinte vezes menor. A grade dá a mesma área a cada UF, que é o que
 * um painel de distribuição precisa afirmar.
 *
 * ## A grade mora aqui, e o dado não a carrega
 *
 * É constante cartográfica: igual em todo painel desta forma, em todo recorte e
 * em todo cliente. O envelope traz `{ uf, valor }` e mais nada — repetir a
 * posição em cada resposta seria convidar duas grades divergentes, uma por
 * adaptador, e ninguém descobriria até um estado aparecer no lugar errado.
 *
 * Server Component.
 */

/** Lado da grade: sete colunas por sete linhas cobrem as 27 UFs. */
const LADO_DA_GRADE = 7;

/**
 * Onde cada UF cai na grade: `[sigla, coluna, linha]`.
 *
 * Extraída do protótipo, que é onde o arranjo foi aprovado. A ordem é a de
 * leitura do mapa, de norte para sul.
 */
const GRADE_DE_UF: readonly (readonly [string, number, number])[] = [
  ["RR", 3, 1],
  ["AP", 4, 1],
  ["AM", 2, 2],
  ["PA", 3, 2],
  ["MA", 4, 2],
  ["CE", 5, 2],
  ["RN", 6, 2],
  ["AC", 1, 3],
  ["RO", 2, 3],
  ["TO", 3, 3],
  ["PI", 4, 3],
  ["PE", 5, 3],
  ["PB", 6, 3],
  ["MT", 3, 4],
  ["GO", 4, 4],
  ["BA", 5, 4],
  ["AL", 6, 4],
  ["SE", 7, 4],
  ["MS", 3, 5],
  ["DF", 4, 5],
  ["MG", 5, 5],
  ["ES", 6, 5],
  ["PR", 4, 6],
  ["SP", 5, 6],
  ["RJ", 6, 6],
  ["RS", 4, 7],
  ["SC", 5, 7],
];

/**
 * Opacidade mínima do preenchimento.
 *
 * Uma UF com o menor valor da série continua tendo dado, e uma célula
 * transparente a tornaria indistinguível de uma UF sem dado nenhuma — que é a
 * confusão entre vazio e zero que o princípio PR-4 existe para impedir.
 */
const OPACIDADE_MINIMA = 0.14;
const OPACIDADE_MAXIMA = 1;

/** A partir daqui o fundo é escuro demais para texto escuro. */
const LIMIAR_DE_TEXTO_CLARO = 0.55;

/** Largura máxima do mosaico, para as células não virarem placas. */
const LARGURA_MAXIMA = 330;

export type CelulaGeografica = {
  readonly uf: string;
  /**
   * Quão intensa é a UF contra a maior da série, de 0 a 1.
   *
   * `null` é "sem dado nesta UF" e não zero: a célula fica vazia (PR-4).
   */
  readonly intensidade: number | null;
  /** O valor já formatado em pt-BR, ou o travessão. */
  readonly texto: string;
};

export function MosaicoGeografico({
  celulas,
}: {
  readonly celulas: readonly CelulaGeografica[];
}) {
  const porUf = new Map(celulas.map((c) => [c.uf, c]));

  return (
    <div
      style={{
        height: "100%",
        display: "grid",
        gridTemplateColumns: `repeat(${String(LADO_DA_GRADE)}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${String(LADO_DA_GRADE)}, minmax(0, 1fr))`,
        gap: 4,
        maxWidth: LARGURA_MAXIMA,
        margin: "0 auto",
      }}
    >
      {GRADE_DE_UF.map(([uf, coluna, linha]) => {
        const celula = porUf.get(uf);
        const intensidade = celula?.intensidade ?? null;
        const opacidade =
          intensidade === null
            ? null
            : OPACIDADE_MINIMA +
              intensidade * (OPACIDADE_MAXIMA - OPACIDADE_MINIMA);
        const claro = opacidade !== null && opacidade >= LIMIAR_DE_TEXTO_CLARO;

        return (
          <div
            key={uf}
            data-uf={uf}
            style={{
              gridColumn: coluna,
              gridRow: linha,
              position: "relative",
              borderRadius: 7,
              border:
                opacidade === null ? `1px dashed ${PALETA.bordaForte}` : "none",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {opacidade === null ? null : (
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: 0,
                  bottom: 0,
                  background: PALETA.marca,
                  opacity: opacidade,
                }}
              />
            )}
            <span
              style={{
                position: "relative",
                font: `600 9.5px/1 ${TIPOGRAFIA.mono}`,
                color: claro ? PALETA.textoEmBarra : PALETA.texto,
              }}
            >
              {uf}
            </span>
            <span
              style={{
                position: "relative",
                font: `500 8px/1.3 ${TIPOGRAFIA.mono}`,
                color: claro ? PALETA.textoEmBarra : PALETA.textoTerciario,
              }}
            >
              {celula?.texto ?? ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}
