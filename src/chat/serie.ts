/**
 * Um gráfico para toda resposta (T-432).
 *
 * ## O problema
 *
 * Setenta e sete métricas do catálogo não têm cartão na tela (`so-no-chat.ts`),
 * e sem cartão não havia painel de destino — a resposta saía só em texto. Mas
 * `MetricValue.serie` já traz a série mensal por trás de qualquer métrica,
 * calculada sobre os mesmos meses do recorte, nas fixtures e no warehouse. O
 * gráfico é **montagem**, não leitura nova: os pontos são os que o estágio 2
 * já leu.
 *
 * ## O que este módulo garante
 *
 * - As categorias saem de `mesesDoRecorte`, a mesma função que produz os
 *   meses sobre os quais a série foi calculada: eixo e valores alinham por
 *   construção, e um teste fixa isso.
 * - Série toda nula não vira gráfico (PR-4): `null`, e a resposta fica sem
 *   painel, como antes.
 * - O ranking do laço vira barras horizontais com os mesmos itens que o
 *   modelo leu: nada é derivado aqui.
 *
 * ## O que não faz
 *
 * Não formata número, não calcula: cada campo vem do envelope de origem. A
 * fórmula é a da métrica, e o id é reconhecível (`chat-serie-…`,
 * `chat-ranking-…`) para o e2e e para quem inspeciona.
 */

import { mesesDoRecorte } from "@/acesso/calculo/recorte";
import { formatarValor } from "@/apresentacao/formato/formato";
import { rotuloDeCategoria, type PontoDoResumo } from "@/chat/grafico";
import type { LeituraDeRanking } from "@/chat/ferramentas/resultado";
import { ROTULO_DA_DIMENSAO } from "@/chat/ferramentas/passos";
import { CATALOGO_GERADO } from "@/semantica/catalogo-gerado";
import type {
  DimensaoDeRanking,
  MetricValue,
  PainelBarrasHorizontais,
  PainelLinha,
  Query,
} from "@/semantica/contrato";
import { formula } from "@/semantica/painel";

/** O prefixo do painel sintético de série; o resto é o id da métrica. */
export const PREFIXO_DO_PAINEL_DE_SERIE = "chat-serie-";

/** O prefixo do painel sintético de ranking. */
export const PREFIXO_DO_PAINEL_DE_RANKING = "chat-ranking-";

/**
 * A janela do gráfico sintético: doze meses.
 *
 * Com o período em dezembro, a série do recorte tem um ponto só, e uma linha
 * de um ponto não é gráfico. O resolver lê a métrica de novo nesta janela só
 * para o desenho; o valor da resposta continua sendo o do recorte pedido.
 */
export const JANELA_DO_GRAFICO: Query["periodo"] = "12-meses";

export function idDoPainelDeSerie(metrica: string): string {
  return `${PREFIXO_DO_PAINEL_DE_SERIE}${metrica}`;
}

export function idDoPainelDeRanking(
  metrica: string,
  dimensao: DimensaoDeRanking,
): string {
  return `${PREFIXO_DO_PAINEL_DE_RANKING}${metrica}-${dimensao}`;
}

/**
 * A série mensal da métrica como painel de linha, ou `null` quando não há
 * o que desenhar.
 *
 * `consulta` é o recorte sobre o qual `valor` foi calculado — é dela que
 * saem as categorias, e por isso os dois têm de ser o mesmo objeto de
 * consulta que foi à porta de leitura.
 */
export function painelDaSerie(
  metrica: string,
  valor: MetricValue,
  consulta: Query,
): PainelLinha | null {
  const categorias = mesesDoRecorte(consulta);
  const { serie } = valor;
  if (serie.values.length !== categorias.length) return null;
  if (serie.values.every((v) => v === null)) return null;

  const id = idDoPainelDeSerie(metrica);
  return {
    id,
    title: `${CATALOGO_GERADO[metrica]?.rotulo ?? metrica} · mês a mês`,
    unit: valor.unit,
    formula: formula(valor.formula, id),
    total: valor.value,
    note: null,
    asOf: valor.asOf,
    forma: "linha",
    categories: categorias,
    series: [serie],
  };
}

/**
 * A série mensal como pontos rotulados ("abr/2026"), um por mês do recorte
 * (T-439). É de onde sai o mês que a pergunta nomeou, e cada ponto passa no
 * verificador junto do rótulo. Vazio quando a série não alinha com os meses.
 */
export function pontosDaSerie(
  valor: MetricValue,
  consulta: Query,
): readonly PontoDoResumo[] {
  const categorias = mesesDoRecorte(consulta);
  const { serie } = valor;
  if (serie.values.length !== categorias.length) return [];
  return categorias.map((categoria, i) => {
    const v = serie.values[i] ?? null;
    return {
      rotulo: rotuloDeCategoria(categoria),
      valor: v,
      unidade: valor.unit,
      formatado: v === null ? null : formatarValor(v, valor.unit),
    };
  });
}

/** O ranking lido pelo laço como barras horizontais, item a item. */
export function painelDoRanking(
  leitura: Omit<LeituraDeRanking, "desenho">,
): PainelBarrasHorizontais {
  const id = idDoPainelDeRanking(leitura.metrica, leitura.dimensao);
  return {
    id,
    title: `${leitura.rotulo} por ${ROTULO_DA_DIMENSAO[leitura.dimensao]}`,
    unit: leitura.unidade,
    formula: formula(leitura.formula, id),
    total: leitura.total.valor,
    note: null,
    asOf: leitura.asOf,
    forma: "barras-horizontais",
    categories: leitura.itens.map((i) => i.rotulo),
    series: [
      {
        name: leitura.rotulo,
        values: leitura.itens.map((i) => i.valor),
        papel: "valor",
      },
    ],
  };
}
