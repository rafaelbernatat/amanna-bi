/**
 * O adaptador de fixtures (T-114).
 *
 * Implementa `DataSource` sobre a `Base` das fixtures. O motor de cálculo mora
 * em `src/acesso/calculo/` e recebe a base por parâmetro: este arquivo é a
 * cola entre a fábrica de T-106 e o motor, e nada mais. O adaptador de
 * warehouse (D-DADOS) tem a mesma forma, com outra base.
 *
 * ## Por que o adaptador não tem número nenhum
 *
 * Um teste de arquitetura confere isto: nenhum literal numérico neste arquivo.
 * É a forma executável do achado 3 do Anexo D — no protótipo, recortar é
 * multiplicar por `0.62`; aqui, recortar é escolher linhas. Um fator de escala
 * precisaria de um número, e o número não tem onde morar.
 *
 * ## Por que os métodos que faltam lançam em vez de devolver vazio
 *
 * Vazio é um estado legítimo da seção 6.4 — "sem dado neste recorte" — e usá-lo
 * para dizer "ainda não implementei" misturaria as duas coisas na tela. Quem
 * chamar antes da hora recebe um erro que nomeia a tarefa, e não um painel em
 * branco que parece dado.
 */

import type { NomeDeView, Views } from "@/acesso/calculo/base";
import { calcularKpis } from "@/acesso/calculo/kpis";
import { calcularMeta } from "@/acesso/calculo/meta";
import { calcularMetrica } from "@/acesso/calculo/metricas";
import { calcularPainel } from "@/acesso/calculo/paineis";
import { calcularRanking } from "@/acesso/calculo/ranking";
import { linhasDoRecorte, recortar, somar } from "@/acesso/calculo/recorte";
import { BASE_DE_FIXTURES } from "@/acesso/fixtures/base";
import type {
  DataSource,
  Kpi,
  Meta,
  MetricValue,
  PanelResponse,
  PedidoDeRanking,
  Query,
  Ranking,
} from "@/semantica/contrato";

/**
 * As views da seção 10.1 que a fixture publica, por nome.
 *
 * Eram seis em T-111; as de balanço e dívida entraram em 2026-09-03 para as
 * perguntas de CFO. Hoje são as da `Base`, e este nome existe para quem
 * confere cobertura e coerência das fixtures.
 */
export const VIEWS: Views = BASE_DE_FIXTURES.views;

export type { NomeDeView };

/**
 * A porta que ainda não existe.
 *
 * Nomear a tarefa no erro é o que transforma "não funciona" em "T-115 é o
 * próximo passo" para quem esbarrar nisto.
 */
export class AindaNaoImplementado extends Error {
  constructor(porta: string, tarefa: string) {
    super(
      `${porta} ainda não foi implementada nesta fonte. É o entregável de ${tarefa}. ` +
        "Devolver vazio aqui misturaria 'sem dado no recorte' com 'sem código'.",
    );
    this.name = "AindaNaoImplementado";
  }
}

/**
 * Uma leitura recortada de uma view, já somada.
 *
 * É a operação que os testes de coerência usam: nenhuma tela e nenhuma
 * métrica reimplementa o recorte por conta própria.
 */
export function somaNoRecorte<N extends NomeDeView>(
  view: N,
  q: Query,
  medida: (linha: Views[N][number]) => number | null,
): number | null {
  const linhas = VIEWS[view] as readonly Views[N][number][];
  const recortado = recortar(linhas, q);
  if (!recortado.aplicavel) return null;
  if (recortado.linhas.length === 0) return null;
  return somar(recortado.linhas, medida);
}

/** As linhas de uma view no recorte, para quem precisa quebrar por dimensão. */
export function linhasDe<N extends NomeDeView>(
  view: N,
  q: Query,
): readonly Views[N][number][] {
  const linhas = VIEWS[view] as readonly Views[N][number][];
  return linhasDoRecorte(linhas, q);
}

/**
 * A fonte de dados sobre fixtures.
 *
 * Construída pela fábrica de T-106 quando `DATA_SOURCE=fixtures`, e nunca
 * importada por uma tela — o teste de arquitetura de T-137 reprova isso.
 */
export function criarFonteDeFixtures(): DataSource {
  return {
    /**
     * O que a fixture sabe sobre si mesma (T-149).
     *
     * O instante entra como `new Date()` **aqui**, e não dentro de
     * `calcularMeta`: a fronteira do adaptador é onde o mundo externo começa, e
     * o relógio é mundo externo. A fixture é calculada na leitura, então o
     * último sync é o instante da própria leitura.
     */
    getMeta(): Promise<Meta> {
      const agora = new Date();
      return Promise.resolve(
        calcularMeta(
          BASE_DE_FIXTURES,
          { sincronizadoEm: agora.toISOString() },
          agora,
        ),
      );
    },
    /** As 13 telas, com todo numero saindo do catalogo (T-115 e T-116). */
    getKpis(tela: string, q: Query): Promise<readonly Kpi[]> {
      return Promise.resolve(calcularKpis(BASE_DE_FIXTURES, tela, q));
    },
    getPanel(id: string, q: Query): Promise<PanelResponse> {
      return Promise.resolve(calcularPainel(BASE_DE_FIXTURES, id, q));
    },
    getMetric(id: string, q: Query): Promise<MetricValue> {
      // Métrica fora do catálogo lança `MetricaDesconhecida`, com sugestões:
      // ver o cabeçalho de `metricas.ts`.
      return Promise.resolve(calcularMetrica(BASE_DE_FIXTURES, id, q));
    },
    getRanking(pedido: PedidoDeRanking, q: Query): Promise<Ranking> {
      return Promise.resolve(calcularRanking(BASE_DE_FIXTURES, pedido, q));
    },
  };
}
