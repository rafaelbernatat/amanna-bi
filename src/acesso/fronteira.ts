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
  Meta,
  MetricValue,
  PanelResponse,
  Query,
} from "@/semantica/contrato";
import { validarQuery } from "@/semantica/query";
import type { Dimensoes } from "@/semantica/recortes";
import type { AccessScope, MotivoDeRecusa } from "@/seguranca/identidade";
import { ForaDoEscopo, restringir } from "@/seguranca/identidade";
import {
  exigirGraoPermitido,
  GraoProibido,
  type Breakdown,
  type MotivoDeGrao,
} from "@/seguranca/grao";

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

/**
 * O resultado de aplicar o escopo a uma consulta (T-137).
 *
 * União discriminada, e não exceção, porque a recusa é **resposta esperada**:
 * a seção 6.6 diz que colar a URL de um recorte para alguém de perfil menor
 * abre a tela "sem permissão", e não uma página de erro. Quem chama precisa
 * conseguir renderizar a recusa, e para isso precisa recebê-la como valor.
 *
 * `restringir` (T-135) continua lançando: é a fronteira interna, onde a recusa
 * é bug. `applyScope` é a fronteira externa, onde a recusa é estado de tela.
 */
export type Allowed = { readonly permitido: true; readonly consulta: Query };
export type Denied = {
  readonly permitido: false;
  readonly motivo: MotivoDeRecusa | MotivoDeGrao;
  readonly detalhe: string;
};
export type Escopado = Allowed | Denied;

/** A porta de leitura protegida — as quatro da seção 9.1. */
export type Fronteira = {
  lerMeta(): Promise<Meta>;
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

  /**
   * A versão que devolve a recusa em vez de lançar (T-137).
   *
   * É a forma que a apresentação consome: a tela precisa desenhar "sem
   * permissão", e para isso precisa do motivo como valor. Reaproveita
   * `autorizar` inteira — duas implementações da mesma regra divergiriam, e a
   * que divergisse seria a que ninguém testa.
   */
  function aplicar(consulta: Query, breakdown = "none"): Escopado {
    try {
      return { permitido: true, consulta: autorizar(consulta, breakdown) };
    } catch (e) {
      if (e instanceof ForaDoEscopo || e instanceof GraoProibido) {
        return { permitido: false, motivo: e.motivo, detalhe: e.message };
      }
      // Query fora do vocabulário da seção 6.2 é bug de quem chamou, não
      // recusa de acesso: continua subindo.
      throw e;
    }
  }
  const fronteira: Fronteira = {
    async lerMeta() {
      /*
       * `getMeta` não recebe `Query`, mas passa por aqui do mesmo jeito.
       *
       * O que ela devolve são as dimensões disponíveis — e uma lista de
       * entidades que inclui as que a pessoa não pode ver já é vazamento: diz
       * que existe uma "Unidade SP" para quem não tem acesso a ela. Por isso o
       * retorno é filtrado pelo escopo antes de sair.
       */
      const meta = await fonte.getMeta();
      return {
        ...meta,
        dimensoes: {
          ...meta.dimensoes,
          entidade: meta.dimensoes.entidade.filter((e) =>
            (escopo.entidades as readonly string[]).includes(e),
          ),
          area: meta.dimensoes.area.filter(
            (a) =>
              a === "todas" || (escopo.areas as readonly string[]).includes(a),
          ),
        },
      };
    },

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

  // Registrado depois de construído: o mapa lateral liga a instância à sua
  // verificação, e é o que `applyScope()` consulta.
  escopoDe.set(fronteira, aplicar);
  return fronteira;
}

/**
 * O `applyScope` de uma fronteira.
 *
 * Fica num mapa lateral, e não como método de `Fronteira`, porque `Fronteira`
 * é o que a apresentação recebe: expor ali uma função que devolve `Query`
 * autorizada convidaria alguém a pegá-la e chamar o adaptador direto.
 */
const escopoDe = new WeakMap<
  Fronteira,
  (consulta: Query, breakdown?: string) => Escopado
>();

export function applyScope(
  fronteira: Fronteira,
  consulta: Query,
  breakdown = "none",
): Escopado {
  const fn = escopoDe.get(fronteira);
  if (fn === undefined) {
    throw new Error(
      "Fronteira não registrada. Use criarFronteira() — construir o objeto " +
        "à mão contorna a verificação de escopo (seção 11).",
    );
  }
  return fn(consulta, breakdown);
}
