/**
 * O filtro dimensional de verdade (T-114).
 *
 * ## O que este arquivo substitui
 *
 * O achado 3 do Anexo D, que é o defeito estrutural do protótipo:
 *
 * > `entidade: 'Unidade SP'` multiplica todos os valores por `0.62`; `área`
 * > multiplica pela participação daquela área no total.
 *
 * Aqui não há multiplicação. Recortar é **escolher linhas**: as do mês, da
 * entidade, da área e da modalidade pedidas. O consolidado é a soma das linhas
 * escolhidas, e por isso `soma(Unidade SP) + soma(Demais unidades)` dá
 * exatamente `soma(Consolidado)` — são as mesmas linhas contadas de dois jeitos,
 * e não `0,62 + 0,38 = 1`.
 *
 * A diferença aparece no achado 4: com fator de escala, a reconciliação
 * *parece* correta porque KPI e painel escalam pelo mesmo número. Com linhas, o
 * KPI e o painel só fecham se estiverem lendo o mesmo dado.
 *
 * ## Quando a dimensão não existe na linha
 *
 * `vw_fato_fin_mes` não tem área — a seção 10.1 dá a ela o grão mês × entidade,
 * porque receita não tem área de origem. Filtrar por Área ali podia ter duas
 * saídas erradas:
 *
 * | Saída | O que acontece na tela |
 * |---|---|
 * | devolver tudo | a receita consolidada aparece sob o recorte de Operações, e RF-01 proíbe "valor remanescente" |
 * | devolver vazio | o painel some, como se a empresa não tivesse faturado |
 *
 * Nenhuma das duas é verdade. A verdade é **"este filtro não se aplica a este
 * painel"**, e por isso o recorte devolve uma união discriminada em vez de uma
 * lista: quem consome é obrigado a tratar o caso. A tela desse estado é T-162.
 */

import type { Query } from "@/semantica/contrato";
import {
  AGREGADO_DE_AREA,
  AGREGADO_DE_ENTIDADE,
  AGREGADO_DE_MODALIDADE,
  mesesDe,
} from "@/acesso/fixtures/eixos";

/** Uma linha de fato: mês obrigatório, dimensões conforme a view. */
export type LinhaDeFato = {
  readonly mes: string;
  readonly entidade?: string;
  readonly area?: string;
  readonly modalidade?: string;
};

/**
 * Quantos meses cada período pega, contados do fim do ano.
 *
 * São janelas que terminam em dezembro, que é o comportamento do protótipo
 * (`{'12 meses': [0,12], '6 meses': [6,12], '4º trimestre': [9,12],
 * 'Dezembro': [11,12]}`). Com dado real e ano corrente, a janela passa a
 * terminar no último mês carregado — quem decide isso é `getMeta`, e não este
 * módulo.
 */
export const MESES_DO_PERIODO: Readonly<Record<string, number>> = {
  "12-meses": 12,
  "6-meses": 6,
  "4-trimestre": 3,
  dezembro: 1,
};

export class PeriodoDesconhecido extends Error {
  constructor(periodo: string) {
    super(
      `Período '${periodo}' não tem janela declarada em MESES_DO_PERIODO. ` +
        "Cair em 12 meses esconderia o erro atrás de um recorte plausível.",
    );
    this.name = "PeriodoDesconhecido";
  }
}

/** Os meses do recorte, em ordem, do mais antigo para o mais recente. */
export function mesesDoRecorte(q: Query): readonly string[] {
  const quantos = MESES_DO_PERIODO[q.periodo];
  if (quantos === undefined) throw new PeriodoDesconhecido(q.periodo);
  return mesesDe(q.ano).slice(-quantos);
}

/**
 * O resultado de recortar: as linhas, ou o nome da dimensão que não se aplica.
 *
 * União discriminada em vez de lista vazia, pela mesma razão que `Escopado` em
 * `fronteira.ts`: a recusa é **resposta esperada** e precisa chegar como valor
 * a quem vai desenhar a tela. Uma lista vazia diria "sem dado", que é outra
 * coisa e leva a outro estado da seção 6.4.
 */
export type Recortado<T> =
  | { readonly aplicavel: true; readonly linhas: readonly T[] }
  | { readonly aplicavel: false; readonly dimensao: string };

/** As três dimensões de recorte que uma linha pode ou não ter. */
const DIMENSOES_DE_LINHA = [
  { campo: "entidade", agregado: AGREGADO_DE_ENTIDADE },
  { campo: "area", agregado: AGREGADO_DE_AREA },
  { campo: "modalidade", agregado: AGREGADO_DE_MODALIDADE },
] as const;

/**
 * Recorta um conjunto de linhas por uma `Query`.
 *
 * Sem multiplicação, sem fator, sem participação: só a escolha das linhas que
 * pertencem ao recorte.
 */
export function recortar<T extends LinhaDeFato>(
  linhas: readonly T[],
  q: Query,
): Recortado<T> {
  const primeira = linhas[0];
  if (primeira !== undefined) {
    for (const { campo, agregado } of DIMENSOES_DE_LINHA) {
      const pedido = q[campo];
      // Pedir o agregado é pedir "não recorte por aqui": aplica-se sempre.
      if (pedido === agregado) continue;
      if (primeira[campo] === undefined) {
        return { aplicavel: false, dimensao: campo };
      }
    }
  }

  const meses = new Set(mesesDoRecorte(q));
  const escolhidas = linhas.filter((l) => {
    if (!meses.has(l.mes)) return false;
    for (const { campo, agregado } of DIMENSOES_DE_LINHA) {
      const pedido = q[campo];
      if (pedido === agregado) continue;
      if (l[campo] !== pedido) return false;
    }
    return true;
  });

  return { aplicavel: true, linhas: escolhidas };
}

/** As linhas do recorte, ou vazio quando a dimensão não se aplica. */
export function linhasDoRecorte<T extends LinhaDeFato>(
  linhas: readonly T[],
  q: Query,
): readonly T[] {
  const r = recortar(linhas, q);
  return r.aplicavel ? r.linhas : [];
}

/* ------------------------------------------------------------------ *
 * Somar
 * ------------------------------------------------------------------ */

/** A soma de uma medida sobre um conjunto de linhas. */
export function somar<T>(
  linhas: readonly T[],
  medida: (l: T) => number,
): number {
  return linhas.reduce((total, l) => total + medida(l), 0);
}

/**
 * A série mensal de uma medida aditiva, um ponto por mês do recorte.
 *
 * Mês sem linha nenhuma devolve `null`, e não zero — princípio PR-4. Zero é uma
 * afirmação sobre o negócio ("não houve admissão"); ausência é uma afirmação
 * sobre o dado ("não sabemos"). O painel desenha as duas de formas diferentes.
 */
export function serieSomada<T extends LinhaDeFato>(
  linhas: readonly T[],
  q: Query,
  medida: (l: T) => number,
): readonly { readonly mes: string; readonly valor: number | null }[] {
  const doRecorte = linhasDoRecorte(linhas, q);
  return mesesDoRecorte(q).map((mes) => {
    const doMes = doRecorte.filter((l) => l.mes === mes);
    return {
      mes,
      valor: doMes.length === 0 ? null : somar(doMes, medida),
    };
  });
}

/**
 * A série mensal de uma taxa, com numerador e denominador separados.
 *
 * Nunca a taxa pronta: quem agrega é `agregar(..., 'ratio')`, que soma os dois
 * lados e divide **uma vez só**. Dividir mês a mês e tirar a média das divisões
 * dá outro número, e é o erro que a regra 4 da seção 9.2 descreve.
 */
export function serieDeTaxa<T extends LinhaDeFato>(
  linhas: readonly T[],
  q: Query,
  numerador: (l: T) => number,
  denominador: (l: T) => number,
): readonly {
  readonly mes: string;
  readonly valor: number | null;
  readonly numerador: number | null;
  readonly denominador: number | null;
}[] {
  const doRecorte = linhasDoRecorte(linhas, q);
  return mesesDoRecorte(q).map((mes) => {
    const doMes = doRecorte.filter((l) => l.mes === mes);
    if (doMes.length === 0) {
      return { mes, valor: null, numerador: null, denominador: null };
    }
    const n = somar(doMes, numerador);
    const d = somar(doMes, denominador);
    return { mes, valor: d === 0 ? null : n / d, numerador: n, denominador: d };
  });
}

/**
 * A série mensal de um estoque.
 *
 * Estoque soma **entre** dimensões e não **ao longo** do tempo: o quadro de
 * março é a soma das áreas em março, nunca a soma de janeiro a março. Por isso
 * a série é somada dentro do mês e agregada por `last` no período.
 */
export const serieDeEstoque = serieSomada;

/* ------------------------------------------------------------------ *
 * Quebrar por dimensão
 * ------------------------------------------------------------------ */

/**
 * Quebra uma medida por uma dimensão, na ordem dos valores informados.
 *
 * É o que alimenta os painéis categóricos. Cada categoria recorta de novo a
 * partir das mesmas linhas — o que garante que a soma das categorias dê o total
 * do recorte, porque são partições das mesmas linhas.
 */
export function quebrarPor<T extends LinhaDeFato>(
  linhas: readonly T[],
  q: Query,
  dimensao: keyof LinhaDeFato,
  valores: readonly string[],
  medida: (l: T) => number,
): readonly { readonly categoria: string; readonly valor: number | null }[] {
  const doRecorte = linhasDoRecorte(linhas, q);
  return valores.map((valor) => {
    const daCategoria = doRecorte.filter((l) => l[dimensao] === valor);
    return {
      categoria: valor,
      valor: daCategoria.length === 0 ? null : somar(daCategoria, medida),
    };
  });
}
