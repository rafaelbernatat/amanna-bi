/**
 * O adaptador de fixtures (T-114).
 *
 * Implementa `DataSource` sobre as seis views de fato de T-110 e T-111. O que
 * este arquivo entrega é a **peça que recorta**: dada uma `Query`, escolher as
 * linhas do recorte e somá-las. As quatro portas de leitura da seção 9.1 são
 * preenchidas pelas tarefas que as nomeiam, e cada uma diz qual.
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

import type {
  DataSource,
  Kpi,
  Meta,
  MetricValue,
  PanelResponse,
  Query,
} from "@/semantica/contrato";
import {
  VW_FATO_CONTAS,
  VW_FATO_FATURAMENTO_CLIENTE,
  VW_FATO_FIN_MES,
  VW_FATO_ORCAMENTO,
} from "@/acesso/fixtures/fin";
import { VW_FATO_RH_PERFIL } from "@/acesso/fixtures/perfil";
import {
  VW_FATO_RH_MES,
  VW_FATO_TREINAMENTO,
  VW_FATO_VAGAS,
  VW_FATO_VAGAS_FONTE,
} from "@/acesso/fixtures/rh";
import { linhasDoRecorte, recortar, somar } from "@/acesso/fixtures/recorte";

/** As seis views da seção 10.1 que a fixture publica, por nome. */
export const VIEWS = {
  vw_fato_rh_mes: VW_FATO_RH_MES,
  vw_fato_rh_perfil: VW_FATO_RH_PERFIL,
  vw_fato_vagas: VW_FATO_VAGAS,
  vw_fato_vagas_fonte: VW_FATO_VAGAS_FONTE,
  vw_fato_treinamento: VW_FATO_TREINAMENTO,
  vw_fato_fin_mes: VW_FATO_FIN_MES,
  vw_fato_orcamento: VW_FATO_ORCAMENTO,
  vw_fato_contas: VW_FATO_CONTAS,
  vw_fato_faturamento_cliente: VW_FATO_FATURAMENTO_CLIENTE,
} as const;

export type NomeDeView = keyof typeof VIEWS;

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
 * É a operação que o resto do adaptador vai usar: nenhuma tela e nenhuma
 * métrica reimplementa o recorte por conta própria.
 */
export function somaNoRecorte<N extends NomeDeView>(
  view: N,
  q: Query,
  medida: (linha: (typeof VIEWS)[N][number]) => number,
): number | null {
  const linhas = VIEWS[view] as readonly (typeof VIEWS)[N][number][];
  const recortado = recortar(linhas, q);
  if (!recortado.aplicavel) return null;
  if (recortado.linhas.length === 0) return null;
  return somar(recortado.linhas, medida);
}

/** As linhas de uma view no recorte, para quem precisa quebrar por dimensão. */
export function linhasDe<N extends NomeDeView>(
  view: N,
  q: Query,
): readonly (typeof VIEWS)[N][number][] {
  const linhas = VIEWS[view] as readonly (typeof VIEWS)[N][number][];
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
    getMeta(): Promise<Meta> {
      throw new AindaNaoImplementado("getMeta", "T-149");
    },
    getKpis(_tela: string, _q: Query): Promise<readonly Kpi[]> {
      throw new AindaNaoImplementado("getKpis", "T-115 e T-116");
    },
    getPanel(_id: string, _q: Query): Promise<PanelResponse> {
      throw new AindaNaoImplementado("getPanel", "T-117 a T-119");
    },
    getMetric(_id: string, _q: Query): Promise<MetricValue> {
      throw new AindaNaoImplementado("getMetric", "T-120");
    },
  };
}
