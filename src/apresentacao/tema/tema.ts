/**
 * Tema tipado — os tokens visuais do prototipo (T-124).
 *
 * Extraidos de `public/design/Dashboard BI v2.dc.html`, que e entrada somente
 * leitura. O prototipo nao tem paleta nomeada: as 68 cores vivem soltas em
 * atributos `style`. Este arquivo da nome a cada papel, e a regra de lint de
 * T-124 impede que uma cor volte a aparecer solta em qualquer outro arquivo.
 *
 * Este e o unico lugar do codigo onde um literal hexadecimal e permitido.
 *
 * AVISO DE CONTRASTE (PRD secao 13, verificado por T-183): tres tokens de texto
 * do prototipo ficam abaixo do minimo de 4.5:1 exigido pelo PRD —
 * `textoTerciario` (3,91:1), `textoFraco` (2,69:1 sobre superficie) e
 * `textoEmBarraFraco` (4,36:1 sobre a barra lateral). Os valores foram mantidos
 * fieis ao prototipo porque alterar a paleta e decisao de Produto, nao de
 * Engenharia; a decisao esta pedida no item H-43 de INSTRUCOES.md.
 */

/** As 24 chaves da paleta, por papel na tela. */
export const PALETA = {
  // Superficies
  fundo: "#f2eee7",
  superficie: "#ffffff",
  superficieAlta: "#fffdfa",
  superficieSuave: "#faf7f1",
  barraLateral: "#1a1510",
  barraLateralBorda: "#2b231a",

  // Texto
  texto: "#17130f",
  textoSecundario: "#4a423a",
  textoTerciario: "#8a7f74",
  textoFraco: "#a89c8e",
  textoEmBarra: "#f7f2e8",
  textoEmBarraFraco: "#8a7a66",

  // Bordas e linhas de grade
  borda: "#efe8de",
  bordaForte: "#e5ddd2",
  grade: "#ece5da",

  // Marca e destaque da IA
  marca: "#6b4a2f",
  marcaEscura: "#3d2b1d",
  destaque: "#8f6b45",
  destaqueSuave: "#b8853a",

  // Sentido do numero (PRD secao 13: cor nunca e o unico sinal)
  positivo: "#4d7a52",
  negativo: "#a8402f",
  neutro: "#6d5f4e",
  comparacao: "#3f5f8a",
  meta: "#b39069",
} as const;

/** As tres familias tipograficas carregadas pelo prototipo. */
export const TIPOGRAFIA = {
  /** Corpo, rotulos e numeros de painel. */
  texto: '"IBM Plex Sans", system-ui, sans-serif',
  /** Rotulo de secao, unidade e eixo — sempre em caixa alta espacada. */
  mono: '"IBM Plex Mono", ui-monospace, monospace',
  /** Titulo de tela e de painel. */
  titulo: "Newsreader, Georgia, serif",
} as const;

export type ChaveDePaleta = keyof typeof PALETA;
export type ChaveDeTipografia = keyof typeof TIPOGRAFIA;

/**
 * Pares texto/fundo que a interface realmente usa. T-183 computa a razao de
 * contraste de cada um; declarar o par aqui e o que torna aquela verificacao
 * possivel sem adivinhacao.
 */
export const PARES_DE_CONTRASTE: ReadonlyArray<{
  readonly frente: ChaveDePaleta;
  readonly fundo: ChaveDePaleta;
}> = [
  { frente: "texto", fundo: "fundo" },
  { frente: "texto", fundo: "superficie" },
  { frente: "textoSecundario", fundo: "superficie" },
  { frente: "textoTerciario", fundo: "superficie" },
  { frente: "textoFraco", fundo: "superficie" },
  { frente: "marca", fundo: "superficie" },
  { frente: "destaque", fundo: "superficie" },
  { frente: "positivo", fundo: "superficie" },
  { frente: "negativo", fundo: "superficie" },
  { frente: "comparacao", fundo: "superficie" },
  { frente: "textoEmBarra", fundo: "barraLateral" },
  { frente: "textoEmBarraFraco", fundo: "barraLateral" },
];
