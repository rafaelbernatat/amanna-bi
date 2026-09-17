/**
 * O adaptador de warehouse (D-DADOS, T-270).
 *
 * Implementa `DataSource` sobre a `Base` lida do Postgres. É a mesma cola que
 * o adaptador de fixtures: obtém a base, chama o motor de `src/acesso/calculo/`
 * e devolve. Nenhum número nasce aqui, e nenhum arquivo do motor sabe que
 * existe um banco — é isso que a suíte de contrato prova ao rodar idêntica nos
 * dois modos (RF-21).
 *
 * O que difere da fixture é só a origem da base e o frescor: a fixture é
 * calculada na leitura; a base tem uma carga com data e hora, e o selo de
 * frescor vira aviso um dia depois dela, que é o comportamento certo de um
 * dado que ninguém atualizou (D-P5).
 */

import { calcularKpis } from "@/acesso/calculo/kpis";
import { calcularMeta } from "@/acesso/calculo/meta";
import { calcularMetrica } from "@/acesso/calculo/metricas";
import { calcularPainel } from "@/acesso/calculo/paineis";
import { calcularRanking } from "@/acesso/calculo/ranking";
import type { ClientePostgres } from "@/acesso/postgres/cliente";
import { criarCacheDeBase } from "@/acesso/warehouse/cache";
import { lerBase, lerCarga, versaoDaCarga } from "@/acesso/warehouse/leitor";
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

/** Quanto tempo a base fica em memória antes de conferir a versão da carga. */
const TTL_DA_BASE_MS = 5 * 60 * 1000;

export function criarFonteDeWarehouse(
  cliente: ClientePostgres,
  ttlMs: number = TTL_DA_BASE_MS,
): DataSource {
  const cache = criarCacheDeBase({
    ler: () => lerBase(cliente),
    versao: () => versaoDaCarga(cliente),
    ttlMs,
  });

  return {
    async getMeta(): Promise<Meta> {
      const [base, carga] = await Promise.all([
        cache.obter(),
        lerCarga(cliente),
      ]);
      return calcularMeta(
        base,
        { sincronizadoEm: carga.concluidaEm },
        new Date(),
      );
    },
    async getKpis(tela: string, q: Query): Promise<readonly Kpi[]> {
      return calcularKpis(await cache.obter(), tela, q);
    },
    async getPanel(id: string, q: Query): Promise<PanelResponse> {
      return calcularPainel(await cache.obter(), id, q);
    },
    async getMetric(id: string, q: Query): Promise<MetricValue> {
      return calcularMetrica(await cache.obter(), id, q);
    },
    async getRanking(pedido: PedidoDeRanking, q: Query): Promise<Ranking> {
      return calcularRanking(await cache.obter(), pedido, q);
    },
  };
}
