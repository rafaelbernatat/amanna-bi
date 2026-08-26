/**
 * As contrapartes de contas a receber e a pagar, e as naturezas de saída
 * de caixa (T-118.1).
 *
 * ## Por que a contraparte importa
 *
 * `vw_fato_contas` dizia "R$ 53 mi vencidos". É um número. Com a contraparte,
 * a mesma view diz "três clientes concentram 66 % do vencido" — que é uma lista
 * de ligações a fazer. Os painéis `cr-inadim` e `cp-fornec` existem para essa
 * diferença.
 *
 * ## O resíduo é declarado, e não escondido
 *
 * As seis contrapartes nomeadas de cada lado não são a carteira inteira. O
 * restante vai para `outros`, que existe justamente para a soma continuar
 * fechando com a coluna mensal — sem ele, o painel mostraria uma carteira menor
 * do que a que o balanço registra, e ninguém notaria porque o painel só desenha
 * as maiores.
 */

import {
  FAIXAS_DE_AGING,
  SAIDAS_MENSAL,
} from "@/acesso/fixtures/referencia-fin";

/** Uma contraparte com o peso que ela tem no saldo. */
export type Contraparte = {
  readonly codigo: string;
  readonly rotulo: string;
  readonly peso: number;
};

/**
 * Clientes com saldo a receber, do maior para o menor.
 *
 * Os pesos reproduzem a concentração que o protótipo mostra em `cr-inadim` —
 * os três maiores respondendo por dois terços do vencido. `outros` carrega o
 * resto da carteira.
 */
export const CLIENTES_A_RECEBER: readonly Contraparte[] = [
  { codigo: "cliente-a", rotulo: "Cliente A", peso: 42 },
  { codigo: "cliente-b", rotulo: "Cliente B", peso: 31 },
  { codigo: "cliente-c", rotulo: "Cliente C", peso: 24 },
  { codigo: "cliente-d", rotulo: "Cliente D", peso: 18 },
  { codigo: "cliente-e", rotulo: "Cliente E", peso: 14 },
  { codigo: "cliente-f", rotulo: "Cliente F", peso: 11 },
  { codigo: "outros-clientes", rotulo: "Demais clientes", peso: 390 },
];

/** Fornecedores com saldo a pagar, do maior para o menor. */
export const FORNECEDORES_A_PAGAR: readonly Contraparte[] = [
  { codigo: "fornecedor-1", rotulo: "Fornecedor 1", peso: 220 },
  { codigo: "fornecedor-2", rotulo: "Fornecedor 2", peso: 170 },
  { codigo: "fornecedor-3", rotulo: "Fornecedor 3", peso: 140 },
  { codigo: "fornecedor-4", rotulo: "Fornecedor 4", peso: 110 },
  { codigo: "fornecedor-5", rotulo: "Fornecedor 5", peso: 90 },
  { codigo: "fornecedor-6", rotulo: "Fornecedor 6", peso: 70 },
  { codigo: "outros-fornecedores", rotulo: "Demais fornecedores", peso: 210 },
];

/**
 * As naturezas de saída de caixa.
 *
 * `vw_fato_fin_mes` traz a saída como um número só, e o painel `cx-cat` existe
 * para dizer de que ela é feita: o desembolso com juros ao lado do desembolso
 * com pessoal é uma comparação que o total esconde.
 *
 * Os pesos são as proporções do protótipo. **O mapeamento conta a conta é
 * H-56** — inclusive a pergunta de se juros entram por caixa ou por
 * competência, que muda a leitura do painel inteiro.
 */
export const NATUREZAS_DE_SAIDA: readonly Contraparte[] = [
  { codigo: "materia-prima", rotulo: "Matéria-prima", peso: 396 },
  { codigo: "pessoal", rotulo: "Pessoal", peso: 186 },
  { codigo: "juros", rotulo: "Juros", peso: 160 },
  { codigo: "servicos", rotulo: "Serviços de terceiros", peso: 118 },
  { codigo: "impostos", rotulo: "Impostos", peso: 96 },
  { codigo: "fretes", rotulo: "Fretes e logística", peso: 74 },
  { codigo: "marketing", rotulo: "Marketing", peso: 42 },
  { codigo: "outras-saidas", rotulo: "Outras saídas", peso: 58 },
];

/** O rótulo de uma contraparte ou natureza, para o eixo do painel. */
export function rotuloDe(
  lista: readonly Contraparte[],
  codigo: string,
): string {
  return lista.find((c) => c.codigo === codigo)?.rotulo ?? codigo;
}

/** Só para o teste de coerência: as faixas e os meses que a fixture cobre. */
export const FAIXAS = FAIXAS_DE_AGING.map((f) => f.codigo);
export const MESES_DE_SAIDA = SAIDAS_MENSAL.length;
