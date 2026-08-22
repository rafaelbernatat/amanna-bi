/**
 * Nucleo de geometria dos graficos (T-129).
 *
 * Tudo aqui e funcao pura: mesma entrada, mesma saida. Nao ha `document`, nao
 * ha `window`, nao ha medicao de largura e nao ha biblioteca de graficos — o
 * PRD (secao 8.2) fecha o vocabulario visual em 12 formas e manda desenhar SVG
 * no servidor.
 *
 * O prototipo calcula a largura do painel a partir de `state.W`, a largura
 * medida da janela (`cw()`), e por isso precisa de medicao no cliente. Aqui a
 * largura do `viewBox` e derivada apenas do `span` da grade de 12 colunas: o
 * SVG nasce com uma caixa fixa e escala sozinho por `preserveAspectRatio`.
 * E isso que faz o CLS ser zero — nada e remedido depois de pintar.
 */

/** Margens internas do desenho, em unidades do viewBox. */
export type Margens = {
  readonly esquerda: number;
  readonly direita: number;
  readonly topo: number;
  readonly base: number;
};

export type LinhaDeGrade = {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  /** A linha do zero recebe enfase: min < 0 < max (PRD secao 13, precisao). */
  readonly zero: boolean;
};

export type RotuloDeEixo = {
  readonly x: number;
  readonly y: number;
  readonly texto: string;
};

export type Eixo = {
  readonly largura: number;
  readonly altura: number;
  readonly larguraInterna: number;
  readonly alturaInterna: number;
  readonly margens: Margens;
  readonly grade: readonly LinhaDeGrade[];
  readonly rotulos: readonly RotuloDeEixo[];
  /** Converte um valor do dominio em coordenada y do viewBox. */
  readonly y: (valor: number) => number;
  /** Converte um indice de categoria no centro da faixa dela. */
  readonly xDaCategoria: (indice: number, total: number) => number;
  readonly viewBox: string;
};

/** Grade de 12 colunas do PRD (secao 5), em unidades do viewBox. */
const LARGURA_DE_REFERENCIA = 1150;
const COLUNAS = 12;
const ESPACO = 14;
const LARGURA_MINIMA = 160;

/**
 * Largura do viewBox para um painel de `span` colunas.
 *
 * Deterministica de proposito: nao depende da janela. Um painel de span 4
 * sempre nasce com a mesma caixa, em qualquer tela, e o navegador escala.
 */
export function larguraDoSpan(span: number): number {
  if (!Number.isInteger(span) || span < 1 || span > COLUNAS) {
    throw new RangeError(
      `span precisa ser um inteiro de 1 a ${COLUNAS}, recebeu ${String(span)}.`,
    );
  }
  const coluna = (LARGURA_DE_REFERENCIA - (COLUNAS - 1) * ESPACO) / COLUNAS;
  return Math.max(
    LARGURA_MINIMA,
    Math.round(span * coluna + (span - 1) * ESPACO - 28),
  );
}

/**
 * Faixa efetiva do dominio.
 *
 * Faixa nula — todos os valores iguais, inclusive todos zero — nao pode virar
 * divisao por zero nem um grafico achatado contra a borda. A faixa e aberta em
 * torno do valor, e a funcao diz que isso aconteceu para quem desenha decidir.
 */
export function faixa(
  min: number,
  max: number,
): {
  readonly min: number;
  readonly max: number;
  readonly degenerada: boolean;
} {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    throw new RangeError("faixa recebeu um limite nao finito.");
  }
  if (min > max) {
    throw new RangeError(`faixa invertida: min ${min} maior que max ${max}.`);
  }
  if (min !== max) return { min, max, degenerada: false };

  // Valor unico: abre um por cento para cada lado, ou uma unidade se for zero.
  const folga = min === 0 ? 1 : Math.abs(min) / 100;
  return { min: min - folga, max: max + folga, degenerada: true };
}

/**
 * Passo de rotulo: de quantas em quantas categorias um rotulo aparece.
 *
 * Porta o `labStep` do prototipo. A largura do texto e estimada por contagem de
 * caracteres, e nao medida no DOM — e o que mantem o resultado igual no
 * servidor e no navegador.
 */
const LARGURA_POR_CARACTERE = 5.7;

export function passoDeRotulo(
  larguraDaFaixa: number,
  categorias: readonly string[],
): number {
  const maior = categorias.reduce((m, c) => Math.max(m, c.length), 0);
  if (maior === 0) return 1;
  return Math.max(
    1,
    Math.ceil(
      (maior * LARGURA_POR_CARACTERE + 5) / Math.max(larguraDaFaixa, 1),
    ),
  );
}

/** Rotulos que sobrevivem ao passo, mantendo sempre o primeiro e o ultimo. */
export function rotulosVisiveis(
  categorias: readonly string[],
  passo: number,
): readonly string[] {
  if (categorias.length === 0) return [];
  return categorias.map((c, i) =>
    i % passo === 0 || i === categorias.length - 1 ? c : "",
  );
}

/**
 * Monta grade, escala e rotulos de um painel cartesiano.
 *
 * Porta o `ax()` do prototipo, com duas diferencas: a faixa degenerada e
 * tratada antes de dividir, e a linha do zero e marcada em vez de duplicada.
 */
export function eixo(entrada: {
  readonly largura: number;
  readonly altura: number;
  readonly margens: Margens;
  readonly min: number;
  readonly max: number;
  readonly divisoes?: number;
  readonly formatar: (valor: number) => string;
}): Eixo {
  const { largura, altura, margens, formatar } = entrada;
  const divisoes = entrada.divisoes ?? 4;

  if (!Number.isInteger(divisoes) || divisoes < 1) {
    throw new RangeError(
      `divisoes precisa ser inteiro maior que zero, recebeu ${String(divisoes)}.`,
    );
  }

  const larguraInterna = largura - margens.esquerda - margens.direita;
  const alturaInterna = altura - margens.topo - margens.base;
  if (larguraInterna <= 0 || alturaInterna <= 0) {
    throw new RangeError(
      "as margens nao cabem dentro da caixa: area interna nao positiva.",
    );
  }

  const f = faixa(entrada.min, entrada.max);
  const amplitude = f.max - f.min;

  const y = (valor: number): number =>
    margens.topo +
    alturaInterna -
    ((valor - f.min) / amplitude) * alturaInterna;

  const grade: LinhaDeGrade[] = [];
  const rotulos: RotuloDeEixo[] = [];

  for (let i = 0; i <= divisoes; i += 1) {
    const valor = f.min + (amplitude * i) / divisoes;
    const linha = arredondar(y(valor));
    grade.push({
      x1: margens.esquerda,
      y1: linha,
      x2: largura - margens.direita,
      y2: linha,
      zero: false,
    });
    rotulos.push({
      x: margens.esquerda - 7,
      y: arredondar(linha + 3.5),
      texto: formatar(valor),
    });
  }

  if (f.min < 0 && f.max > 0) {
    const linha = arredondar(y(0));
    grade.push({
      x1: margens.esquerda,
      y1: linha,
      x2: largura - margens.direita,
      y2: linha,
      zero: true,
    });
  }

  const xDaCategoria = (indice: number, total: number): number => {
    if (total <= 0) return margens.esquerda;
    const faixaDaCategoria = larguraInterna / total;
    return arredondar(
      margens.esquerda + faixaDaCategoria * indice + faixaDaCategoria / 2,
    );
  };

  return {
    largura,
    altura,
    larguraInterna,
    alturaInterna,
    margens,
    grade,
    rotulos,
    y: (valor: number) => arredondar(y(valor)),
    xDaCategoria,
    viewBox: `0 0 ${largura} ${altura}`,
  };
}

/**
 * Duas casas decimais nas coordenadas.
 *
 * Nao e arredondamento de valor de negocio — que a secao 13 do PRD proibe fora
 * da apresentacao. E o que impede o mesmo desenho de sair com `y=12.000000001`
 * numa maquina e `y=12` noutra, quebrando a comparacao de snapshot por ruido
 * de ponto flutuante.
 */
function arredondar(n: number): number {
  return Math.round(n * 100) / 100;
}
