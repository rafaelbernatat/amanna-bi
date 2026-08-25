/**
 * `getMetric` — o catálogo respondendo por número (T-120).
 *
 * É a porta que o chat usa. As outras três servem telas montadas; esta serve
 * uma pergunta em linguagem natural que virou o id de uma métrica, e por isso
 * é a única em que **errar o nome é o caso comum**.
 *
 * ## A recusa é parte da resposta
 *
 * Métrica fora do catálogo não devolve nulo nem zero: devolve recusa com
 * sugestões. A diferença é a experiência inteira — "não encontrei
 * `rotatividade`" manda a pessoa embora; "não encontrei `rotatividade`; você
 * quis dizer `turnover_12m` ou `retencao_12m`?" a mantém na conversa.
 *
 * As sugestões saem dos **sinônimos** do catálogo, que existem exatamente para
 * isso (seção 9.4: "como as pessoas chamam; sem isto o chat não acha"). Sem
 * eles, a busca por proximidade de texto erraria em português: `rotatividade`
 * não se parece com `turnover_12m` em letra nenhuma.
 *
 * ## O que esta porta não faz
 *
 * **Não calcula.** O valor sai do mesmo `CALCULO` que alimenta cartão e painel
 * (princípio PR-1). Se o chat pudesse calcular por conta própria, a resposta
 * dele poderia divergir da tela ao lado — que é o princípio PR-2 do PRD, "o
 * chat não calcula".
 */

import {
  calculoDaMetrica,
  type Recorte,
  recorteDe,
} from "@/acesso/fixtures/kpis";
import { CATALOGO_GERADO } from "@/semantica/catalogo-gerado";
import type { MetricValue, Query } from "@/semantica/contrato";

/** Quantas sugestões a recusa carrega, no mínimo. */
const MINIMO_DE_SUGESTOES = 2;

/** Quantas ela carrega no máximo — mais que isto vira lista, não sugestão. */
const MAXIMO_DE_SUGESTOES = 4;

/**
 * A métrica pedida não existe no catálogo.
 *
 * Carrega as métricas próximas porque a recusa sem elas é um beco sem saída.
 * O aceite de T-120 exige ao menos duas, e o construtor falha se não conseguir
 * duas — uma recusa que promete ajuda e não ajuda é pior que uma recusa seca.
 */
export class MetricaDesconhecida extends Error {
  readonly pedida: string;
  readonly proximas: readonly string[];

  constructor(pedida: string, proximas: readonly string[]) {
    const lista = proximas.map((p) => `'${p}'`).join(" ou ");
    super(
      `Não existe métrica '${pedida}' no catálogo. ` +
        (proximas.length > 0
          ? `Você quis dizer ${lista}?`
          : "O catálogo está vazio."),
    );
    this.name = "MetricaDesconhecida";
    this.pedida = pedida;
    this.proximas = proximas;
  }
}

/* ------------------------------------------------------------------ *
 * A busca por proximidade
 * ------------------------------------------------------------------ */

/** Tira acento, caixa e pontuação: `Retenção 12m` → `retencao 12m`. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

/**
 * Distância de edição, com teto.
 *
 * Implementada aqui, em vinte linhas, em vez de trazer uma dependência: é a
 * única coisa que se precisa dela no produto, e uma biblioteca de string
 * similarity carregaria dez funções que ninguém chama.
 */
function distancia(a: string, b: string): number {
  const anterior: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i += 1) {
    let cantoAnterior = anterior[0] ?? 0;
    anterior[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const guardado = anterior[j] ?? 0;
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      anterior[j] = Math.min(
        (anterior[j] ?? 0) + 1,
        (anterior[j - 1] ?? 0) + 1,
        cantoAnterior + custo,
      );
      cantoAnterior = guardado;
    }
  }

  return anterior[b.length] ?? Math.max(a.length, b.length);
}

/** Proximidade máxima: os textos são o mesmo. */
const IGUAL = 100;

/**
 * Um texto contém o outro — "folha" dentro de "folha total".
 *
 * Abaixo de igual e acima de qualquer semelhança por letra: quem digita um
 * pedaço do nome quase sempre quer aquele nome, e não outro que por acaso se
 * escreve parecido.
 */
const CONTIDO = 90;

/**
 * Quão perto um texto está de uma métrica, em pontos de 0 a 100.
 *
 * Pontos inteiros, e não fração de 0 a 1, por dois motivos. Um: a camada de
 * dados não tem fração literal, e uma guarda de T-114 confere isso — fator de
 * escala é, por natureza, uma fração, e a regra existe para o achado 3 do
 * Anexo D não voltar disfarçado. Dois: "90 de 100" se lê melhor que "0,9" numa
 * mensagem de recusa, se um dia ela mostrar o quanto acertou.
 *
 * Considera o id, o rótulo **e** os sinônimos, e fica com o melhor dos três.
 * É o que faz `rotatividade` encontrar `turnover_12m`: nenhuma letra em comum,
 * mas o sinônimo bate exatamente.
 */
function proximidade(pedido: string, id: string): number {
  const entrada = CATALOGO_GERADO[id];
  if (entrada === undefined) return 0;

  const alvo = normalizar(pedido);
  const candidatos = [id, entrada.rotulo, ...entrada.sinonimos].map(normalizar);

  return candidatos.reduce((melhor, candidato) => {
    if (candidato === alvo) return IGUAL;
    if (candidato.includes(alvo) || alvo.includes(candidato)) {
      return Math.max(melhor, CONTIDO);
    }
    const maior = Math.max(candidato.length, alvo.length);
    const parecido =
      maior === 0
        ? 0
        : Math.round(((maior - distancia(candidato, alvo)) * IGUAL) / maior);
    return Math.max(melhor, parecido);
  }, 0);
}

/**
 * As métricas mais próximas de um texto, da mais para a menos parecida.
 *
 * Sempre devolve pelo menos duas, quando o catálogo tem duas: a recusa precisa
 * delas, e um corte por limiar deixaria a pessoa sem saída justamente nos casos
 * mais errados — que são os que mais precisam de ajuda.
 */
export function metricasProximas(
  pedido: string,
  quantas = MAXIMO_DE_SUGESTOES,
): readonly string[] {
  return Object.keys(CATALOGO_GERADO)
    .map((id) => ({ id, perto: proximidade(pedido, id) }))
    .sort((a, b) => b.perto - a.perto || a.id.localeCompare(b.id))
    .slice(0, Math.max(quantas, MINIMO_DE_SUGESTOES))
    .map((x) => x.id);
}

/* ------------------------------------------------------------------ *
 * O valor
 * ------------------------------------------------------------------ */

/**
 * A série mensal da métrica: a mesma medida, avaliada mês a mês.
 *
 * É a mesma construção do sparkline do cartão e das categorias do painel. Uma
 * quarta forma de montar série daria uma quarta chance de divergir.
 */
function serieDaMetrica(
  calculo: (r: Recorte) => number | null,
  r: Recorte,
): readonly (number | null)[] {
  return r.meses.map((mes) => calculo({ ...r, meses: [mes] }));
}

/** A data de fechamento que originou o número (seção 10.2). */
function fechamentoDoRecorte(r: Recorte): string {
  const ultimo = r.meses.at(-1);
  if (ultimo === undefined) return "";
  const [ano, mes] = ultimo.split("-");
  const dia = new Date(Date.UTC(Number(ano), Number(mes), 0)).getUTCDate();
  return `${ultimo}-${String(dia)}`;
}

/** O valor de uma métrica do catálogo, no recorte pedido. */
export function calcularMetrica(id: string, q: Query): MetricValue {
  const entrada = CATALOGO_GERADO[id];
  if (entrada === undefined) {
    throw new MetricaDesconhecida(id, metricasProximas(id));
  }

  const calculo = calculoDaMetrica(id);
  if (calculo === undefined) {
    /*
     * Métrica no catálogo sem cálculo é defeito nosso, não erro de quem
     * perguntou — e por isso não vira recusa com sugestões, que mandaria a
     * pessoa procurar outra métrica quando o problema está aqui.
     */
    throw new Error(
      `A métrica '${id}' está no catálogo e não sabe se calcular. ` +
        "Catálogo que promete o que não entrega é pior que catálogo curto.",
    );
  }

  const r = recorteDe(q);

  return {
    id,
    value: calculo(r),
    unit: entrada.unidade,
    formula: entrada.formula,
    agg: entrada.agg,
    sentido: entrada.sentido,
    serie: {
      name: entrada.rotulo,
      values: serieDaMetrica(calculo, r),
      papel: "valor",
    },
    asOf: fechamentoDoRecorte(r),
  };
}

/** Os ids do catálogo. Serve à conferência de cobertura. */
export function metricasDoCatalogo(): readonly string[] {
  return Object.keys(CATALOGO_GERADO);
}
