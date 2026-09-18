/**
 * O mês que a pergunta nomeia: "qual o faturamento de março?".
 *
 * O filtro de período tem quatro valores, todos janelas que terminam em
 * dezembro (`MESES_DO_PERIODO`). "Março" não é nenhum deles, e antes disto a
 * pergunta caía no padrão: respondia os 12 meses de quem perguntou de um mês
 * só, sem avisar — número certo para a pergunta errada, que é o pior tipo.
 *
 * ## Por que não é um período novo
 *
 * Período é vocabulário da tela: filtro, URL, barra, contrato. Doze valores a
 * mais ali mudam o produto inteiro para servir a uma pergunta do chat. O dado
 * do mês já existe sem isso — `MetricValue.serie` é **a mesma métrica com a
 * mesma fórmula, avaliada num mês só** —, e é dele que o chat tira o ponto.
 * Nenhuma conta nova: o número de março do chat é o ponto de março do gráfico.
 *
 * ## Dezembro fica onde está
 *
 * "Dezembro" já é período, e a leitura por ele traz apoio e painel no mesmo
 * recorte. Um mês nomeado só é tratado aqui quando o filtro não o alcança.
 */

const NOMES = [
  "janeiro",
  "fevereiro",
  "marco",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

const ROTULOS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

/** A abreviação só vale colada ao ano, como o próprio chat escreve: "mar/2026". */
const ABREVIADOS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
] as const;

const DEZEMBRO = 11;

const POR_NOME = new RegExp(`\\b(${NOMES.join("|")})\\b`, "g");
const POR_ABREVIACAO = new RegExp(
  `\\b(${ABREVIADOS.join("|")})/20\\d{2}\\b`,
  "g",
);

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/** Os nomes de mês, sem acento, para quem precisa tirá-los da pergunta. */
export const NOMES_DE_MES: readonly string[] = NOMES;

/** Os meses que a pergunta nomeia, de 0 a 11, sem repetição, na ordem em que aparecem. */
export function mesesNomeados(pergunta: string): readonly number[] {
  const texto = normalizar(pergunta);
  const achados: { readonly onde: number; readonly indice: number }[] = [];
  for (const casamento of texto.matchAll(POR_NOME)) {
    const indice = NOMES.indexOf(casamento[1] as (typeof NOMES)[number]);
    achados.push({ onde: casamento.index, indice });
  }
  for (const casamento of texto.matchAll(POR_ABREVIACAO)) {
    const indice = ABREVIADOS.indexOf(
      casamento[1] as (typeof ABREVIADOS)[number],
    );
    achados.push({ onde: casamento.index, indice });
  }
  achados.sort((a, b) => a.onde - b.onde);
  return [...new Set(achados.map((a) => a.indice))];
}

/** Um mês só, que o filtro de período não alcança. */
export type MesNomeado = {
  /** De 0 (janeiro) a 10 (novembro): a posição na série de 12 meses do ano. */
  readonly indice: number;
  /** `2026-03`. */
  readonly codigo: string;
  /** "março de 2026", como o texto escreve. */
  readonly rotulo: string;
  /** O último dia do mês, `2026-03-31`: o fechamento do número. */
  readonly fechamento: string;
};

/**
 * O mês da pergunta, quando ela nomeia **um** mês e ele não é dezembro.
 *
 * Dois meses ou mais é série ou comparação, e quem responde é o laço
 * (`classificar`). Dezembro é o período que já existe.
 */
export function mesNomeado(pergunta: string, ano: string): MesNomeado | null {
  const meses = mesesNomeados(pergunta);
  const indice = meses[0];
  if (meses.length !== 1 || indice === undefined || indice === DEZEMBRO) {
    return null;
  }
  const mes = String(indice + 1).padStart(2, "0");
  const dia = new Date(Date.UTC(Number(ano), indice + 1, 0)).getUTCDate();
  return {
    indice,
    codigo: `${ano}-${mes}`,
    rotulo: `${ROTULOS[indice] ?? ""} de ${ano}`,
    fechamento: `${ano}-${mes}-${String(dia)}`,
  };
}
