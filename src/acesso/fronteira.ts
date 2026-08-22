/**
 * A fronteira da camada de dados (T-138, com T-135).
 *
 * Todo pedido de leitura passa por aqui antes de existir adaptador. É o único
 * lugar onde as duas regras da seção 11 são aplicadas, e ser único é o ponto:
 * espalhar a verificação por cada painel garante que um deles a esqueça.
 *
 * A ordem importa e é deliberada:
 *
 *   1. **grão** — o recorte pedido está no vocabulário fechado? (T-138)
 *   2. **escopo** — a entidade e a área estão no perfil? (T-135)
 *   3. só então o adaptador é chamado
 *
 * Recusar *antes* do adaptador não é detalhe de desempenho. Uma consulta
 * recusada aqui não vira consulta ao banco, não vira linha de log com nome de
 * pessoa, e não vira resposta parcial que alguém possa recompor. Recusar
 * depois — deixando o adaptador ler e descartando o resultado — deixaria o
 * dado atravessar o processo, e é o tipo de coisa que aparece num despejo de
 * memória ou num log de consulta lenta.
 */

import type {
  DataSource,
  Kpi,
  MetricValue,
  PanelResponse,
  Query,
} from "@/semantica/contrato";
import { validarQuery } from "@/semantica/query";
import type { Dimensoes } from "@/semantica/recortes";
import type { AccessScope } from "@/seguranca/identidade";
import { restringir } from "@/seguranca/identidade";
import { exigirGraoPermitido, type Breakdown } from "@/seguranca/grao";

/**
 * Um pedido de leitura vindo de fora.
 *
 * `breakdown` é `string`, e não `Breakdown`, de propósito: ele chega do chat
 * (estágio 1, seção 7.2) ou da URL, onde é texto que alguém escreveu. Tipá-lo
 * como `Breakdown` aqui daria a impressão de que já foi validado — e a
 * validação é justamente o que este módulo faz.
 */
export type PedidoDeLeitura = {
  readonly painel: string;
  readonly consulta: Query;
  readonly breakdown: string;
};

/** A porta de leitura protegida. */
export type Fronteira = {
  lerPainel(pedido: PedidoDeLeitura): Promise<PanelResponse>;
  lerKpis(tela: string, consulta: Query): Promise<readonly Kpi[]>;
  lerMetrica(
    id: string,
    consulta: Query,
    breakdown: string,
  ): Promise<MetricValue>;
};

/**
 * Envolve uma fonte de dados com as regras da seção 11.
 *
 * Quem consome recebe `Fronteira`, não `DataSource`. É o que impede uma tela de
 * chamar o adaptador direto: para obter a fonte crua seria preciso passar pela
 * fábrica (T-106), e o teste de arquitetura reprova isso fora da camada de
 * acesso.
 *
 * `dimensoes` e `escopo` são contexto de sessão, estabelecido uma vez. As
 * dimensões vêm de `getMeta()` — inclusive quais anos existem (D-P8) — e ficam
 * aqui em vez de serem relidas a cada consulta por duas razões: relê-las seria
 * uma ida ao adaptador por leitura, e faria a *validação* depender de uma
 * chamada que a própria validação deveria preceder.
 */
export function criarFronteira(
  fonte: DataSource,
  escopo: AccessScope,
  dimensoes: Dimensoes,
): Fronteira {
  /**
   * As três verificações, na ordem, antes de qualquer toque no adaptador.
   *
   * Devolve a consulta restringida. Qualquer problema lança daqui — e lançar é
   * o que garante que a linha seguinte nunca execute.
   */
  function autorizar(consulta: Query, breakdown: string): Query {
    // 1. O recorte pedido existe no vocabulário fechado? Lança se não.
    const recorte: Breakdown = exigirGraoPermitido(breakdown);
    void recorte;

    // 2. A consulta está no vocabulário da seção 6.2? Lança se não.
    //    Vem antes do escopo porque comparar entidade contra o perfil só faz
    //    sentido depois de saber que 'entidade' é mesmo uma das três.
    validarQuery(consulta, dimensoes);

    // 3. O recorte cabe no perfil? Lança se não.
    return restringir(consulta, escopo);
  }

  return {
    async lerPainel(pedido) {
      const autorizada = autorizar(pedido.consulta, pedido.breakdown);
      return fonte.getPanel(pedido.painel, autorizada);
    },

    async lerKpis(tela, consulta) {
      // KPI é sempre total do recorte: não há breakdown a pedir, e por isso
      // 'none' é passado explicitamente em vez de a verificação ser pulada.
      const autorizada = autorizar(consulta, "none");
      return fonte.getKpis(tela, autorizada);
    },

    async lerMetrica(id, consulta, breakdown) {
      const autorizada = autorizar(consulta, breakdown);
      return fonte.getMetric(id, autorizada);
    },
  };
}
