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
 * A PELE ATUAL (T-371) vem do painel de referencia que Produto entregou:
 * cinza neutro no lugar do sepia, e verde onde antes havia marrom. Os valores
 * saem dos tokens daquele arquivo, um a um; o que nao mudou foi o **papel** de
 * cada chave, e por isso os 369 pontos que pintam tela continuam iguais.
 *
 * AVISO DE CONTRASTE (PRD secao 13, verificado por T-183): a pele nova resolve
 * duas das tres dividas que o prototipo sepia carregava. Medidos agora:
 * `textoTerciario` 5,00:1 (era 3,91) e `textoEmBarraFraco` 6,17:1 (era 4,36)
 * **passam**. Continua abaixo do minimo de 4,5:1 apenas `textoFraco`, com
 * 2,48:1 sobre superficie — e ele e, por papel, o texto de dica e de campo
 * vazio, onde a fraqueza e o ponto. A decisao sobre ele segue pedida em H-43;
 * o que mudou e o tamanho da divida, nao a natureza dela.
 */

/** As 24 chaves da paleta, por papel na tela. */
export const PALETA = {
  // Superficies
  fundo: "#f7f8f8",
  superficie: "#ffffff",
  superficieAlta: "#f3f5f5",
  superficieSuave: "#eef0f1",
  barraLateral: "#0b0b0c",
  barraLateralBorda: "#292d31",

  // Texto
  texto: "#101113",
  textoSecundario: "#575c61",
  textoTerciario: "#6b7075",
  textoFraco: "#a0a5aa",
  textoEmBarra: "#e8eaea",
  textoEmBarraFraco: "#8b9196",

  // Bordas e linhas de grade
  borda: "#e1e4e6",
  bordaForte: "#cfd4d8",
  grade: "#e6e9eb",

  // Marca e destaque da IA
  marca: "#0f7c47",
  marcaEscura: "#0a5531",
  destaque: "#0071e3",
  destaqueSuave: "#2bb463",

  // Sentido do numero (PRD secao 13: cor nunca e o unico sinal)
  positivo: "#12844b",
  negativo: "#c4271f",
  neutro: "#7a8085",
  comparacao: "#4a5056",
  meta: "#b0790a",
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

/* ------------------------------------------------------------------ *
 * A camada viva: os cinco papeis que a empresa troca (D-MARCA)
 * ------------------------------------------------------------------ */

/**
 * Os papeis que a marca da empresa substitui.
 *
 * Cinco dos vinte e quatro, e a conta importa: os outros dezenove ficam. Fundo
 * e texto ficam porque sao o que sustenta a legibilidade medida; `positivo`,
 * `negativo`, `comparacao` e `meta` ficam porque **sao semanticos** — a secao
 * 13 diz que cor nunca e o unico sinal, e deixar o cliente escolher a cor de
 * "prejuizo" seria dar a marca o poder de mudar o que um numero significa.
 */
export const CHAVES_DE_MARCA = [
  "marca",
  "marcaEscura",
  "destaque",
  "destaqueSuave",
  "barraLateral",
] as const satisfies readonly ChaveDePaleta[];

export type ChaveDeMarca = (typeof CHAVES_DE_MARCA)[number];

/** As cinco cores de uma marca aplicada. */
export type CoresDaMarca = Readonly<Record<ChaveDeMarca, string>>;

/** O nome da propriedade CSS de um papel de marca. */
export function variavelDaMarca(chave: ChaveDeMarca): string {
  return `--bi-${chave}`;
}

/**
 * A camada que a moldura le, e que a empresa troca.
 *
 * Cada valor e uma propriedade CSS com **a cor de hoje como recuo**: sem marca
 * configurada, nenhum pixel muda. O layout raiz emite os valores resolvidos;
 * quando nao ha marca, nao emite nada e o recuo vale.
 *
 * ## Por que a moldura e o grafico leem de lugares diferentes
 *
 * `var()` **nao e substituido em atributo de apresentacao de SVG**: um
 * `stroke="var(--bi-marca, #6b4a2f)"` nao pinta, a linha some. E um SVG
 * serializado para fora do documento (T-409, T-410) perde o `:root` junto, o
 * que faria o PNG exportado sair com a cor errada em silencio.
 *
 * Entao a regra e de papel, e da para verificar por teste: **moldura le
 * `MARCA`, grafico le `PALETA`**. `sequencia.ts` e `DesenhoDePainel.tsx`
 * continuam na `PALETA`, e por isso a rampa categorica nao muda com a marca —
 * que e tambem a decisao de alcance de D-MARCA.
 *
 * ## Por que isto continua sendo constante de modulo
 *
 * Cinco componentes de cliente importam a paleta. Como o valor aqui e uma
 * propriedade CSS, e nao a cor resolvida, ele e identico no servidor e no
 * pacote do navegador: nao ha divergencia de hidratacao, e **a marca do
 * cliente nunca entra no pacote JavaScript**. Resolver a cor no servidor e
 * congela-la aqui perderia as duas coisas.
 */
export const MARCA: CoresDaMarca = {
  marca: `var(${variavelDaMarca("marca")}, ${PALETA.marca})`,
  marcaEscura: `var(${variavelDaMarca("marcaEscura")}, ${PALETA.marcaEscura})`,
  destaque: `var(${variavelDaMarca("destaque")}, ${PALETA.destaque})`,
  destaqueSuave: `var(${variavelDaMarca("destaqueSuave")}, ${PALETA.destaqueSuave})`,
  barraLateral: `var(${variavelDaMarca("barraLateral")}, ${PALETA.barraLateral})`,
};

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
