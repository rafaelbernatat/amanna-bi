/**
 * Contraste, pela fórmula da WCAG 2.1 (PRD seção 13).
 *
 * > "Contraste mínimo 4.5:1 em texto. Cor nunca é o único sinal."
 *
 * Até aqui essa regra era um comentário: o cabeçalho de `tema.ts` traz três
 * razões medidas à mão — 3,91, 2,69 e 4,36 — e nada as recalcula. Este módulo
 * é o cálculo, e existe agora porque a marca da empresa chega de fora: uma cor
 * que ninguém revisou não pode ir para a tela sem alguém conferir se o texto
 * em cima dela ainda se lê.
 *
 * ## Por que mora no tema, e não com a marca
 *
 * A tarefa T-183 é exatamente "verificar contraste por cálculo sobre o tema".
 * Construir esta matemática dentro do módulo de marca criaria uma segunda
 * implementação da mesma fórmula, e a segunda é sempre a que discorda. Aqui,
 * T-183 consome o que já existe. O que este módulo **não** faz é decidir o que
 * acontece com os três tokens legados: isso é H-43, e é decisão de Produto.
 *
 * ## O que o ajuste faz, e o que ele não faz
 *
 * `ajustarParaContraste` caminha na **luminosidade** e preserva matiz e
 * saturação: a cor da empresa continua sendo a cor da empresa, só tão escura
 * (ou tão clara) quanto precisa para o texto se ler. Não inventa matiz, não
 * satura, não troca por uma cor "parecida" de uma tabela.
 *
 * E ele **propõe**; não aplica. Quem decide é a tela, com o antes e o depois à
 * vista. Corrigir em silêncio é o que `divergencias()` recusa fazer no chat, e
 * o motivo é o mesmo: a correção silenciosa esconde a frequência com que o
 * caso acontece.
 */

/** O mínimo que a seção 13 exige para texto. */
export const CONTRASTE_MINIMO = 4.5;

/** O maior contraste possível: preto sobre branco. */
export const CONTRASTE_MAXIMO = 21;

/** Cor aceita em toda a fronteira: hexadecimal de seis dígitos, caixa baixa. */
export const COR_CANONICA = /^#[0-9a-f]{6}$/;

/**
 * A cor está na forma canônica?
 *
 * A conferência é repetida na entrada e na emissão de propósito. O valor vem
 * de um site de terceiro e termina dentro de uma folha de estilo, e a política
 * de segurança tem `unsafe-inline` em estilo por dívida antiga (H-46): um
 * valor com chave de fechamento escreveria regra arbitrária na página. Aqui
 * não há sanitização — há recusa.
 */
export function corCanonica(valor: string): boolean {
  return COR_CANONICA.test(valor);
}

/** Uma cor decomposta, com cada canal de 0 a 255. */
type Canais = { readonly r: number; readonly g: number; readonly b: number };

const BASE_HEX = 16;
const MAXIMO_DO_CANAL = 255;

/**
 * Normaliza o que um site escreve para a forma canônica.
 *
 * Aceita `#abc`, `#AABBCC` e `rgb(1, 2, 3)`, que é o que aparece em folha de
 * estilo de verdade. Devolve `null` para tudo o mais — inclusive `rgba` com
 * transparência, que não tem cor sólida equivalente e não serve de marca.
 */
export function normalizarCor(bruta: string): string | null {
  const texto = bruta.trim().toLowerCase();

  const curta = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(texto);
  if (curta !== null) {
    const [, r = "", g = "", b = ""] = curta;
    return `#${r}${r}${g}${g}${b}${b}`;
  }

  if (COR_CANONICA.test(texto)) return texto;

  const funcional =
    /^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})\s*(?:[,/]\s*(\d*\.?\d+)\s*)?\)$/.exec(
      texto,
    );
  if (funcional === null) return null;

  // Transparente não é cor de marca: não há sobre o que medir contraste.
  const opacidade = funcional[4];
  if (opacidade !== undefined && Number(opacidade) < 1) return null;

  const canais = [funcional[1], funcional[2], funcional[3]].map((c) =>
    Number(c),
  );
  if (canais.some((c) => c > MAXIMO_DO_CANAL)) return null;

  return `#${canais.map((c) => c.toString(BASE_HEX).padStart(2, "0")).join("")}`;
}

function canaisDe(cor: string): Canais {
  if (!COR_CANONICA.test(cor)) {
    throw new CorForaDaForma(cor);
  }
  return {
    r: Number.parseInt(cor.slice(1, 3), BASE_HEX),
    g: Number.parseInt(cor.slice(3, 5), BASE_HEX),
    b: Number.parseInt(cor.slice(5, 7), BASE_HEX),
  };
}

function paraHex(canais: Canais): string {
  const digito = (valor: number): string =>
    Math.round(Math.min(MAXIMO_DO_CANAL, Math.max(0, valor)))
      .toString(BASE_HEX)
      .padStart(2, "0");
  return `#${digito(canais.r)}${digito(canais.g)}${digito(canais.b)}`;
}

/** A cor chegou fora da forma canônica onde a forma já era obrigatória. */
export class CorForaDaForma extends Error {
  constructor(readonly recebida: string) {
    super(
      `A cor '${recebida}' não está na forma canônica (#rrggbb em caixa baixa). ` +
        "Toda cor é normalizada na fronteira, com `normalizarCor`, antes de " +
        "chegar aqui — se este erro apareceu, alguém pulou a fronteira.",
    );
    this.name = "CorForaDaForma";
  }
}

/* ------------------------------------------------------------------ *
 * A fórmula
 * ------------------------------------------------------------------ */

/**
 * Os números da WCAG 2.1, escritos como a especificação os escreve.
 *
 * Não são grandeza de negócio nem valor exibido: são as constantes da
 * definição de luminância relativa. Trocá-las não é ajustar o produto, é
 * deixar de implementar o padrão.
 */
const LIMITE_DO_TRECHO_LINEAR = 0.03928;
const DIVISOR_LINEAR = 12.92;
const DESLOCAMENTO_GAMA = 0.055;
const DIVISOR_GAMA = 1.055;
const EXPOENTE_GAMA = 2.4;
const PESO_VERMELHO = 0.2126;
const PESO_VERDE = 0.7152;
const PESO_AZUL = 0.0722;
const CLAREAMENTO = 0.05;

function linearizar(canal: number): number {
  const proporcao = canal / MAXIMO_DO_CANAL;
  return proporcao <= LIMITE_DO_TRECHO_LINEAR
    ? proporcao / DIVISOR_LINEAR
    : Math.pow((proporcao + DESLOCAMENTO_GAMA) / DIVISOR_GAMA, EXPOENTE_GAMA);
}

/** A luminância relativa de uma cor: 0 no preto, 1 no branco. */
export function luminancia(cor: string): number {
  const { r, g, b } = canaisDe(cor);
  return (
    PESO_VERMELHO * linearizar(r) +
    PESO_VERDE * linearizar(g) +
    PESO_AZUL * linearizar(b)
  );
}

/**
 * A razão de contraste entre duas cores, de 1 a 21.
 *
 * Simétrica por construção: quem é frente e quem é fundo não muda o número.
 */
export function razaoDeContraste(uma: string, outra: string): number {
  const a = luminancia(uma);
  const b = luminancia(outra);
  const clara = Math.max(a, b);
  const escura = Math.min(a, b);
  return (clara + CLAREAMENTO) / (escura + CLAREAMENTO);
}

/** A razão alcança o mínimo? */
export function contrasteSuficiente(
  frente: string,
  fundo: string,
  minimo: number = CONTRASTE_MINIMO,
): boolean {
  return razaoDeContraste(frente, fundo) >= minimo;
}

/* ------------------------------------------------------------------ *
 * O ajuste
 * ------------------------------------------------------------------ */

/** O que o ajuste propõe, com o antes e o depois à vista. */
export type AjusteDeContraste = {
  /** O papel ajustado, como a paleta o nomeia. */
  readonly papel: string;
  readonly original: string;
  readonly ajustada: string;
  /** A cor contra a qual a razão foi medida. */
  readonly fundo: string;
  readonly razaoAntes: number;
  readonly razaoDepois: number;
  /** Falso quando nem o extremo alcança o mínimo: ver `ajustarParaContraste`. */
  readonly alcancou: boolean;
};

/* ------------------------------------------------------------------ *
 * sRGB ↔ HSL, para caminhar só na luminosidade
 * ------------------------------------------------------------------ */

type Hsl = { readonly h: number; readonly s: number; readonly l: number };

const GRAUS_DO_CIRCULO = 360;
const SEXTANTE = 60;
const DOIS = 2;
const SEIS = 6;
const TRES = 3;
const METADE = 0.5;

function paraHsl(cor: string): Hsl {
  const { r, g, b } = canaisDe(cor);
  const vermelho = r / MAXIMO_DO_CANAL;
  const verde = g / MAXIMO_DO_CANAL;
  const azul = b / MAXIMO_DO_CANAL;

  const maior = Math.max(vermelho, verde, azul);
  const menor = Math.min(vermelho, verde, azul);
  const amplitude = maior - menor;
  const l = (maior + menor) / DOIS;

  if (amplitude === 0) return { h: 0, s: 0, l };

  const s = amplitude / (1 - Math.abs(DOIS * l - 1));
  let h: number;
  if (maior === vermelho) {
    h = ((verde - azul) / amplitude) % SEIS;
  } else if (maior === verde) {
    h = (azul - vermelho) / amplitude + DOIS;
  } else {
    h = (vermelho - verde) / amplitude + (DOIS + DOIS);
  }
  h *= SEXTANTE;
  return { h: h < 0 ? h + GRAUS_DO_CIRCULO : h, s, l };
}

function deHsl({ h, s, l }: Hsl): string {
  const c = (1 - Math.abs(DOIS * l - 1)) * s;
  const setor = h / SEXTANTE;
  const x = c * (1 - Math.abs((setor % DOIS) - 1));
  const m = l - c / DOIS;

  const trio: readonly [number, number, number] =
    setor < 1
      ? [c, x, 0]
      : setor < DOIS
        ? [x, c, 0]
        : setor < TRES
          ? [0, c, x]
          : setor < TRES + 1
            ? [0, x, c]
            : setor < TRES + DOIS
              ? [x, 0, c]
              : [c, 0, x];

  return paraHex({
    r: (trio[0] + m) * MAXIMO_DO_CANAL,
    g: (trio[1] + m) * MAXIMO_DO_CANAL,
    b: (trio[2] + m) * MAXIMO_DO_CANAL,
  });
}

/**
 * O matiz de uma cor, de 0 a 360 graus.
 *
 * Exportado porque a escolha determinística das cores de marca precisa saber
 * quais candidatos são distantes entre si — dois tons do mesmo azul não fazem
 * uma paleta, fazem uma tela onde nada se distingue.
 */
export function matizDe(cor: string): number {
  return paraHsl(cor).h;
}

/** Quantos passos a busca binária dá. Dezesseis fecham a precisão de um canal. */
const PASSOS_DA_BUSCA = 16;

/**
 * Propõe a cor mais próxima da original que alcança o mínimo sobre o fundo.
 *
 * Caminha na luminosidade, preservando matiz e saturação, e vai na direção que
 * aumenta o contraste: se o fundo é claro, escurece; se é escuro, clareia. A
 * busca é binária entre a cor original e o extremo daquela direção, então
 * termina sempre e devolve o **menor** desvio que resolve — a cor da empresa,
 * mexida o mínimo possível.
 *
 * Quando nem o extremo alcança o mínimo, devolve o extremo com `alcancou`
 * falso. Isso acontece com fundo de luminância intermediária, onde nenhuma cor
 * chega a 4,5:1 — e a tela precisa dizer isso em vez de fingir que ajustou.
 * O que fazer nesse caso é decisão de Produto, registrada em H-43.
 */
export function ajustarParaContraste(
  papel: string,
  original: string,
  fundo: string,
  minimo: number = CONTRASTE_MINIMO,
): AjusteDeContraste {
  const razaoAntes = razaoDeContraste(original, fundo);
  const base = {
    papel,
    original,
    fundo,
    razaoAntes,
  } as const;

  if (razaoAntes >= minimo) {
    return {
      ...base,
      ajustada: original,
      razaoDepois: razaoAntes,
      alcancou: true,
    };
  }

  const { h, s } = paraHsl(original);
  const claraDemais = luminancia(fundo) > luminancia(original);
  // O extremo da direção que aumenta o contraste: preto sob fundo claro,
  // branco sob fundo escuro.
  const extremo = claraDemais ? 0 : 1;
  const corExtrema = deHsl({ h, s, l: extremo });

  if (razaoDeContraste(corExtrema, fundo) < minimo) {
    return {
      ...base,
      ajustada: corExtrema,
      razaoDepois: razaoDeContraste(corExtrema, fundo),
      alcancou: false,
    };
  }

  let perto = paraHsl(original).l;
  let longe = extremo;
  for (let passo = 0; passo < PASSOS_DA_BUSCA; passo += 1) {
    const meio = (perto + longe) * METADE;
    if (razaoDeContraste(deHsl({ h, s, l: meio }), fundo) >= minimo) {
      longe = meio;
    } else {
      perto = meio;
    }
  }

  const ajustada = deHsl({ h, s, l: longe });
  return {
    ...base,
    ajustada,
    razaoDepois: razaoDeContraste(ajustada, fundo),
    alcancou: true,
  };
}
