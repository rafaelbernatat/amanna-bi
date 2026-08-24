/**
 * As séries de referência de Financeiro, transcritas do protótipo (T-111).
 *
 * Mesma origem e mesmo papel de `referencia-rh.ts`: o objeto `D` de
 * `public/design/Dashboard BI v2.dc.html`, somente leitura, aprovado
 * visualmente na Fase 0.
 *
 * ## O que foi conferido antes de transcrever
 *
 * O lado financeiro do dataset fecha **inteiro** — foi medido:
 *
 * | Conta | Resultado |
 * |---|---|
 * | `soma(receita)` | R$ 1.200 mi — o valor do Anexo C |
 * | `soma(receitaLY)` | R$ 1.068 mi, e `1200/1068 - 1` dá os +12,4% do Anexo C |
 * | `soma(ebitda)` | R$ 200 mi, e `200/1200` dá os 16,7% do Anexo C |
 * | ponte da DRE | `1200 - 720 - 280 = 200` e `200 - 60 - 140 - 8 = -8` |
 * | centros de custo | realizado 1.196, orçado 1.140, desvio **+56** |
 * | orçamento mensal | as séries mensais somam os mesmos 1.196 e 1.140 |
 * | ponte do caixa | `135 + 185 - 140 - 80 = 100` |
 * | entradas e saídas | `135 + (1.206 - 1.241) = 100` — o mesmo saldo final |
 * | receita por segmento | soma 1.200, a mesma receita |
 * | ciclo | `52 + 75 - 51 = 76` dias |
 *
 * ## A divergência
 *
 * **A série mensal de margem líquida não soma o lucro do ano.** Aplicando
 * `mLiq` mês a mês sobre a receita mensal chega-se a **-R$ 4,3 mi**, e a ponte
 * da DRE fecha em **-R$ 8 mi**. A escolha aqui é a mesma do turnover em RH: o
 * resultado mensal é **derivado dos componentes** — receita menos CMV menos
 * despesas menos D&A menos resultado financeiro — e a série `mLiq` do protótipo
 * não é transcrita. Guardá-la seria guardar uma taxa pronta que não se
 * recalcula sob recorte, que é o achado 5 do Anexo D.
 *
 * Registrada em [D-H03](../../../docs/decisoes/D-H03-modo-mockup.md).
 *
 * ## Uma diferença de rótulo, não de valor
 *
 * O Anexo C escreve o lucro líquido como `EBIT 140 - juros 140 - IR`; a ponte
 * do protótipo chama a última linha de "Não operacional" em vez de IR. Os
 * números são os mesmos e fecham nos dois textos, então não é divergência —
 * fica anotado para que a diferença de nome não vire discussão na reunião.
 */

/* ------------------------------------------------------------------ *
 * Resultado
 * ------------------------------------------------------------------ */

/** Receita líquida do mês, em R$ mi. Soma 1.200. */
export const RECEITA_LIQUIDA_MENSAL: readonly number[] = [
  88, 92, 96, 99, 104, 112, 104, 101, 98, 102, 101, 103,
];

/** Receita líquida do ano anterior, em R$ mi. Soma 1.068. */
export const RECEITA_LIQUIDA_ANO_ANTERIOR: readonly number[] = [
  78, 81, 86, 88, 92, 99, 93, 90, 88, 91, 90, 92,
];

/** EBITDA do mês, em R$ mi. Soma 200. */
export const EBITDA_MENSAL: readonly number[] = [
  14, 15, 16, 16, 17, 19, 18, 17, 16, 17, 17, 18,
];

/** Fluxo de caixa operacional do mês, em R$ mi. Soma 185. */
export const FCO_MENSAL: readonly number[] = [
  14, 15, 17, 15, 17, 20, 17, 18, 14, 14, 13, 11,
];

/** Margem bruta do mês, em %. Usada como peso da repartição do CMV. */
export const MARGEM_BRUTA_MENSAL: readonly number[] = [
  40.1, 40.3, 40.0, 39.8, 40.2, 40.6, 40.0, 39.7, 39.5, 39.9, 39.8, 40.1,
];

/**
 * A ponte da DRE do ano, em R$ mi.
 *
 * Cada degrau é uma linha do resultado. A soma dos degraus de dedução, a partir
 * da receita líquida, chega ao lucro líquido — e é assim que o painel
 * `fin-dre` desenha. Nenhum degrau é percentual: percentual é o que se calcula
 * depois, na apresentação.
 */
export const PONTE_DA_DRE = {
  receitaBruta: 1412,
  deducoes: 212,
  receitaLiquida: 1200,
  cmv: 720,
  despesasOperacionais: 280,
  ebitda: 200,
  depreciacaoEAmortizacao: 60,
  resultadoFinanceiro: 140,
  naoOperacional: 8,
  lucroLiquido: -8,
} as const;

/* ------------------------------------------------------------------ *
 * Caixa
 * ------------------------------------------------------------------ */

/** Entradas de caixa do mês, em R$ mi. Soma 1.206. */
export const ENTRADAS_MENSAL: readonly number[] = [
  92, 94, 98, 100, 105, 110, 103, 100, 99, 101, 100, 104,
];

/** Saídas de caixa do mês, em R$ mi. Soma 1.241. */
export const SAIDAS_MENSAL: readonly number[] = [
  96, 97, 99, 102, 104, 106, 105, 104, 105, 107, 108, 108,
];

/**
 * A ponte do fluxo de caixa do ano, em R$ mi.
 *
 * `135 + 185 - 140 - 80 = 100`, e o mesmo 100 sai de
 * `135 + (entradas - saídas)`. As duas leituras do caixa concordam, o que é o
 * mínimo para o painel `cx-saldo` e o `cx-ponte` não se contradizerem na mesma
 * tela.
 */
export const PONTE_DO_CAIXA = {
  saldoInicial: 135,
  fco: 185,
  /** Investimento — o capex do ano. */
  fci: -140,
  /** Financiamento — serviço da dívida líquido das captações. */
  fcf: -80,
  saldoFinal: 100,
} as const;

/* ------------------------------------------------------------------ *
 * Orçamento
 * ------------------------------------------------------------------ */

/** Orçado do mês, em R$ mi. Soma 1.140. */
export const ORCADO_MENSAL: readonly number[] = [
  94, 94, 95, 95, 95, 95, 95, 95, 95, 96, 95, 96,
];

/** Realizado do mês, em R$ mi. Soma 1.196. */
export const REALIZADO_MENSAL: readonly number[] = [
  92, 93, 96, 97, 98, 99, 100, 101, 103, 105, 106, 106,
];

/**
 * Os oito centros de custo do Anexo C.
 *
 * **Não são as sete áreas.** Sete deles têm o nome de uma área e o oitavo é
 * `Corporativo`, que não tem quadro próprio — é onde moram as despesas que não
 * pertencem a nenhuma área. Tratar centro de custo e área como a mesma
 * dimensão faria o rateio do Corporativo desaparecer ou virar uma oitava área
 * fantasma nos painéis de RH.
 */
export const CENTROS_DE_CUSTO: readonly {
  readonly codigo: string;
  readonly rotulo: string;
  /** Realizado do ano, em R$ mi. Soma 1.196. */
  readonly realizado: number;
  /** Orçado do ano, em R$ mi. Soma 1.140. */
  readonly orcado: number;
}[] = [
  { codigo: "operacoes", rotulo: "Operações", realizado: 412, orcado: 386 },
  { codigo: "comercial", rotulo: "Comercial", realizado: 198, orcado: 184 },
  { codigo: "tecnologia", rotulo: "Tecnologia", realizado: 154, orcado: 143 },
  { codigo: "logistica", rotulo: "Logística", realizado: 132, orcado: 126 },
  { codigo: "financeiro", rotulo: "Financeiro", realizado: 96, orcado: 99 },
  { codigo: "corporativo", rotulo: "Corporativo", realizado: 88, orcado: 78 },
  { codigo: "marketing", rotulo: "Marketing", realizado: 74, orcado: 79 },
  { codigo: "rh", rotulo: "RH", realizado: 42, orcado: 45 },
];

/* ------------------------------------------------------------------ *
 * Contas e ciclo
 * ------------------------------------------------------------------ */

/** As cinco faixas de aging, da mais nova para a mais velha. */
export const FAIXAS_DE_AGING: readonly {
  readonly codigo: string;
  readonly rotulo: string;
  /** Saldo a receber em dezembro, em R$ mi. Soma 171. */
  readonly aReceber: number;
  /** Saldo a pagar em dezembro, em R$ mi. Soma 101. */
  readonly aPagar: number;
}[] = [
  { codigo: "a-vencer", rotulo: "A vencer", aReceber: 118, aPagar: 74 },
  { codigo: "1-30d", rotulo: "1–30d", aReceber: 26, aPagar: 15 },
  { codigo: "31-60d", rotulo: "31–60d", aReceber: 12, aPagar: 7 },
  { codigo: "61-90d", rotulo: "61–90d", aReceber: 8, aPagar: 3 },
  { codigo: "mais-90d", rotulo: "> 90d", aReceber: 7, aPagar: 2 },
];

/** Dias do ano usados na conversão de saldo em prazo médio. */
export const DIAS_DO_ANO = 365;

/**
 * O estoque de dezembro, em R$ mi — **derivado**, não transcrito.
 *
 * O protótipo não tem série de estoque: ele mostra o PME de 75 dias já pronto.
 * Guardar 75 seria guardar um prazo que não se recalcula sob recorte, então o
 * caminho é o inverso — do prazo declarado sai o estoque que o produz:
 *
 * ```
 * PME = estoque / CMV × 365   →   estoque = 75 × 720 / 365 ≈ 148
 * ```
 *
 * As outras duas pontas do ciclo já fecham com os saldos que o protótipo tem:
 * `171 / 1.200 × 365 = 52,0` dias de PMR e `101 / 720 × 365 = 51,2` de PMP.
 * O estoque é a única peça que faltava, e ela sai da mesma fórmula.
 */
export const ESTOQUE_DEZEMBRO = 148;

/**
 * Os prazos médios do Anexo C, em dias. **Alvo de conferência, não fonte.**
 *
 * O produto calcula os três dos saldos e dos fluxos; estes valores existem para
 * o teste comparar. Se alguém passar a lê-los como dado, o KPI de ciclo volta a
 * ser um número fixo que ignora o recorte — o achado 5 do Anexo D.
 */
export const PRAZOS_DO_ANEXO_C = {
  pmr: 52,
  pme: 75,
  pmp: 51,
  ciclo: 76,
} as const;
