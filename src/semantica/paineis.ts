/**
 * O registro dos 71 painéis do Anexo A (T-107).
 *
 * É a lista de verificação da Fase 1: o Anexo A diz "cada painel precisa passar
 * pelo adaptador", e sem um registro conferível essa frase não tem como ser
 * cobrada. O teste que acompanha este arquivo lê o **Anexo A do PRD.md
 * diretamente** e compara — não uma cópia do Anexo, o Anexo. Se Produto
 * acrescentar um painel ao documento e ninguém registrar, a suíte avisa; se
 * alguém registrar um painel que o documento não tem, também.
 *
 * De onde vem cada campo:
 *
 * | Campo | Origem | Conferido contra |
 * |---|---|---|
 * | `id`, `titulo`, `tela` | Anexo A do PRD | o próprio documento |
 * | `forma` | construtor usado no protótipo | as 12 formas de T-102 |
 * | `span` | `span:` do protótipo | a grade de 12 colunas da seção 5 |
 * | `unidade` | `tag:` do protótipo, mapeada ao enum fechado | parcial, ver H-45 |
 *
 * ## `BRL_mi` em painel rotulado "R$ mil"
 *
 * Quatro painéis (`sal-medio`, `int-rpc`, `int-ebitda-pc`, `int-scatter`) trazem
 * `tag: 'R$ mil'` no protótipo e `unidade: "BRL_mi"` aqui. Não é erro de escala:
 * `BRL_mi` é a **única** unidade monetária do enum fechado da seção 9.2, e é a
 * unidade canônica do valor — a escala de exibição é escolha do formatador
 * (T-125), que mostra `R$ 7,5 mil` para `0,0075`.
 *
 * A armadilha, e é real: um adaptador que devolva `7,5` para "sete e meio mil"
 * erra por mil, e o tipo não tem como perceber. O Anexo C fixa a convenção
 * ("Receita por FTE · R$ 968 mil" = `0,968`), e a suíte de contrato de F2
 * precisa conferir a ordem de grandeza destes quatro contra ele.
 *
 * Mora em `semantica` e não em `apresentacao` porque é inventário de produto,
 * não de tela: quem precisa dele primeiro é o adaptador, que tem de servir os
 * 71. Por isso também **não importa a navegação** — a conferência entre registro
 * e rotas é do teste, que enxerga as duas camadas sem criar dependência de uma
 * na outra.
 *
 * **Fórmula e view não estão aqui, de propósito.** A seção 9.4 do PRD diz que a
 * fórmula mora no catálogo de métricas, e repeti-la aqui criaria duas fontes
 * para a mesma definição — que é exatamente como dois números diferentes
 * chegam à mesma reunião. O registro diz *qual painel existe e que forma tem*;
 * o catálogo diz *como o número é calculado*. Ver H-08.
 */

import type { Unidade } from "@/semantica/contrato";
import type { Forma } from "@/semantica/painel";

/** Uma linha do registro. */
export type RegistroDePainel = {
  readonly id: string;
  /** `modulo/tela`, como no Anexo A e nas rotas. */
  readonly tela: string;
  readonly titulo: string;
  readonly forma: Forma;
  /** Colunas ocupadas na grade de 12 (seção 5). */
  readonly span: number;
  /**
   * `null` quando o enum fechado da seção 9.2 não cobre a medida.
   *
   * Não é omissão: são doze painéis, e o conjunto exato está fixado em teste
   * para que só encolha por decisão. Sete são de forma `estatisticas`, onde
   * cada número já declara a própria unidade; os outros cinco medem horas,
   * candidatos, vagas e pontos de eNPS — que o enum não nomeia. Ver **H-45**.
   */
  readonly unidade: Unidade | null;
};

/**
 * Os 71 painéis, na ordem do Anexo A.
 *
 * A ordem é a do documento para que a conferência seja leitura lado a lado.
 */
export const REGISTRO_DE_PAINEIS: readonly RegistroDePainel[] = [
  {
    id: "rh-headcount",
    tela: "rh/visao",
    titulo: "Headcount nos últimos 12 meses",
    forma: "barras",
    span: 8,
    unidade: "FTE",
  },
  {
    id: "rh-turnover",
    tela: "rh/visao",
    titulo: "Turnover (12 meses)",
    forma: "linha",
    span: 4,
    unidade: "pct",
  },
  {
    id: "rh-retencao",
    tela: "rh/visao",
    titulo: "Retenção e saldo líquido de pessoas",
    forma: "barras",
    span: 8,
    unidade: "pct",
  },
  {
    id: "rh-flash",
    tela: "rh/visao",
    titulo: "Leitura rápida do período",
    forma: "estatisticas",
    span: 4,
    unidade: null,
  },
  {
    id: "rh-folha",
    tela: "rh/visao",
    titulo: "Folha total e custo por colaborador",
    forma: "barras",
    span: 6,
    unidade: "BRL_mi",
  },
  {
    id: "rh-areas",
    tela: "rh/visao",
    titulo: "Distribuição por área",
    forma: "barras-horizontais",
    span: 6,
    unidade: "FTE",
  },
  {
    id: "col-area",
    tela: "rh/colab",
    titulo: "Por área",
    forma: "barras-horizontais",
    span: 4,
    unidade: "FTE",
  },
  {
    id: "col-perfil",
    tela: "rh/colab",
    titulo: "Perfil do quadro",
    forma: "divisao",
    span: 4,
    unidade: "pct",
  },
  {
    id: "col-idade",
    tela: "rh/colab",
    titulo: "Por faixa etária",
    forma: "barras-horizontais",
    span: 4,
    unidade: "FTE",
  },
  {
    id: "col-tempo",
    tela: "rh/colab",
    titulo: "Tempo de empresa",
    forma: "barras",
    span: 8,
    unidade: "FTE",
  },
  {
    id: "col-escol",
    tela: "rh/colab",
    titulo: "Escolaridade",
    forma: "barras-horizontais",
    span: 4,
    unidade: "FTE",
  },
  {
    id: "col-mapa",
    tela: "rh/colab",
    titulo: "Distribuição geográfica por estado",
    forma: "mosaico-geografico",
    span: 8,
    unidade: "FTE",
  },
  {
    id: "col-geo",
    tela: "rh/colab",
    titulo: "Concentração geográfica",
    forma: "estatisticas",
    span: 4,
    unidade: null,
  },
  {
    id: "tov-12m",
    tela: "rh/turnover",
    titulo: "Taxa de turnover — 12 meses",
    forma: "linha",
    span: 8,
    unidade: "pct",
  },
  {
    id: "tov-tipos",
    tela: "rh/turnover",
    titulo: "Tipos de desligamento",
    forma: "rosca",
    span: 4,
    unidade: "pct",
  },
  {
    id: "tov-area",
    tela: "rh/turnover",
    titulo: "Turnover por área",
    forma: "barras-horizontais",
    span: 6,
    unidade: "pct",
  },
  {
    id: "tov-corte",
    tela: "rh/turnover",
    titulo: "Turnover por gênero e faixa etária",
    forma: "barras-horizontais",
    span: 6,
    unidade: "pct",
  },
  {
    id: "tov-resumo",
    tela: "rh/turnover",
    titulo: "Custo do turnover em reais",
    forma: "estatisticas",
    span: 4,
    unidade: null,
  },
  {
    id: "tov-custo",
    tela: "rh/turnover",
    titulo: "Custo financeiro do turnover",
    forma: "barras",
    span: 8,
    unidade: "BRL_mi",
  },
  {
    id: "rec-dias",
    tela: "rh/recrut",
    titulo: "Tempo médio de fechamento por mês",
    forma: "barras",
    span: 8,
    unidade: "dias",
  },
  {
    id: "rec-status",
    tela: "rh/recrut",
    titulo: "Status das vagas no ano",
    forma: "rosca",
    span: 4,
    unidade: "pct",
  },
  {
    id: "rec-funil",
    tela: "rh/recrut",
    titulo: "Pipeline de recrutamento",
    forma: "funil",
    span: 6,
    unidade: null,
  },
  {
    id: "rec-fontes",
    tela: "rh/recrut",
    titulo: "Fontes de aquisição de talentos",
    forma: "barras-horizontais",
    span: 6,
    unidade: "pct",
  },
  {
    id: "rec-tempo",
    tela: "rh/recrut",
    titulo: "Tempo médio de fechamento por área",
    forma: "barras-horizontais",
    span: 6,
    unidade: "dias",
  },
  {
    id: "rec-vagas",
    tela: "rh/recrut",
    titulo: "Vagas por status e área",
    forma: "barras-empilhadas",
    span: 6,
    unidade: null,
  },
  {
    id: "rec-resumo",
    tela: "rh/recrut",
    titulo: "Resumo do funil",
    forma: "estatisticas",
    span: 12,
    unidade: null,
  },
  {
    id: "tre-horas",
    tela: "rh/trein",
    titulo: "Horas de treinamento e participação",
    forma: "barras",
    span: 8,
    unidade: null,
  },
  {
    id: "tre-conclusao",
    tela: "rh/trein",
    titulo: "Conclusão das trilhas",
    forma: "rosca",
    span: 4,
    unidade: "pct",
  },
  {
    id: "tre-modal",
    tela: "rh/trein",
    titulo: "Horas por modalidade",
    forma: "divisao",
    span: 4,
    unidade: "pct",
  },
  {
    id: "tre-conclmod",
    tela: "rh/trein",
    titulo: "Conclusão por modalidade",
    forma: "barras-horizontais",
    span: 4,
    unidade: "pct",
  },
  {
    id: "tre-invest",
    tela: "rh/trein",
    titulo: "Investimento em desenvolvimento",
    forma: "estatisticas",
    span: 4,
    unidade: null,
  },
  {
    id: "tre-area",
    tela: "rh/trein",
    titulo: "Horas por área e investimento por trilha",
    forma: "barras-horizontais",
    span: 12,
    unidade: null,
  },
  {
    id: "eng-area",
    tela: "rh/engaj",
    titulo: "Engajamento por área",
    forma: "barras-horizontais",
    span: 8,
    unidade: "pct",
  },
  {
    id: "eng-cat",
    tela: "rh/engaj",
    titulo: "Categorias do eNPS",
    forma: "divisao",
    span: 4,
    unidade: "pct",
  },
  {
    id: "eng-enps",
    tela: "rh/engaj",
    titulo: "eNPS (12 meses)",
    forma: "linha",
    span: 4,
    unidade: null,
  },
  {
    id: "eng-eng",
    tela: "rh/engaj",
    titulo: "Engajamento (12 meses)",
    forma: "linha",
    span: 4,
    unidade: "pct",
  },
  {
    id: "eng-abs",
    tela: "rh/engaj",
    titulo: "Absenteísmo (12 meses)",
    forma: "linha",
    span: 4,
    unidade: "pct",
  },
  {
    id: "eng-clima",
    tela: "rh/engaj",
    titulo: "Resumo de clima",
    forma: "estatisticas",
    span: 12,
    unidade: null,
  },
  {
    id: "sal-medio",
    tela: "rh/sal",
    titulo: "Salário médio por área",
    forma: "barras-horizontais",
    span: 8,
    unidade: "BRL_mi",
  },
  {
    id: "sal-comp",
    tela: "rh/sal",
    titulo: "Composição da folha",
    forma: "rosca",
    span: 4,
    unidade: "pct",
  },
  {
    id: "sal-folha",
    tela: "rh/sal",
    titulo: "Folha por área",
    forma: "barras-horizontais",
    span: 6,
    unidade: "BRL_mi",
  },
  {
    id: "sal-faixas",
    tela: "rh/sal",
    titulo: "Faixas salariais",
    forma: "barras",
    span: 6,
    unidade: "FTE",
  },
  {
    id: "sal-benef",
    tela: "rh/sal",
    titulo: "Benefícios e encargos",
    forma: "barras-horizontais",
    span: 8,
    unidade: "BRL_mi",
  },
  {
    id: "sal-resumo",
    tela: "rh/sal",
    titulo: "Indicadores de salário",
    forma: "estatisticas",
    span: 4,
    unidade: null,
  },
  {
    id: "fin-receita",
    tela: "fin/visao",
    titulo: "Receita líquida — ano atual vs. ano anterior",
    forma: "barras",
    span: 8,
    unidade: "BRL_mi",
  },
  {
    id: "fin-margens",
    tela: "fin/visao",
    titulo: "Margens (12 meses)",
    forma: "linha",
    span: 4,
    unidade: "pct",
  },
  {
    id: "fin-ebitda",
    tela: "fin/visao",
    titulo: "EBITDA mensal e conversão em caixa",
    forma: "barras",
    span: 5,
    unidade: "BRL_mi",
  },
  {
    id: "fin-dre",
    tela: "fin/visao",
    titulo: "Ponte da DRE — receita líquida ao lucro líquido",
    forma: "cascata",
    span: 7,
    unidade: "BRL_mi",
  },
  {
    id: "cx-diario",
    tela: "fin/caixa",
    titulo: "Movimentação diária — últimos 30 dias",
    forma: "barras",
    span: 12,
    unidade: "BRL_mi",
  },
  {
    id: "cx-ponte",
    tela: "fin/caixa",
    titulo: "Ponte do fluxo de caixa",
    forma: "cascata",
    span: 6,
    unidade: "BRL_mi",
  },
  {
    id: "cx-saldo",
    tela: "fin/caixa",
    titulo: "Saldo de caixa consolidado",
    forma: "linha",
    span: 6,
    unidade: "BRL_mi",
  },
  {
    id: "cx-fluxo",
    tela: "fin/caixa",
    titulo: "Entradas × saídas por mês",
    forma: "barras",
    span: 8,
    unidade: "BRL_mi",
  },
  {
    id: "cx-cat",
    tela: "fin/caixa",
    titulo: "Principais categorias de saída",
    forma: "barras-horizontais",
    span: 4,
    unidade: "BRL_mi",
  },
  {
    id: "orc-vs",
    tela: "fin/orc",
    titulo: "Orçado × Realizado por mês",
    forma: "barras",
    span: 8,
    unidade: "BRL_mi",
  },
  {
    id: "orc-desvio",
    tela: "fin/orc",
    titulo: "Desvio por centro de custo",
    forma: "barras",
    span: 4,
    unidade: "BRL_mi",
  },
  {
    id: "orc-gastos",
    tela: "fin/orc",
    titulo: "Gastos por centro de custo",
    forma: "barras-horizontais",
    span: 6,
    unidade: "BRL_mi",
  },
  {
    id: "orc-acum",
    tela: "fin/orc",
    titulo: "Orçamento acumulado × realizado",
    forma: "linha",
    span: 6,
    unidade: "BRL_mi",
  },
  {
    id: "ct-ciclo",
    tela: "fin/contas",
    titulo: "Ciclo de conversão de caixa",
    forma: "regua-de-ciclo",
    span: 12,
    unidade: "dias",
  },
  {
    id: "cr-aging",
    tela: "fin/contas",
    titulo: "Aging de contas a receber",
    forma: "barras",
    span: 6,
    unidade: "BRL_mi",
  },
  {
    id: "cp-aging",
    tela: "fin/contas",
    titulo: "Aging de contas a pagar",
    forma: "barras",
    span: 6,
    unidade: "BRL_mi",
  },
  {
    id: "cr-inadim",
    tela: "fin/contas",
    titulo: "Top clientes inadimplentes",
    forma: "barras-horizontais",
    span: 6,
    unidade: "BRL_mi",
  },
  {
    id: "cp-fornec",
    tela: "fin/contas",
    titulo: "Top fornecedores por saldo",
    forma: "barras-horizontais",
    span: 6,
    unidade: "BRL_mi",
  },
  {
    id: "fat-evolucao",
    tela: "fin/fat",
    titulo: "Evolução do faturamento",
    forma: "barras",
    span: 8,
    unidade: "BRL_mi",
  },
  {
    id: "fat-segm",
    tela: "fin/fat",
    titulo: "Carteira por segmento",
    forma: "rosca",
    span: 4,
    unidade: "pct",
  },
  {
    id: "fat-margem",
    tela: "fin/fat",
    titulo: "Margem de contribuição por cliente",
    forma: "dispersao",
    span: 6,
    unidade: "BRL_mi",
  },
  {
    id: "fat-risco",
    tela: "fin/fat",
    titulo: "Risco de crédito da carteira",
    forma: "barras-empilhadas",
    span: 6,
    unidade: "pct",
  },
  {
    id: "int-rpc",
    tela: "int/cruz",
    titulo: "Receita por colaborador",
    forma: "linha",
    span: 6,
    unidade: "BRL_mi",
  },
  {
    id: "int-ebitda-pc",
    tela: "int/cruz",
    titulo: "EBITDA per capita",
    forma: "barras",
    span: 6,
    unidade: "BRL_mi",
  },
  {
    id: "int-hc-desp",
    tela: "int/cruz",
    titulo: "Headcount versus despesa de pessoal",
    forma: "barras",
    span: 12,
    unidade: "BRL_mi",
  },
  {
    id: "int-scatter",
    tela: "int/cruz",
    titulo: "Custo de pessoal × retorno por área",
    forma: "dispersao",
    span: 6,
    unidade: "BRL_mi",
  },
  {
    id: "int-pct",
    tela: "int/cruz",
    titulo: "Despesa de pessoal sobre a receita",
    forma: "linha",
    span: 6,
    unidade: "pct",
  },
];

/** Quantos painéis o registro tem. Contado, nunca escrito. */
export const QUANTIDADE_DE_PAINEIS = REGISTRO_DE_PAINEIS.length;

/** Índice por id, para quem precisa de um painel específico. */
const POR_ID: ReadonlyMap<string, RegistroDePainel> = new Map(
  REGISTRO_DE_PAINEIS.map((p) => [p.id, p]),
);

export function painelPorId(id: string): RegistroDePainel | undefined {
  return POR_ID.get(id);
}

/** Os painéis de uma tela, na ordem do Anexo A. */
export function paineisDaTela(tela: string): readonly RegistroDePainel[] {
  return REGISTRO_DE_PAINEIS.filter((p) => p.tela === tela);
}

/** As telas que o registro cita, sem repetição e na ordem do Anexo A. */
export const TELAS_CITADAS: readonly string[] = [
  ...new Set(REGISTRO_DE_PAINEIS.map((p) => p.tela)),
];

/**
 * Os painéis cuja medida o enum fechado da seção 9.2 não nomeia (H-45).
 *
 * Fixado aqui, e conferido em teste, para que a lista **só encolha**. Um
 * conjunto que cresce em silêncio é a forma de o enum fechado deixar de fechar
 * sem que ninguém decida nada.
 */
export const SEM_UNIDADE_NO_ENUM: readonly string[] =
  REGISTRO_DE_PAINEIS.filter((p) => p.unidade === null).map((p) => p.id);

/* ------------------------------------------------------------------ *
 * Os limites de leitura da seção 5
 * ------------------------------------------------------------------ */

/**
 * Teto de painéis por tela.
 *
 * Não é preferência estética. A seção 5 é sobre uma tela ser lida numa passada;
 * a oitava caixa empurra as outras para fora do campo de visão e a leitura vira
 * rolagem. O teste reprova quem passar disso.
 */
export const MAXIMO_DE_PAINEIS_POR_TELA = 7;

/** Teto de KPIs por tela, pela mesma razão (seção 5). */
export const MAXIMO_DE_KPIS_POR_TELA = 6;

/** A grade da seção 5 tem 12 colunas; nenhum painel ocupa mais. */
export const COLUNAS_DA_GRADE = 12;
