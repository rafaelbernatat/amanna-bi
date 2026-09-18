/**
 * Os tres modulos e as treze telas (T-126).
 *
 * Espelha o `NAV` do prototipo, que e a fonte da verdade de comportamento de
 * tela, e o inventario do Anexo A do PRD. A ordem importa: trocar de modulo
 * leva a primeira tela dele (PRD secao 6.1), e "primeira" e a primeira desta
 * lista.
 */

export type IdDeModulo = "rh" | "fin" | "int";

/** Os icones que o menu lateral desenha, um por tela (T-442). */
export const ICONES_DE_TELA = [
  "visao",
  "pessoas",
  "giro",
  "recrutamento",
  "treinamento",
  "engajamento",
  "salarios",
  "financeiro",
  "caixa",
  "orcamento",
  "contas",
  "faturamento",
  "cruzamento",
] as const;
export type IconeDeTela = (typeof ICONES_DE_TELA)[number];

export type Tela = {
  /** Segmento da URL dentro do modulo: `/rh/visao` tem slug `visao`. */
  readonly slug: string;
  /** Titulo da tela, mostrado no `h1`. */
  readonly titulo: string;
  /** O icone no menu lateral; recolhido, e so ele que aparece (T-442). */
  readonly icone: IconeDeTela;
};

export type Modulo = {
  readonly id: IdDeModulo;
  /** Numero de ordem exibido na barra lateral. */
  readonly numero: string;
  /** Nome curto, usado na barra lateral. */
  readonly nome: string;
  /** Nome completo, usado no breadcrumb. */
  readonly nomeCompleto: string;
  readonly descricao: string;
  readonly telas: readonly Tela[];
};

export const MODULOS: readonly Modulo[] = [
  {
    id: "rh",
    numero: "01",
    nome: "Recursos Humanos",
    nomeCompleto: "Recursos Humanos",
    descricao: "Quadro, retenção, seleção e folha",
    telas: [
      { slug: "visao", titulo: "Visão geral", icone: "visao" },
      { slug: "colab", titulo: "Colaboradores", icone: "pessoas" },
      { slug: "turnover", titulo: "Turnover", icone: "giro" },
      { slug: "recrut", titulo: "Recrutamento", icone: "recrutamento" },
      { slug: "trein", titulo: "Treinamento", icone: "treinamento" },
      { slug: "engaj", titulo: "Engajamento", icone: "engajamento" },
      { slug: "sal", titulo: "Salários", icone: "salarios" },
    ],
  },
  {
    id: "fin",
    numero: "02",
    nome: "Financeiro",
    nomeCompleto: "Financeiro e controladoria",
    descricao: "Resultado, caixa, orçamento e contas",
    telas: [
      { slug: "visao", titulo: "Visão financeira", icone: "financeiro" },
      { slug: "caixa", titulo: "Fluxo de caixa", icone: "caixa" },
      { slug: "orc", titulo: "Orçamentário", icone: "orcamento" },
      { slug: "contas", titulo: "Contas a pagar/receber", icone: "contas" },
      { slug: "fat", titulo: "Faturamento", icone: "faturamento" },
    ],
  },
  {
    id: "int",
    numero: "03",
    nome: "Integração",
    nomeCompleto: "Integração",
    descricao: "Cruzamento RH × Financeiro",
    telas: [{ slug: "cruz", titulo: "RH × Financeiro", icone: "cruzamento" }],
  },
];

/** Tela de entrada do produto. */
export const TELA_PADRAO = "/rh/visao";

export function acharModulo(id: string): Modulo | undefined {
  return MODULOS.find((m) => m.id === id);
}

export function acharTela(
  idDoModulo: string,
  slug: string,
): { modulo: Modulo; tela: Tela } | undefined {
  const modulo = acharModulo(idDoModulo);
  const tela = modulo?.telas.find((t) => t.slug === slug);
  if (modulo === undefined || tela === undefined) return undefined;
  return { modulo, tela };
}

/** O caminho da primeira tela de um modulo (PRD secao 6.1). */
export function primeiraTelaDe(modulo: Modulo): string {
  const primeira = modulo.telas[0];
  if (primeira === undefined) {
    throw new Error(`Modulo ${modulo.id} sem nenhuma tela.`);
  }
  return `/${modulo.id}/${primeira.slug}`;
}

/** As 13 rotas, na ordem do inventario. */
export function todasAsRotas(): readonly string[] {
  return MODULOS.flatMap((m) => m.telas.map((t) => `/${m.id}/${t.slug}`));
}
