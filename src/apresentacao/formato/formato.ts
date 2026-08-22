/**
 * O unico modulo de formatacao do produto (T-125).
 *
 * Regra de contrato 2 (PRD secao 9.2): o valor viaja com unidade e a formatacao
 * acontece **so** na apresentacao. Regra da secao 13: pt-BR, virgula decimal,
 * ponto de milhar, R$ em milhoes com uma casa, data em mes/ano abreviado.
 *
 * Nada aqui usa `Intl`, `toLocaleString` nem depende do fuso do processo. Isso
 * e deliberado: o resultado precisa ser identico em qualquer maquina, com
 * qualquer TZ e qualquer LANG. `Intl` depende do ICU disponivel no runtime e
 * `Date` depende do fuso, e as duas coisas ja produziram diferenca entre a
 * maquina de quem desenvolve e o contentor de producao. Aqui a saida e funcao
 * apenas da entrada.
 *
 * Arredondamento acontece nesta camada e em nenhuma outra (PRD secao 13).
 */

/** As cinco unidades do contrato (PRD secao 9.2 regra 2). */
export type Unidade = "BRL_mi" | "pct" | "pp" | "dias" | "FTE";

const MESES = [
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

/** Casas decimais por unidade. `dias` e `FTE` sao contagens: inteiras. */
const CASAS: Readonly<Record<Unidade, number>> = {
  BRL_mi: 1,
  pct: 1,
  pp: 1,
  dias: 0,
  FTE: 0,
};

/**
 * Agrupa o inteiro com ponto de milhar e separa o decimal com virgula.
 * Recebe o numero ja arredondado, sem sinal.
 */
function agrupar(absoluto: string): string {
  const [inteiro = "0", decimal] = absoluto.split(".");
  const comMilhar = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return decimal === undefined ? comMilhar : `${comMilhar},${decimal}`;
}

function arredondar(
  valor: number,
  casas: number,
): { sinal: string; corpo: string } {
  if (!Number.isFinite(valor)) {
    throw new RangeError(
      `formatarValor recebeu um valor nao finito (${String(valor)}). ` +
        "Recorte sem dado e null com motivo, nunca NaN nem Infinity (principio P4).",
    );
  }
  const fixado = Math.abs(valor).toFixed(casas);
  // -0,04 arredondado para uma casa e 0,0: nao carrega sinal negativo.
  const zerado = /^0(?:[.,]0*)?$/.test(fixado);
  const sinal = valor < 0 && !zerado ? "-" : "";
  return { sinal, corpo: agrupar(fixado) };
}

/**
 * Formata um valor na unidade declarada pelo contrato de dados.
 *
 * `pp` sai sempre com sinal explicito porque e uma diferenca: "2,1 p.p." nao
 * diz se subiu ou desceu, e a secao 13 exige que cor nunca seja o unico sinal.
 */
export function formatarValor(valor: number, unidade: Unidade): string {
  const { sinal, corpo } = arredondar(valor, CASAS[unidade]);

  switch (unidade) {
    case "BRL_mi":
      return `${sinal}R$ ${corpo} mi`;
    case "pct":
      return `${sinal}${corpo}%`;
    case "pp":
      return `${sinal === "" && valor > 0 ? "+" : sinal}${corpo} p.p.`;
    case "dias":
      return `${sinal}${corpo} ${Math.abs(valor) === 1 ? "dia" : "dias"}`;
    case "FTE":
      return `${sinal}${corpo} FTE`;
  }
}

/**
 * Data de fechamento em mes/ano abreviado: `2026-12-31` vira `dez/2026`.
 *
 * Recebe a data no formato ISO como **texto** e le ano e mes do proprio texto.
 * Construir um `Date` aqui faria `2026-01-01` virar `dez/2025` a oeste de
 * Greenwich, que e exatamente o defeito que esta funcao existe para nao ter.
 */
export function formatarMesAno(iso: string): string {
  const partes = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(iso);
  if (partes?.[1] === undefined || partes[2] === undefined) {
    throw new RangeError(
      `formatarMesAno esperava uma data ISO (AAAA-MM-DD), recebeu "${iso}".`,
    );
  }
  const mes = Number(partes[2]);
  const nome = MESES[mes - 1];
  if (nome === undefined) {
    throw new RangeError(`Mes fora da faixa em "${iso}".`);
  }
  return `${nome}/${partes[1]}`;
}
