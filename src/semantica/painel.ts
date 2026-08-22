/**
 * O envelope de painel, nas doze formas do Anexo A.1 (T-102).
 *
 * O Anexo A.1 é explícito: **não existe construtor de gráfico livre**. Doze
 * formas fechadas, e um painel novo usa uma delas ou justifica uma décima
 * terceira. Este módulo é onde esse fechamento passa a ser verificável — a
 * união discriminada não deixa nascer uma forma que ninguém decidiu.
 *
 * Duas coisas que o envelope **não** carrega, e o protótipo carregava:
 *
 * 1. **Cor.** No protótipo cada barra traz `color`. Cor é decisão de tema
 *    (T-124): se o adaptador escolhe a cor, trocar a paleta vira migração de
 *    dado. Aqui o dado diz *o que é*; a apresentação diz como se pinta.
 * 2. **Texto formatado.** `mkStat` devolve `v: 'R$ 1.200 mi'` pronto. O
 *    envelope devolve `1200` com `unidade: 'BRL_mi'`, e a formatação acontece
 *    num lugar só (T-125). Número formatado no dado é número que não dá para
 *    somar, comparar nem conferir — e o verificador do chat (RF-15) precisa
 *    justamente comparar.
 *
 * O que **todo** envelope carrega, sem exceção de forma: `unit`, `formula` e
 * `asOf`. É o princípio PR-3 — todo número declara sua fórmula — e o selo de
 * frescor da seção 10.2. O JSON Schema gerado reprova a ausência de qualquer
 * um dos três.
 */

import type { Sentido, Unidade } from "@/semantica/contrato";

/* ------------------------------------------------------------------ *
 * As doze formas (Anexo A.1)
 * ------------------------------------------------------------------ */

/**
 * O vocabulário visual fechado.
 *
 * A ordem é a do Anexo A.1, para que a conferência seja leitura lado a lado e
 * não busca. Acrescentar uma décima terceira é decisão de produto: entra aqui,
 * ganha variante, e o schema versionado muda junto — o diff aparece na revisão.
 */
export const FORMAS = [
  "barras",
  "linha",
  "barras-horizontais",
  "barras-empilhadas",
  "divisao",
  "estatisticas",
  "funil",
  "mosaico-geografico",
  "rosca",
  "cascata",
  "dispersao",
  "regua-de-ciclo",
] as const;

export type Forma = (typeof FORMAS)[number];

/* ------------------------------------------------------------------ *
 * A base comum
 * ------------------------------------------------------------------ */

/**
 * O que toda forma declara.
 *
 * `formula` não é opcional e não é configurável em painel derivado (RF-04):
 * um painel que não sabe dizer como chegou ao número não deveria estar na tela.
 */
export type EnvelopeBase = {
  readonly id: string;
  readonly title: string;
  /**
   * A unidade dominante do painel.
   *
   * Em `estatisticas` e `dispersao` há mais de uma unidade em jogo; ali cada
   * item declara a sua, e esta é a do eixo principal. Continua obrigatória:
   * o cabeçalho do painel precisa dizer em que se está lendo.
   */
  readonly unit: Unidade;
  /** Como o número foi obtido. Princípio PR-3, obrigatória em toda forma. */
  readonly formula: string;
  /** O agregado do painel; nulo quando o recorte não tem dado (PR-4). */
  readonly total: number | null;
  /** Leitura em prosa; nula quando não vale para o recorte (RF-09). */
  readonly note: string | null;
  /** Data do fechamento que originou estes números (seção 10.2). */
  readonly asOf: string;
};

/* ------------------------------------------------------------------ *
 * Os blocos que mais de uma forma reaproveita
 * ------------------------------------------------------------------ */

/**
 * O papel de uma série no painel.
 *
 * `referencia` é meta, orçado ou benchmark de mercado — o traço contra o qual
 * se lê o resto. É distinção de **dado**, não de estilo: a série de meta não é
 * uma medição do período, e somá-la ao total seria erro. Sem este campo, a
 * apresentação precisaria adivinhar pelo nome da série.
 */
export type PapelDeSerie = "valor" | "referencia";

/** Uma série de um painel: um valor por categoria, na ordem de `categories`. */
export type Serie = {
  readonly name: string;
  readonly values: readonly (number | null)[];
  readonly papel: PapelDeSerie;
};

/**
 * Categorias × séries: a carga das quatro formas cartesianas.
 *
 * `barras`, `linha`, `barras-horizontais` e `barras-empilhadas` são a mesma
 * pergunta com quatro respostas visuais — o que muda é orientação e
 * empilhamento, e isso é exatamente o que `forma` diz. Compartilhar a carga
 * evita quatro cópias que sairiam de sincronia.
 */
export type CargaCartesiana = {
  readonly categories: readonly string[];
  readonly series: readonly Serie[];
};

/** Uma parte de um todo, em `divisao` e `rosca`. */
export type Parte = {
  readonly nome: string;
  readonly valor: number;
};

/* ------------------------------------------------------------------ *
 * As doze variantes
 * ------------------------------------------------------------------ */

/** Barras verticais por categoria. É a forma do exemplo da seção 9.3. */
export type PainelBarras = EnvelopeBase &
  CargaCartesiana & { readonly forma: "barras" };

/** Série temporal contínua. */
export type PainelLinha = EnvelopeBase &
  CargaCartesiana & { readonly forma: "linha" };

/** Ranking horizontal — categorias longas que não cabem num eixo vertical. */
export type PainelBarrasHorizontais = EnvelopeBase &
  CargaCartesiana & { readonly forma: "barras-horizontais" };

/** Composição por categoria: as séries somam ao total de cada categoria. */
export type PainelBarrasEmpilhadas = EnvelopeBase &
  CargaCartesiana & { readonly forma: "barras-empilhadas" };

/**
 * Divisão: a proporção interna de cada grupo, cada parte com o próprio rótulo.
 *
 * Diferente de `barras-empilhadas`: ali as séries são as mesmas em toda
 * categoria e o eixo é comparável entre elas; aqui cada grupo tem as suas
 * partes e o que se lê é a repartição de 100% dentro do grupo.
 */
export type PainelDivisao = EnvelopeBase & {
  readonly forma: "divisao";
  readonly grupos: readonly {
    readonly nome: string;
    /** O total do grupo; nulo quando o grupo não tem dado. */
    readonly total: number | null;
    readonly partes: readonly Parte[];
  }[];
};

/**
 * Estatísticas: números soltos, cada um com unidade e fórmula próprias.
 *
 * A única forma em que a unidade varia item a item — um painel de resumo mistura
 * `BRL_mi` e `pct` na mesma caixa. Cada estatística declara a sua fórmula
 * porque PR-3 vale por número, não por painel.
 */
export type PainelEstatisticas = EnvelopeBase & {
  readonly forma: "estatisticas";
  readonly estatisticas: readonly {
    readonly rotulo: string;
    readonly valor: number | null;
    readonly unidade: Unidade;
    readonly formula: string;
    readonly sentido: Sentido;
    readonly rodape: string | null;
  }[];
};

/**
 * Funil: passos em ordem, cada um subconjunto do anterior.
 *
 * A conversão entre passos **não** vem no envelope: é derivada, e derivar em
 * dois lugares é como dois números diferentes chegam à mesma reunião. A
 * apresentação calcula a partir dos valores.
 */
export type PainelFunil = EnvelopeBase & {
  readonly forma: "funil";
  readonly passos: readonly {
    readonly nome: string;
    readonly valor: number | null;
  }[];
};

/**
 * Mosaico geográfico: uma célula por UF.
 *
 * A posição de cada UF na grade **não** vem aqui. É constante cartográfica,
 * igual em todo painel desta forma, e repeti-la em cada envelope seria
 * convidar duas grades divergentes. A apresentação tem a grade; o dado tem o
 * valor.
 */
export type PainelMosaicoGeografico = EnvelopeBase & {
  readonly forma: "mosaico-geografico";
  readonly celulas: readonly {
    /** Sigla de duas letras. */
    readonly uf: string;
    /** Nulo é "sem dado nesta UF" e não zero — a célula fica vazia (PR-4). */
    readonly valor: number | null;
  }[];
};

/** Rosca: partes de um todo, com um número no centro. */
export type PainelRosca = EnvelopeBase & {
  readonly forma: "rosca";
  readonly fatias: readonly Parte[];
  readonly centro: {
    readonly valor: number | null;
    readonly rotulo: string;
  };
};

/**
 * Cascata: a ponte de um total a outro.
 *
 * `ehTotal` marca os degraus que assentam no eixo (receita líquida, lucro
 * líquido) e não empilham sobre o acumulado. Sem essa marca, a ponte da DRE
 * desenha errado — e desenha errado *plausivelmente*, que é pior.
 */
export type PainelCascata = EnvelopeBase & {
  readonly forma: "cascata";
  readonly passos: readonly {
    readonly nome: string;
    readonly valor: number;
    readonly ehTotal: boolean;
  }[];
};

/** Dispersão: duas medidas por ponto, com unidade em cada eixo. */
export type PainelDispersao = EnvelopeBase & {
  readonly forma: "dispersao";
  readonly eixoX: { readonly rotulo: string; readonly unidade: Unidade };
  readonly eixoY: { readonly rotulo: string; readonly unidade: Unidade };
  readonly pontos: readonly {
    readonly rotulo: string;
    readonly x: number;
    readonly y: number;
    /** Terceira medida, quando existe (bolha). Nulo desenha ponto simples. */
    readonly tamanho: number | null;
  }[];
};

/**
 * Régua de ciclo: marcos numa linha de dias e as faixas entre eles.
 *
 * O ciclo financeiro é a única leitura do produto em que o eixo é *duração* e
 * não período. `sentido` diz se a faixa é boa quando cresce (prazo do
 * fornecedor) ou ruim (ciclo sem caixa) — assim a apresentação sabe o que
 * destacar sem que o adaptador escolha cor.
 */
export type PainelReguaDeCiclo = EnvelopeBase & {
  readonly forma: "regua-de-ciclo";
  readonly marcos: readonly {
    readonly dia: number;
    readonly rotulo: string;
  }[];
  readonly faixas: readonly {
    readonly de: number;
    readonly ate: number;
    readonly rotulo: string;
    readonly sentido: Sentido;
  }[];
};

/* ------------------------------------------------------------------ *
 * A união, e a prova de que ela cobre as doze
 * ------------------------------------------------------------------ */

/**
 * O envelope de painel (seção 9.3).
 *
 * União discriminada por `forma`: quem consome precisa olhar a forma antes de
 * chegar na carga, e o compilador recusa ler `fatias` de um painel de barras.
 */
export type PanelResponse =
  | PainelBarras
  | PainelLinha
  | PainelBarrasHorizontais
  | PainelBarrasEmpilhadas
  | PainelDivisao
  | PainelEstatisticas
  | PainelFunil
  | PainelMosaicoGeografico
  | PainelRosca
  | PainelCascata
  | PainelDispersao
  | PainelReguaDeCiclo;

/** O envelope de uma forma específica, para quem já sabe qual quer. */
export type PainelDaForma<F extends Forma> = Extract<
  PanelResponse,
  { forma: F }
>;

/**
 * A prova de cobertura, em tipo.
 *
 * Duas direções, e as duas importam:
 *
 * - `Forma extends FormasNaUniao` — toda forma declarada tem variante. Acrescentar
 *   `'sankey'` a FORMAS sem escrever `PainelSankey` para de compilar aqui.
 * - `FormasNaUniao extends Forma` — nenhuma variante usa forma fora do vocabulário.
 *   Uma variante com `forma: 'pizza'` para de compilar aqui.
 *
 * Sem a segunda direção o Anexo A.1 vira sugestão: alguém acrescentaria uma
 * décima terceira forma na união e o vocabulário fechado não fecharia nada.
 */
type FormasNaUniao = PanelResponse["forma"];

type ProvaDeCobertura = [Forma] extends [FormasNaUniao]
  ? [FormasNaUniao] extends [Forma]
    ? true
    : "há variante com forma fora de FORMAS"
  : "há forma em FORMAS sem variante";

/** Não é teste em tempo de execução: se isto compila, as doze estão cobertas. */
export const COBERTURA_COMPLETA: ProvaDeCobertura = true;

/** Quantas formas o vocabulário tem. Contado, nunca escrito. */
export const QUANTIDADE_DE_FORMAS = FORMAS.length;

/** A forma pertence ao vocabulário fechado? */
export function formaValida(candidata: string): candidata is Forma {
  return (FORMAS as readonly string[]).includes(candidata);
}
