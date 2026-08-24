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

/**
 * A unidade vem do contrato, e **nao e redeclarada aqui**.
 *
 * Este modulo declarava a propria copia com cinco valores. Quando D-H45
 * estendeu o enum para nove, o contrato mudou e a copia nao -- e `formatarValor`
 * passou a devolver `undefined` para `horas`, `contagem`, `pontos` e `anos`,
 * sem erro de compilacao e sem teste vermelho. A tela mostraria a palavra
 * "undefined" onde deveria haver numero.
 *
 * Duas declaracoes quase iguais lado a lado sao onde alguem atualiza uma e
 * esquece a outra. Agora ha uma so, e um teste percorre `UNIDADES` inteiro para
 * que a proxima unidade nao possa entrar sem formatacao.
 */
export type { Unidade } from "@/semantica/contrato";

import type { Unidade } from "@/semantica/contrato";

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

/**
 * Casas decimais por unidade.
 *
 * `dias`, `FTE`, `contagem` e `pontos` sao contagens: inteiras. `horas` leva uma
 * casa porque serve a dois usos de escala muito diferente -- 21.400 horas no ano
 * e 17,3 horas por FTE -- e zerar a casa perderia o segundo.
 */
const CASAS: Readonly<Record<Unidade, number>> = {
  BRL_mi: 1,
  pct: 1,
  pp: 1,
  dias: 0,
  FTE: 0,
  horas: 1,
  contagem: 0,
  pontos: 0,
  anos: 1,
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
    case "horas":
      return `${sinal}${corpo} h`;
    case "anos":
      return `${sinal}${corpo} ${Math.abs(valor) === 1 ? "ano" : "anos"}`;
    /*
     * `contagem` e `pontos` saem sem sufixo, e saem iguais.
     *
     * Nao e descuido: o eNPS se escreve como numero puro por convencao, e
     * "48 vagas" ja tem a palavra no rotulo do cartao. A diferenca entre as
     * duas unidades esta na **agregacao** -- contagem soma ao longo do periodo
     * e pontos nao -- e nao na aparencia.
     */
    case "contagem":
    case "pontos":
      return `${sinal}${corpo}`;
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
