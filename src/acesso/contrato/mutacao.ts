/**
 * O controle negativo da suíte de contrato (T-140).
 *
 * ## Uma suíte que nunca reprovou não prova nada
 *
 * A suíte de T-121 e T-122 percorre 768 recortes e volta verde. Verde sobre o
 * quê? Se ela passasse igual num adaptador **errado**, o verde não estaria
 * dizendo "o dado reconcilia" — estaria dizendo "a suíte não olha". É a mesma
 * lógica de plantar a ocorrência antes de confiar numa busca que devolve zero.
 *
 * Este módulo constrói o adaptador errado de propósito: o `fctx()` do protótipo,
 * reescrito em TypeScript. Ele lê **sempre o consolidado** e multiplica o
 * resultado por um fator fixo, em vez de escolher as linhas do recorte.
 *
 * ```
 * fonte real     recorte = escolher linhas          → soma o que existe
 * fonte mutada   recorte = consolidado × fator      → soma o que se supôs
 * ```
 *
 * ## Por que ele engana quem não olha com cuidado
 *
 * É o achado 4 do Anexo D: no protótipo a reconciliação **parecia** correta
 * porque KPI e painel escalavam pelo mesmo fator. Um teste que só compare o KPI
 * com o painel que o detalha passa nos dois — no adaptador certo e neste aqui.
 * O que separa os dois é o dado ter perfis diferentes por medida: se a Unidade
 * SP tem 62% do quadro e 68% da folha, um fator único erra uma das duas, e a
 * regra 1 acusa.
 *
 * É por isso que este arquivo e as fixtures não proporcionais são a mesma
 * tarefa: sem o perfil variado, o controle negativo passaria; sem o controle
 * negativo, o perfil variado não estaria provando nada.
 *
 * ## O que ele **não** é
 *
 * Não é fonte de dados. A fábrica de T-106 não o registra e nenhuma tela o
 * alcança: `obterFonteDeDados` só conhece `fixtures` e `warehouse`. Ele existe
 * para ser reprovado.
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
  AGREGADO_DE_AREA,
  AGREGADO_DE_ENTIDADE,
  AGREGADO_DE_MODALIDADE,
} from "@/acesso/fixtures/eixos";
import { MESES_DO_PERIODO } from "@/acesso/fixtures/recorte";

/**
 * O fator de entidade do protótipo, copiado de `fctx()`.
 *
 * > `const ent = f.entidade === 'Consolidado' ? 1 : (f.entidade === 'Unidade SP' ? 0.62 : 0.38);`
 *
 * Um número por entidade, para **todas** as medidas — que é exatamente o
 * defeito. Na fixture, a Unidade SP tem 62% do quadro e 68% da folha; aqui ela
 * tem 62% de tudo.
 */
const FATOR_DE_ENTIDADE: Readonly<Record<string, number>> = {
  "unidade-sp": 0.62,
  "demais-unidades": 0.38,
};

/**
 * O fator de área, pela participação no **quadro** — e só por ela.
 *
 * No protótipo, `hc: (ar ? ar.hc / 1240 : 1)`. A participação de cada área no
 * headcount vira o multiplicador de folha, de receita, de horas de treinamento
 * e de qualquer outra medida. Tecnologia tem 13,5% do quadro e 22% da folha; um
 * fator só não consegue ser os dois.
 */
const FATOR_DE_AREA: Readonly<Record<string, number>> = {
  operacoes: 486 / 1240,
  comercial: 214 / 1240,
  tecnologia: 168 / 1240,
  logistica: 142 / 1240,
  financeiro: 96 / 1240,
  marketing: 78 / 1240,
  rh: 56 / 1240,
};

/** O fator de modalidade, pelo mesmo raciocínio: `modS = md.v / 1240`. */
const FATOR_DE_MODALIDADE: Readonly<Record<string, number>> = {
  presencial: 604 / 1240,
  hibrido: 472 / 1240,
  remoto: 164 / 1240,
};

/** Recorte no padrão não escala: o consolidado é o próprio dado lido. */
const SEM_ESCALA = 1;

/** A janela cheia, contra a qual o período é escalado. */
const JANELA_CHEIA = "12-meses";

/**
 * O fator do recorte, como o protótipo o calculava.
 *
 * Os três se multiplicam entre si — `hc: (ar ? ar.hc/1240 : 1) * modS * ent` —
 * o que supõe que as dimensões são independentes. Não são: a Unidade SP não
 * tem a mesma repartição de áreas que as demais unidades, e é essa suposição
 * que a suíte precisa saber reprovar.
 *
 * ## O período entrou depois, e a razão importa
 *
 * A primeira versão deixava o período de fora, porque no protótipo ele recorta
 * a série por índice (`S(a, F, k)` fatia de `i` a `j`), que é seleção e não
 * escala. Fiel ao protótipo — e por isso o controle negativo não media nada na
 * dimensão de período: com todas as outras no agregado, o fator dava 1 e o
 * mutante devolvia exatamente a fonte real.
 *
 * Um controle de mutação não existe para ser fiel; existe para **medir a
 * sensibilidade da suíte**, uma dimensão de cada vez. Um defeito que ninguém
 * injeta é uma dimensão sobre a qual não se sabe nada. Então o período entra
 * com o erro da mesma família: ler a janela cheia e multiplicar pela fração de
 * meses, como se seis meses valessem metade do ano.
 *
 * É um erro plausível, e é o que a sazonalidade de T-140.2 torna detectável:
 * com a fatia variando ao longo do ano, meio ano nunca é metade do ano.
 */
export function fatorDoRecorte(q: Query): number {
  const entidade =
    q.entidade === AGREGADO_DE_ENTIDADE
      ? SEM_ESCALA
      : (FATOR_DE_ENTIDADE[q.entidade] ?? SEM_ESCALA);
  const area =
    q.area === AGREGADO_DE_AREA
      ? SEM_ESCALA
      : (FATOR_DE_AREA[q.area] ?? SEM_ESCALA);
  const modalidade =
    q.modalidade === AGREGADO_DE_MODALIDADE
      ? SEM_ESCALA
      : (FATOR_DE_MODALIDADE[q.modalidade] ?? SEM_ESCALA);

  const meses = MESES_DO_PERIODO[q.periodo] ?? 0;
  const cheia = MESES_DO_PERIODO[JANELA_CHEIA] ?? 0;
  const periodo =
    q.periodo === JANELA_CHEIA || cheia === 0 ? SEM_ESCALA : meses / cheia;

  return entidade * area * modalidade * periodo;
}

/**
 * A consulta que o protótipo de fato executava: sempre o consolidado, sempre o
 * ano inteiro.
 *
 * O período entra aqui junto com as três dimensões pela mesma razão: o mutante
 * lê **uma** coisa — o total — e deriva todo o resto por multiplicação.
 */
function consolidada(q: Query): Query {
  return {
    ...q,
    periodo: JANELA_CHEIA,
    entidade: AGREGADO_DE_ENTIDADE,
    area: AGREGADO_DE_AREA,
    modalidade: AGREGADO_DE_MODALIDADE,
  };
}

/** Escala um valor que pode não existir. Nulo continua nulo (princípio PR-4). */
function escalar(valor: number | null, k: number): number | null {
  return valor === null ? null : valor * k;
}

function escalarSerie(
  valores: readonly (number | null)[],
  k: number,
): readonly (number | null)[] {
  return valores.map((v) => escalar(v, k));
}

/**
 * Multiplica todo número de um envelope pelo fator.
 *
 * Exaustivo sobre as doze formas, como o resto do produto: uma forma nova sem
 * tratamento aqui **para de compilar**, e o controle negativo não fica cego a
 * ela em silêncio.
 */
export function escalarEnvelope(
  envelope: PanelResponse,
  k: number,
): PanelResponse {
  const base = { total: escalar(envelope.total, k) };

  switch (envelope.forma) {
    case "barras":
    case "linha":
    case "barras-horizontais":
    case "barras-empilhadas":
      return {
        ...envelope,
        ...base,
        series: envelope.series.map((s) => ({
          ...s,
          values: escalarSerie(s.values, k),
        })),
      };

    case "divisao":
      return {
        ...envelope,
        ...base,
        grupos: envelope.grupos.map((g) => ({
          ...g,
          total: escalar(g.total, k),
          partes: g.partes.map((p) => ({ ...p, valor: p.valor * k })),
        })),
      };

    case "estatisticas":
      return {
        ...envelope,
        ...base,
        estatisticas: envelope.estatisticas.map((e) => ({
          ...e,
          valor: escalar(e.valor, k),
        })),
      };

    case "funil":
      return {
        ...envelope,
        ...base,
        passos: envelope.passos.map((p) => ({
          ...p,
          valor: escalar(p.valor, k),
        })),
      };

    case "mosaico-geografico":
      return {
        ...envelope,
        ...base,
        celulas: envelope.celulas.map((c) => ({
          ...c,
          valor: escalar(c.valor, k),
        })),
      };

    case "rosca":
      return {
        ...envelope,
        ...base,
        fatias: envelope.fatias.map((f) => ({ ...f, valor: f.valor * k })),
        centro: {
          ...envelope.centro,
          valor: escalar(envelope.centro.valor, k),
        },
      };

    case "cascata":
      return {
        ...envelope,
        ...base,
        passos: envelope.passos.map((p) => ({ ...p, valor: p.valor * k })),
      };

    case "dispersao":
      return {
        ...envelope,
        ...base,
        pontos: envelope.pontos.map((p) => ({
          ...p,
          x: p.x * k,
          y: p.y * k,
          tamanho: escalar(p.tamanho, k),
        })),
      };

    case "regua-de-ciclo":
      /*
       * Prazo não escala com o tamanho da empresa, e é justamente por isso que
       * o protótipo errava aqui: multiplicar 76 dias de ciclo por 0,62 dá 47
       * dias de ciclo para a Unidade SP, um número que ninguém mediu. O
       * controle negativo reproduz o erro, incluindo este.
       */
      return {
        ...envelope,
        ...base,
        marcos: envelope.marcos.map((m) => ({ ...m, dia: m.dia * k })),
        faixas: envelope.faixas.map((f) => ({
          ...f,
          de: f.de * k,
          ate: f.ate * k,
        })),
      };
  }
}

/** Multiplica o valor e a série de um cartão. */
function escalarKpi(kpi: Kpi, k: number): Kpi {
  return {
    ...kpi,
    value: escalar(kpi.value, k),
    serie: escalarSerie(kpi.serie, k),
  };
}

/**
 * Envolve uma fonte real com o defeito do protótipo.
 *
 * Recebe a fonte certa e devolve a errada. Assim o controle negativo mede a
 * suíte contra **o mesmo dado**, e a única diferença entre passar e reprovar é
 * o recorte ter virado multiplicação.
 */
export function criarFonteDeMutacao(base: DataSource): DataSource {
  return {
    getMeta(): Promise<Meta> {
      return base.getMeta();
    },

    async getKpis(tela: string, q: Query): Promise<readonly Kpi[]> {
      const k = fatorDoRecorte(q);
      const kpis = await base.getKpis(tela, consolidada(q));
      return kpis.map((kpi) => escalarKpi(kpi, k));
    },

    async getPanel(id: string, q: Query): Promise<PanelResponse> {
      const k = fatorDoRecorte(q);
      return escalarEnvelope(await base.getPanel(id, consolidada(q)), k);
    },

    async getMetric(id: string, q: Query): Promise<MetricValue> {
      const k = fatorDoRecorte(q);
      const metrica = await base.getMetric(id, consolidada(q));
      return {
        ...metrica,
        value: escalar(metrica.value, k),
        serie: {
          ...metrica.serie,
          values: escalarSerie(metrica.serie.values, k),
        },
      };
    },
  };
}
