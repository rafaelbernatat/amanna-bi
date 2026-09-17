/**
 * O calendário de dias úteis, sem feriado.
 *
 * Morava em `fixtures/caixa-diario.ts`, porque a fixture o usava para gerar o
 * extrato. Mas o painel `cx-diario` também o usa — para escolher os últimos
 * trinta dias úteis da janela — e o painel não pode importar fixture: com a
 * base vinda do Postgres, a fixture nem está no grafo.
 *
 * Feriado nacional fica de fora de propósito. A base traz `dim_calendario`
 * com `dia_util` já descontando feriados, e o dia certo de usar é aquele; mas
 * o painel recorta **quais** dias mostrar, e não quanto vale cada um — um
 * feriado que apareça com barra vazia é informação, não erro.
 */

/** Dias de cada mês em ano comum. Fevereiro trata bissexto à parte. */
const DIAS_NO_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

const SABADO = 6;
const DOMINGO = 0;

/**
 * O dia da semana, em UTC.
 *
 * `Date.UTC` e não `new Date("2026-01-05")`: a segunda forma depende do fuso da
 * máquina para datas sem hora em alguns motores, e um calendário que muda
 * conforme o relógio de quem roda não é calendário.
 */
function diaDaSemana(ano: number, mes: number, dia: number): number {
  return new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
}

export function ehBissexto(ano: number): boolean {
  const QUATRO = 4;
  const CEM = 100;
  const QUATROCENTOS = 400;
  return (ano % QUATRO === 0 && ano % CEM !== 0) || ano % QUATROCENTOS === 0;
}

/** Quantos dias tem um mês `AAAA-MM`. */
export function diasDoMes(mes: string): number {
  const [anoTexto, mesTexto] = mes.split("-");
  const ano = Number(anoTexto);
  const numeroDoMes = Number(mesTexto);
  const FEVEREIRO = 2;
  return numeroDoMes === FEVEREIRO && ehBissexto(ano)
    ? (DIAS_NO_MES[1] ?? 0) + 1
    : (DIAS_NO_MES[numeroDoMes - 1] ?? 0);
}

/** Os dias úteis de um mês `AAAA-MM`, como `AAAA-MM-DD`, sem fim de semana. */
export function diasUteisDoMes(mes: string): readonly string[] {
  const [anoTexto, mesTexto] = mes.split("-");
  const ano = Number(anoTexto);
  const numeroDoMes = Number(mesTexto);
  const quantos = diasDoMes(mes);

  const dias: string[] = [];
  for (let dia = 1; dia <= quantos; dia += 1) {
    const semana = diaDaSemana(ano, numeroDoMes, dia);
    if (semana === SABADO || semana === DOMINGO) continue;
    dias.push(`${mes}-${dia < 10 ? `0${String(dia)}` : String(dia)}`);
  }
  return dias;
}
