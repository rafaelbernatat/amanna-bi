/**
 * As derivações que o produto faz sobre números já lidos — e o modelo, nunca.
 *
 * Diferença, variação, participação. Cada uma sai com a fórmula escrita
 * (princípio PR-3) e com a unidade certa: diferença de porcentagens é ponto
 * percentual, diferença de reais é real. É o que permite ao texto dizer "R$
 * 12,0 mi acima do ano anterior" sem que o modelo faça a conta: a conta está
 * aqui, e o verificador confere o resultado como qualquer outro número do
 * envelope.
 *
 * Nada aqui multiplica linha: opera sobre agregados que a fronteira já
 * devolveu. A regra de recorte da seção 9.2 continua no motor de cálculo.
 */

import { formatarValor } from "@/apresentacao/formato/formato";
import type { Unidade } from "@/semantica/contrato";

/** Um número que nasceu aqui, com a fórmula que o produziu. */
export type Derivada = {
  readonly valor: number;
  readonly unidade: Unidade;
  readonly formatado: string;
  readonly formula: string;
};

/** A escala da porcentagem. */
const POR_CENTO = 100;

/** Diferença de porcentagem é ponto percentual; das demais, a própria unidade. */
export function unidadeDaDiferenca(unidade: Unidade): Unidade {
  return unidade === "pct" ? "pp" : unidade;
}

function derivada(valor: number, unidade: Unidade, formula: string): Derivada {
  return { valor, unidade, formatado: formatarValor(valor, unidade), formula };
}

/** `a − b`, na unidade da diferença. */
export function diferenca(
  a: number,
  b: number,
  unidade: Unidade,
  rotuloA = "a",
  rotuloB = "b",
): Derivada {
  return derivada(
    a - b,
    unidadeDaDiferenca(unidade),
    `${rotuloA} − ${rotuloB}`,
  );
}

/**
 * `(a − b) / |b|`, em porcentagem. `null` quando não há base.
 *
 * Só para o que é somável — valor, contagem, horas. Variação percentual de
 * uma porcentagem ("a margem cresceu 20%") é a frase que confunde reunião
 * inteira; para taxa, o que vale é a diferença em pontos percentuais.
 */
export function variacaoPercentual(
  a: number,
  b: number,
  rotuloA = "a",
  rotuloB = "b",
): Derivada | null {
  if (b === 0) return null;
  return derivada(
    ((a - b) / Math.abs(b)) * POR_CENTO,
    "pct",
    `(${rotuloA} − ${rotuloB}) / |${rotuloB}|`,
  );
}

/** `parte / total`, em porcentagem. `null` sem total. */
export function participacao(
  parte: number,
  total: number,
  rotuloDaParte = "parte",
): Derivada | null {
  if (total === 0) return null;
  return derivada(
    (parte / total) * POR_CENTO,
    "pct",
    `${rotuloDaParte} / total`,
  );
}

/** As unidades cuja variação percentual faz sentido: as que se somam. */
const SOMAVEIS: ReadonlySet<Unidade> = new Set<Unidade>([
  "BRL_mi",
  "FTE",
  "contagem",
  "horas",
]);

export function ehSomavel(unidade: Unidade): boolean {
  return SOMAVEIS.has(unidade);
}
