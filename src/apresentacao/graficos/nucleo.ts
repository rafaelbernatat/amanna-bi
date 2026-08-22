/**
 * Nucleo de dominio dos graficos (T-129).
 *
 * Desde a revisao de D4 (2026-08-22) quem desenha grade, eixo e rotulo e o
 * recharts. O que continua aqui e a parte que a biblioteca **nao** decide bem
 * sozinha e que o PRD exige que seja deterministica: o dominio do eixo, os
 * cortes de grade e o afinamento de rotulo.
 *
 * Tudo e funcao pura. Nao ha `document`, nao ha `window` e nao ha medicao —
 * essas funcoes rodam no servidor, e a mesma entrada produz a mesma saida.
 * E isso que faz o grafico nascer com a caixa certa e o CLS ficar em zero.
 */

/** Grade de 12 colunas do PRD (secao 5). */
const LARGURA_DE_REFERENCIA = 1150;
const COLUNAS = 12;
const ESPACO = 14;
const LARGURA_MINIMA = 160;

/**
 * Largura de referencia de um painel de `span` colunas.
 *
 * Nao e a largura final na tela — o grafico ocupa 100% da caixa. E a largura
 * usada para reservar a proporcao da caixa antes de o grafico montar, e para
 * decidir quantos rotulos cabem no eixo.
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
 * divisao por zero nem um grafico achatado contra a borda. Deixada por conta do
 * recharts, uma serie constante desenha uma linha colada no topo ou some; aqui
 * a faixa e aberta em torno do valor, e a funcao diz que isso aconteceu.
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

/** O que o recharts precisa receber para desenhar um eixo previsivel. */
export type ConfiguracaoDeEixo = {
  /** `domain` do YAxis: já tratado contra faixa nula. */
  readonly dominio: readonly [number, number];
  /** `ticks` do YAxis, para a grade não variar entre execuções. */
  readonly cortes: readonly number[];
  /** `interval` do XAxis: quantas categorias pular entre rótulos. */
  readonly intervaloDeRotulo: number;
  /** A série cruza o zero, então a linha de referência do zero é desenhada. */
  readonly temLinhaDeZero: boolean;
  /** A faixa era degenerada e precisou ser aberta. */
  readonly degenerada: boolean;
};

/**
 * Monta a configuracao de eixo a partir dos valores da serie.
 *
 * Deixar `domain` e `ticks` no automatico do recharts faria a grade mudar com o
 * dado e com a largura, e a comparacao de snapshot deixaria de valer. Aqui os
 * cortes sao calculados uma vez, no servidor.
 */
export function configuracaoDeEixo(entrada: {
  readonly valores: readonly number[];
  readonly categorias?: readonly string[];
  readonly divisoes?: number;
  readonly larguraDisponivel?: number;
  /** Força o eixo a começar no zero, como em painel de contagem. */
  readonly ancoradoNoZero?: boolean;
}): ConfiguracaoDeEixo {
  const divisoes = entrada.divisoes ?? 4;
  if (!Number.isInteger(divisoes) || divisoes < 1) {
    throw new RangeError(
      `divisoes precisa ser inteiro maior que zero, recebeu ${String(divisoes)}.`,
    );
  }

  const finitos = entrada.valores.filter((v) => Number.isFinite(v));
  if (finitos.length === 0) {
    throw new RangeError(
      "configuracaoDeEixo recebeu uma serie sem nenhum valor finito. " +
        "Serie vazia e estado 'sem dado neste recorte', nao grafico (principio PR-4).",
    );
  }

  let min = Math.min(...finitos);
  let max = Math.max(...finitos);
  if (entrada.ancoradoNoZero === true) {
    min = Math.min(0, min);
    max = Math.max(0, max);
  }

  const f = faixa(min, max);
  const amplitude = f.max - f.min;

  const cortes: number[] = [];
  for (let i = 0; i <= divisoes; i += 1) {
    cortes.push(arredondar(f.min + (amplitude * i) / divisoes));
  }

  const categorias = entrada.categorias ?? [];
  const largura = entrada.larguraDisponivel ?? larguraDoSpan(6);
  const passo =
    categorias.length === 0
      ? 1
      : passoDeRotulo(largura / categorias.length, categorias);

  return {
    dominio: [arredondar(f.min), arredondar(f.max)],
    cortes,
    // recharts conta `interval` como "quantos pular", nao "de quantos em quantos".
    intervaloDeRotulo: passo - 1,
    temLinhaDeZero: f.min < 0 && f.max > 0,
    degenerada: f.degenerada,
  };
}

/**
 * Duas casas nas coordenadas do eixo.
 *
 * Nao e arredondamento de valor de negocio — que a secao 13 do PRD proibe fora
 * da apresentacao. E o que impede o mesmo eixo de sair com `12.000000001` numa
 * maquina e `12` noutra, quebrando a comparacao por ruido de ponto flutuante.
 */
function arredondar(n: number): number {
  return Math.round(n * 100) / 100;
}
