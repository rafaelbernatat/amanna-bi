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
/**
 * As 24 chaves da pele clara, em valor literal.
 *
 * Literal, e nao propriedade CSS, porque tres coisas precisam do numero: a
 * conta de contraste, o teste que a fixa, e o **grafico** — `var()` nao pinta
 * atributo de SVG, e um SVG serializado perde o `:root` junto.
 */
export const PALETA_CLARA = {
  fundo: "#f7f8f8",
  superficie: "#ffffff",
  superficieAlta: "#f3f5f5",
  superficieSuave: "#eef0f1",
  barraLateral: "#0b0b0c",
  barraLateralBorda: "#292d31",
  texto: "#101113",
  textoSecundario: "#575c61",
  textoTerciario: "#6b7075",
  textoFraco: "#a0a5aa",
  textoEmBarra: "#e8eaea",
  textoEmBarraFraco: "#8b9196",
  borda: "#e1e4e6",
  bordaForte: "#cfd4d8",
  grade: "#e6e9eb",
  marca: "#0f7c47",
  marcaEscura: "#0a5531",
  destaque: "#0071e3",
  destaqueSuave: "#2bb463",
  positivo: "#12844b",
  negativo: "#c4271f",
  neutro: "#7a8085",
  comparacao: "#4a5056",
  meta: "#b0790a",
} as const;

/**
 * A mesma tabela na pele escura, tirada dos tokens do painel de referencia.
 *
 * Nao e a pele clara invertida: o referencia sobe a luminosidade das series
 * (o verde escuro vira claro) e baixa a das superficies, porque sobre fundo
 * escuro a cor saturada some e a clara canta. Por isso cada valor e escolhido,
 * e nao calculado.
 */
export const PALETA_ESCURA: Readonly<Record<ChaveDePaletaClara, string>> = {
  fundo: "#0b0b0c",
  superficie: "#16181a",
  superficieAlta: "#22262a",
  superficieSuave: "#1e2124",
  barraLateral: "#22262a",
  barraLateralBorda: "#3a3f44",
  texto: "#f5f6f6",
  textoSecundario: "#a7abaf",
  textoTerciario: "#8f9499",
  textoFraco: "#70757a",
  textoEmBarra: "#e3e6e8",
  textoEmBarraFraco: "#9aa0a5",
  borda: "#292d31",
  bordaForte: "#3a3f44",
  grade: "#2b2f33",
  marca: "#2bb463",
  marcaEscura: "#1c8f4c",
  destaque: "#4da3ff",
  destaqueSuave: "#6bfa9c",
  positivo: "#37d66d",
  negativo: "#ff6f62",
  neutro: "#8f9499",
  comparacao: "#b6bcc1",
  meta: "#e0a92a",
} as const;

export type ChaveDePaletaClara = keyof typeof PALETA_CLARA;

/** O nome da propriedade CSS daquele papel, na camada de tema. */
export function variavelDoTema(chave: ChaveDePaletaClara): string {
  return `--bi-t-${chave}`;
}

/**
 * A paleta que a **moldura** le, em propriedade CSS.
 *
 * Cada valor e um `var()` de tres degraus: a marca da empresa vence, depois o
 * tema ativo, e o recuo e a pele clara escrita aqui. E o que faz uma tela
 * inteira mudar de pele sem que nenhum dos 369 pontos que pintam saiba disso.
 *
 * O **grafico nao usa esta tabela**: ele recebe `PALETA_CLARA` ou
 * `PALETA_ESCURA` resolvida por propriedade, porque SVG nao resolve `var()`.
 */
export const PALETA = Object.freeze(
  Object.fromEntries(
    Object.entries(PALETA_CLARA).map(([chave, recuo]) => [
      chave,
      `var(--bi-${chave}, var(--bi-t-${chave}, ${recuo}))`,
    ]),
  ) as Record<ChaveDePaletaClara, string>,
);

/** Os dois temas, pelo nome que o cookie e o atributo do documento usam. */
export const TEMAS = ["claro", "escuro"] as const;
export type Tema = (typeof TEMAS)[number];

export function temaValido(candidato: string): candidato is Tema {
  return (TEMAS as readonly string[]).includes(candidato);
}

/** A tabela literal daquele tema, para o grafico e para a conta de contraste. */
export function paletaDoTema(
  tema: Tema,
): Readonly<Record<ChaveDePaletaClara, string>> {
  return tema === "escuro" ? PALETA_ESCURA : PALETA_CLARA;
}

/** As tres familias tipograficas carregadas pelo prototipo. */
export const TIPOGRAFIA = {
  /**
   * Corpo, rotulos e numeros de painel.
   *
   * Pilha de sistema, e nao fonte baixada: e o que o painel de referencia usa,
   * e a diferenca e concreta. Nenhum arquivo para servir, nenhuma requisicao
   * antes do primeiro texto aparecer, e nada que dependa de rede na hora de
   * uma apresentacao. O primeiro nome que existir na maquina vence, e todos os
   * sistemas alvo tem um.
   *
   * O tema anterior nomeava IBM Plex e Newsreader sem nunca as carregar — nao
   * havia `@font-face` nem link —, entao a rigor o produto ja rodava em fonte
   * de sistema, so que sem escolher qual.
   */
  texto:
    '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", system-ui, sans-serif',
  /** Rotulo de secao, unidade e eixo — sempre em caixa alta espacada. */
  mono: 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, "Roboto Mono", monospace',
  /** Titulo de tela e de painel. */
  titulo:
    '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter Tight", "Inter", system-ui, sans-serif',
} as const;

export type ChaveDePaleta = ChaveDePaletaClara;
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
/*
 * Desde T-372 estes cinco coincidem com `PALETA`.
 *
 * A cadeia de `PALETA` ja comeca pela variavel da marca — `var(--bi-marca,
 * var(--bi-t-marca, claro))` —, entao repetir a camada aqui produziria um
 * `var()` dentro do outro sem mudar o resultado.
 *
 * O nome continua existindo porque o que a arquitetura fixa e a **regra**, nao
 * o valor: moldura le `MARCA`, grafico le a pele literal que recebe por
 * propriedade. Um dia a marca pode ganhar comportamento proprio por tema, e
 * entao os dois deixam de coincidir sem que nenhum componente mude.
 */
export const MARCA: CoresDaMarca = {
  marca: PALETA.marca,
  marcaEscura: PALETA.marcaEscura,
  destaque: PALETA.destaque,
  destaqueSuave: PALETA.destaqueSuave,
  barraLateral: PALETA.barraLateral,
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
