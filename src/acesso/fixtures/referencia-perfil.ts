/**
 * As medidas que faltavam, levantadas do protótipo (T-143).
 *
 * O achado 5 do Anexo D lista KPIs que o protótipo mostra **cravados**, sem
 * responder a filtro nenhum. Fazê-los responder exige que exista de onde
 * calculá-los — e é isso que este arquivo traz: as quebras de perfil do quadro
 * e as medidas que nenhuma das seis views de fato tinha.
 *
 * ## A contagem do achado 5
 *
 * O Anexo D escreve **15**. A medição do protótipo encontra **23**, e é o que o
 * registro de KPIs de T-145 já carrega em `constanteNoPrototipo`. A diferença
 * está registrada em **H-48**, aberto com Produto.
 *
 * Isso não trava esta tarefa, e a razão é aritmética: dar coluna de origem aos
 * **23** satisfaz "nenhuma das 15 fica sem coluna" com folga. Fazer pelos 15 do
 * texto é que deixaria oito sem origem.
 *
 * ## As quebras somam o quadro
 *
 * Cada uma das cinco quebras — idade, tempo de casa, escolaridade, UF e faixa
 * salarial — soma **1.240** em dezembro. Não é coincidência: são a mesma
 * empresa vista por cinco atributos, e uma que não somasse o mesmo total seria
 * uma quebra em que alguém foi contado duas vezes ou nenhuma.
 *
 * ## Uma divergência do protótipo, medida
 *
 * O KPI "Superior ou mais" mostra **48,9%**, e essa conta é
 * `(452 + 154) / 1.240` — Superior mais Pós-graduação, **sem Mestrado+**. Mas
 * mestrado é superior ou mais. A conta correta é `(452 + 154 + 34) / 1.240 =
 * 51,6%`, e é essa que a fixture produz.
 *
 * O outro número do mesmo cartão fecha: "12,4% com pós" é `154 / 1.240`
 * exatamente, sem mestrado — ali a exclusão é correta, porque pós-graduação é
 * um nível e não um piso. O autor aplicou a mesma exclusão nos dois lugares, e
 * ela só valia num.
 */

/* ------------------------------------------------------------------ *
 * As cinco quebras do quadro, em dezembro
 * ------------------------------------------------------------------ */

/** Uma quebra: o código do valor e quantas pessoas nele em dezembro. */
export type ParteDoQuadro = {
  readonly codigo: string;
  readonly headcount: number;
};

/** Faixa etária. Soma 1.240. */
export const QUADRO_POR_FAIXA_ETARIA: readonly ParteDoQuadro[] = [
  { codigo: "18-24", headcount: 138 },
  { codigo: "25-34", headcount: 486 },
  { codigo: "35-44", headcount: 372 },
  { codigo: "45-54", headcount: 174 },
  { codigo: "55-mais", headcount: 70 },
];

/** Tempo de casa. Soma 1.240. */
export const QUADRO_POR_TEMPO_DE_CASA: readonly ParteDoQuadro[] = [
  { codigo: "menos-de-1-ano", headcount: 268 },
  { codigo: "1-3-anos", headcount: 412 },
  { codigo: "3-5-anos", headcount: 291 },
  { codigo: "5-10-anos", headcount: 198 },
  { codigo: "10-mais-anos", headcount: 71 },
];

/** Escolaridade. Soma 1.240. Na ordem do cadastro, que é a de nível. */
export const QUADRO_POR_ESCOLARIDADE: readonly ParteDoQuadro[] = [
  { codigo: "medio", headcount: 386 },
  { codigo: "tecnico", headcount: 214 },
  { codigo: "superior", headcount: 452 },
  { codigo: "pos-graduacao", headcount: 154 },
  { codigo: "mestrado-mais", headcount: 34 },
];

/** UF. Soma 1.240, em doze estados. */
export const QUADRO_POR_UF: readonly ParteDoQuadro[] = [
  { codigo: "SP", headcount: 468 },
  { codigo: "MG", headcount: 152 },
  { codigo: "PR", headcount: 124 },
  { codigo: "RJ", headcount: 112 },
  { codigo: "SC", headcount: 96 },
  { codigo: "RS", headcount: 88 },
  { codigo: "BA", headcount: 62 },
  { codigo: "PE", headcount: 44 },
  { codigo: "GO", headcount: 34 },
  { codigo: "CE", headcount: 28 },
  { codigo: "ES", headcount: 18 },
  { codigo: "DF", headcount: 14 },
];

/** Faixa salarial. Soma 1.240. */
export const QUADRO_POR_FAIXA_SALARIAL: readonly ParteDoQuadro[] = [
  { codigo: "ate-3k", headcount: 214 },
  { codigo: "3-6k", headcount: 402 },
  { codigo: "6-10k", headcount: 328 },
  { codigo: "10-18k", headcount: 196 },
  { codigo: "18-30k", headcount: 76 },
  { codigo: "acima-30k", headcount: 24 },
];

/** As cinco quebras, pelo nome da dimensão que cada uma usa. */
export const QUEBRAS_DO_QUADRO = {
  faixa_etaria: QUADRO_POR_FAIXA_ETARIA,
  tempo_de_casa: QUADRO_POR_TEMPO_DE_CASA,
  escolaridade: QUADRO_POR_ESCOLARIDADE,
  uf: QUADRO_POR_UF,
  faixa_salarial: QUADRO_POR_FAIXA_SALARIAL,
} as const;

export type NomeDeQuebra = keyof typeof QUEBRAS_DO_QUADRO;

/* ------------------------------------------------------------------ *
 * As médias que viram soma
 * ------------------------------------------------------------------ */

/**
 * Média não se armazena: armazena-se a soma e conta-se o denominador.
 *
 * "Idade média 34,2 anos" guardado assim é o achado 5 em forma de coluna — um
 * número que não sabe recalcular-se sob recorte. O que entra na fixture é a
 * **soma das idades**, e a média sai dela dividida pelo quadro. Sob recorte de
 * Tecnologia, as duas parcelas mudam e a média muda junto.
 */
export const IDADE_MEDIA = 34.2;
export const TEMPO_MEDIO_DE_CASA = 3.1;

/** Tempo de casa na saída, em anos. Denominador: os desligamentos, não o quadro. */
export const TEMPO_MEDIO_ATE_A_SAIDA = 2.1;

/* ------------------------------------------------------------------ *
 * Composição da folha
 * ------------------------------------------------------------------ */

/**
 * As quatro parcelas da folha, em R$ mi. Somam 186 — a folha do Anexo C.
 *
 * O KPI "Encargos 37,5%" é `encargos / salarios`, e não `encargos / folha`.
 * A distinção é o que o próprio cartão do protótipo escreve no rodapé:
 * "R$ 42 mi sobre R$ 112 mi". Dividir pela folha daria 22,6%, e a diferença
 * apareceria numa negociação sindical.
 */
export const COMPOSICAO_DA_FOLHA: readonly {
  readonly codigo: string;
  readonly rotulo: string;
  readonly milhoes: number;
}[] = [
  { codigo: "salarios", rotulo: "Salários", milhoes: 112 },
  { codigo: "encargos", rotulo: "Encargos", milhoes: 42 },
  { codigo: "beneficios", rotulo: "Benefícios", milhoes: 21 },
  { codigo: "variavel", rotulo: "Variável", milhoes: 11 },
];

/* ------------------------------------------------------------------ *
 * Recrutamento e faturamento
 * ------------------------------------------------------------------ */

/** Custo por contratação, em reais. Multiplicado pelas 96 contratações do ano. */
export const CUSTO_POR_CONTRATACAO = 8600;

/**
 * Notas fiscais emitidas no ano.
 *
 * O ticket médio é `receita_liquida / notas_emitidas`, e dá R$ 65,2 mil —
 * exatamente o que o protótipo mostra. Sem a coluna de notas, o ticket seria um
 * número cravado que ignora o recorte.
 */
export const NOTAS_EMITIDAS = 18_400;

/**
 * Os dez maiores clientes, com receita e margem de contribuição.
 *
 * A soma das receitas é R$ 652 mi, e `652 / 1.200` dá os **54,3%** de
 * "Concentração top 10" do protótipo. O número existe para ser calculado, não
 * transcrito.
 */
export const TOP_CLIENTES: readonly {
  readonly codigo: string;
  /** Receita do ano, em R$ mi. */
  readonly receita: number;
  /** Margem de contribuição, em %. */
  readonly margem: number;
}[] = [
  { codigo: "c1", receita: 118, margem: 32.4 },
  { codigo: "c2", receita: 96, margem: 28.1 },
  { codigo: "c3", receita: 84, margem: 35.2 },
  { codigo: "c4", receita: 72, margem: 19.6 },
  { codigo: "c5", receita: 66, margem: 24.8 },
  { codigo: "c6", receita: 54, margem: 12.4 },
  { codigo: "c7", receita: 48, margem: 29.7 },
  { codigo: "c8", receita: 42, margem: 8.9 },
  { codigo: "c9", receita: 38, margem: 22.1 },
  { codigo: "c10", receita: 34, margem: 31.5 },
];
