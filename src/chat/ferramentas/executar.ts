/**
 * O executor: da chamada validada à leitura, pela fronteira de perfil.
 *
 * Cada ferramenta vira uma ou mais leituras pelas **mesmas** portas das telas
 * — `lerMetrica`, `lerPainel`, `lerRanking` —, que montam sessão, escopo e
 * fronteira antes de tocar a fonte (seção 7.5). O modelo não vê uma linha de
 * fato: vê o agregado, formatado, com o rótulo ao lado.
 *
 * ## O que o executor acumula
 *
 * Toda leitura feita fica guardada, na ordem. É esse acúmulo que vira o
 * envelope do verificador (RF-15): o texto do modelo só pode citar o que
 * passou por aqui. E é o que a tela desenha depois — a mini-tabela do ranking,
 * o pico e o vale da série.
 *
 * ## O que chega ao modelo
 *
 * JSON com os números **já formatados** ao lado dos brutos, como o estágio 3
 * sempre fez: o modelo copia, não reescreve. Uma leitura recusada volta como
 * `{ "erro": ... }` com as métricas próximas, e o modelo tem com que seguir.
 * Recorte fora do perfil também volta como erro: a pergunta continua, com o
 * que a pessoa pode ver.
 */

import {
  consultar,
  ConsultaRecusada,
  dicionarioDoChat,
} from "@/acesso/consulta";
import { lerMetrica, lerPainel, lerRanking } from "@/acesso/leitura";
import type { PedidoDeRankingExterno } from "@/acesso/fronteira";
import {
  leituraDaConsulta,
  type UnidadeDeColuna,
} from "@/chat/ferramentas/consulta";
import type { ContextoDaTela } from "@/chat/contexto";
import {
  diferenca,
  ehSomavel,
  participacao,
  variacaoPercentual,
  type Derivada,
} from "@/chat/ferramentas/derivar";
import {
  MAXIMO_DE_CATEGORIAS,
  MAXIMO_DE_CHAMADAS,
  MAXIMO_DE_METRICAS_LISTADAS,
} from "@/chat/ferramentas/limites";
import {
  formatado,
  type LeituraDeFerramenta,
  type LeituraDeMetrica,
  type LeituraDeRanking,
  type ResultadoDeFerramenta,
} from "@/chat/ferramentas/resultado";
import {
  validarChamada,
  type PedidoValidado,
} from "@/chat/ferramentas/validar";
import { pontoDoMes, type MesPedido } from "@/chat/mes";
import { pontosDaSerie } from "@/chat/serie";
import { resumirPainel } from "@/chat/grafico";
import { destinoDaMetrica } from "@/chat/roteamento";
import { painelDoRanking } from "@/chat/serie";
import type { Chamada, Executor } from "@/gateway/openrouter";
import { CATALOGO_GERADO } from "@/semantica/catalogo-gerado";
import type {
  MetricValue,
  PanelResponse,
  Query,
  Ranking,
} from "@/semantica/contrato";
import { GraoProibido } from "@/seguranca/grao";
import { ForaDoEscopo } from "@/seguranca/identidade";

/** As portas que o executor usa. Parâmetro para o teste injetar um espião. */
export type Portas = {
  readonly lerMetrica: (
    metrica: string,
    consulta: Query,
  ) => Promise<MetricValue>;
  readonly lerPainel: (
    painel: string,
    consulta: Query,
  ) => Promise<PanelResponse>;
  readonly lerRanking: (
    pedido: PedidoDeRankingExterno,
    consulta: Query,
  ) => Promise<Ranking>;
};

export const PORTAS_DO_PRODUTO: Portas = { lerMetrica, lerPainel, lerRanking };

/** A leitura que uma ferramenta não conseguiu fazer, dita ao modelo. */
export class LeituraRecusada extends Error {
  constructor(
    readonly motivo: string,
    readonly metricasProximas: readonly string[] = [],
  ) {
    super(motivo);
    this.name = "LeituraRecusada";
  }
}

/* ------------------------------------------------------------------ *
 * Cada ferramenta
 * ------------------------------------------------------------------ */

async function metricaLida(
  id: string,
  filtros: Query,
  portas: Portas,
  mes: MesPedido | null = null,
): Promise<LeituraDeMetrica> {
  const lida = await portas.lerMetrica(id, filtros);
  return {
    tipo: "metrica",
    metrica: id,
    rotulo: CATALOGO_GERADO[id]?.rotulo ?? id,
    unidade: lida.unit,
    valor: lida.value,
    formatado: formatado(lida.value, lida.unit),
    formula: lida.formula,
    asOf: lida.asOf,
    filtros,
    // A série já vem no valor lido: o mês é escolha, não consulta nova.
    pontoDoMes:
      mes === null ? null : pontoDoMes(pontosDaSerie(lida, filtros), mes),
  };
}

/** A série mensal sai do painel que detalha a métrica, quando ele é cartesiano. */
async function serieLida(
  id: string,
  filtros: Query,
  portas: Portas,
  mes: MesPedido | null = null,
): Promise<LeituraDeFerramenta> {
  const destino = destinoDaMetrica(id);
  if (destino?.painel === null || destino === null) {
    throw new LeituraRecusada(
      `a métrica '${id}' não tem painel de série na tela; use ler_metrica`,
    );
  }
  const painel = await portas.lerPainel(destino.painel, filtros);
  if (
    painel.forma !== "linha" &&
    painel.forma !== "barras" &&
    painel.forma !== "barras-horizontais" &&
    painel.forma !== "barras-empilhadas"
  ) {
    throw new LeituraRecusada(
      `o painel de '${id}' (${painel.forma}) não é uma série; use explicar_grafico com painel '${destino.painel}'`,
    );
  }
  const resumo = resumirPainel(painel);
  return {
    tipo: "serie",
    metrica: id,
    rotulo: CATALOGO_GERADO[id]?.rotulo ?? id,
    unidade: painel.unit,
    painel: destino.painel,
    pontos: resumo.pontos,
    destaques: resumo.destaques,
    filtros,
    desenho: painel,
    pontoDoMes: mes === null ? null : pontoDoMes(resumo.pontos, mes),
  };
}

async function comparacaoLida(
  ids: readonly string[],
  filtros: Query,
  portas: Portas,
): Promise<LeituraDeFerramenta> {
  const itens = await Promise.all(
    ids.map((id) => metricaLida(id, filtros, portas)),
  );
  const [a, b] = itens;
  let dif: Derivada | null = null;
  if (
    a !== undefined &&
    b !== undefined &&
    a.unidade === b.unidade &&
    a.valor !== null &&
    b.valor !== null
  ) {
    dif = diferenca(a.valor, b.valor, a.unidade, a.rotulo, b.rotulo);
  }
  return { tipo: "comparacao", itens, diferenca: dif, filtros };
}

async function variacaoLida(
  id: string,
  filtros: Query,
  contexto: ContextoDaTela,
  portas: Portas,
): Promise<LeituraDeFerramenta> {
  const anoAtual = filtros.ano;
  const anoAnterior = String(Number(anoAtual) - 1);
  const carregado =
    contexto.anos.length === 0 || contexto.anos.includes(anoAnterior);
  if (!carregado) {
    throw new LeituraRecusada(
      `o ano ${anoAnterior} não está carregado; anos disponíveis: ${contexto.anos.join(", ")}`,
    );
  }
  const [atual, anterior] = await Promise.all([
    metricaLida(id, filtros, portas),
    metricaLida(id, { ...filtros, ano: anoAnterior }, portas),
  ]);
  const temOsDois = atual.valor !== null && anterior.valor !== null;
  return {
    tipo: "variacao",
    metrica: id,
    rotulo: atual.rotulo,
    unidade: atual.unidade,
    atual: { ano: anoAtual, valor: atual.valor, formatado: atual.formatado },
    anterior: {
      ano: anoAnterior,
      valor: anterior.valor,
      formatado: anterior.formatado,
    },
    diferenca:
      temOsDois && atual.valor !== null && anterior.valor !== null
        ? diferenca(
            atual.valor,
            anterior.valor,
            atual.unidade,
            anoAtual,
            anoAnterior,
          )
        : null,
    variacaoPercentual:
      temOsDois &&
      atual.valor !== null &&
      anterior.valor !== null &&
      ehSomavel(atual.unidade)
        ? variacaoPercentual(atual.valor, anterior.valor, anoAtual, anoAnterior)
        : null,
    filtros,
  };
}

async function rankingLido(
  pedido: Extract<PedidoValidado, { nome: "ranking" | "decompor" }>,
  portas: Portas,
): Promise<LeituraDeRanking> {
  const limite =
    pedido.nome === "ranking" ? pedido.limite : MAXIMO_DE_CATEGORIAS;
  const ordem = pedido.nome === "ranking" ? pedido.ordem : "maior";
  const r = await portas.lerRanking(
    { metrica: pedido.metrica, dimensao: pedido.dimensao, limite, ordem },
    pedido.filtros,
  );
  const total = r.total;
  const itens = r.itens.map((i) => ({
    codigo: i.codigo,
    rotulo: i.rotulo,
    valor: i.valor,
    formatado: formatado(i.valor, r.unit),
    participacao:
      i.valor === null || total === null
        ? null
        : participacao(i.valor, total, i.rotulo),
  }));

  // "Outros" é o total menos o que está na lista: só quando a lista foi
  // cortada e todo item mostrado tem valor. É derivação nossa, com fórmula.
  let outros: Derivada | null = null;
  if (
    pedido.nome === "decompor" &&
    r.truncado &&
    total !== null &&
    r.itens.every((i) => i.valor !== null)
  ) {
    const soma = r.itens.reduce<number>((acc, i) => acc + (i.valor ?? 0), 0);
    const resto = diferenca(total, soma, r.unit, "total", "itens mostrados");
    outros = {
      ...resto,
      unidade: r.unit,
      formula: "total − soma dos itens mostrados",
    };
    outros = { ...outros, formatado: formatado(outros.valor, r.unit) ?? "" };
  }

  const lida: Omit<LeituraDeRanking, "desenho"> = {
    tipo: pedido.nome === "ranking" ? "ranking" : "decomposicao",
    metrica: pedido.metrica,
    rotulo: CATALOGO_GERADO[pedido.metrica]?.rotulo ?? pedido.metrica,
    dimensao: pedido.dimensao,
    unidade: r.unit,
    itens,
    total: { valor: total, formatado: formatado(total, r.unit) },
    outros,
    abre: r.abre,
    truncado: r.truncado,
    formula: r.formula,
    asOf: r.asOf,
    filtros: pedido.filtros,
  };
  // As barras saem dos mesmos itens que o modelo leu: montagem, não leitura.
  return { ...lida, desenho: painelDoRanking(lida) };
}

function semAcento(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/** Busca no catálogo por palavra: rótulo, id e sinônimos. */
function catalogoBuscado(busca: string): LeituraDeFerramenta {
  const alvo = semAcento(busca);
  const palavras = alvo.split(/\s+/).filter((p) => p.length > 1);
  const metricas = Object.values(CATALOGO_GERADO)
    .map((m) => {
      const texto = semAcento(
        [m.rotulo, m.id.replace(/_/g, " "), ...m.sinonimos].join(" | "),
      );
      const pontos = palavras.filter((p) => texto.includes(p)).length;
      return { m, pontos };
    })
    .filter((x) => x.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos || a.m.id.localeCompare(b.m.id))
    .slice(0, MAXIMO_DE_METRICAS_LISTADAS)
    .map(({ m }) => ({ id: m.id, rotulo: m.rotulo, unidade: m.unidade }));
  return { tipo: "catalogo", busca, metricas };
}

/**
 * A consulta livre, lida pela porta de `acesso/consulta.ts` (T-453).
 *
 * As unidades saem do dicionário do esquema, e é por elas que a célula é
 * escrita **aqui**, e não pelo modelo: o verificador compara texto, e um
 * número que o modelo formatou sozinho não estaria na lista de permitidos.
 *
 * `ConsultaRecusada` vira `LeituraRecusada`, que o laço devolve como
 * `{ "erro": … }` — o modelo lê, corrige a consulta e tenta de novo dentro das
 * quatro chamadas.
 */
async function consultaLida(sql: string): Promise<LeituraDeFerramenta> {
  const [resultado, dicionario] = await Promise.all([
    consultar(sql).catch((erro: unknown) => {
      throw new LeituraRecusada(
        erro instanceof ConsultaRecusada
          ? erro.motivo
          : "a consulta não pôde ser executada; simplifique e tente de novo",
      );
    }),
    dicionarioDoChat(),
  ]);
  const unidades: Record<string, UnidadeDeColuna> = {};
  for (const c of dicionario) {
    unidades[c.coluna] ??= (c.unidade as UnidadeDeColuna | null) ?? null;
  }
  return leituraDaConsulta(
    sql,
    resultado,
    unidades,
    ["amanna_chat"],
    new Date().toISOString().slice(0, 10),
  );
}

/** Executa um pedido já validado. Lança `LeituraRecusada` no que não dá. */
export async function executarPedido(
  pedido: PedidoValidado,
  contexto: ContextoDaTela,
  portas: Portas = PORTAS_DO_PRODUTO,
): Promise<LeituraDeFerramenta> {
  switch (pedido.nome) {
    case "ler_metrica":
      return metricaLida(pedido.metrica, pedido.filtros, portas, pedido.mes);
    case "serie_da_metrica":
      return serieLida(pedido.metrica, pedido.filtros, portas, pedido.mes);
    case "comparar_metricas":
      return comparacaoLida(pedido.metricas, pedido.filtros, portas);
    case "variacao":
      return variacaoLida(pedido.metrica, pedido.filtros, contexto, portas);
    case "ranking":
    case "decompor":
      return rankingLido(pedido, portas);
    case "explicar_grafico": {
      const painel = await portas.lerPainel(pedido.painel, pedido.filtros);
      return {
        tipo: "grafico",
        resumo: resumirPainel(painel),
        filtros: pedido.filtros,
        desenho: painel,
      };
    }
    case "listar_metricas":
      return catalogoBuscado(pedido.busca);
    case "consultar_dados":
      return consultaLida(pedido.consulta);
  }
}

/* ------------------------------------------------------------------ *
 * O que o modelo vê de cada leitura
 * ------------------------------------------------------------------ */

/**
 * A leitura como JSON para o modelo: só os campos formatados, os rótulos e
 * as fórmulas. Os brutos ficam de fora de propósito — o modelo copia o texto
 * formatado, e um bruto ao lado é convite para arredondar de outro jeito.
 */
export function paraOModeloLeitura(l: LeituraDeFerramenta): unknown {
  switch (l.tipo) {
    case "metrica":
      return {
        tipo: l.tipo,
        metrica: l.rotulo,
        valor: l.formatado,
        ...(l.pontoDoMes === null
          ? {}
          : {
              mes: {
                rotulo: l.pontoDoMes.rotulo,
                valor: l.pontoDoMes.formatado,
              },
            }),
        formula: l.formula,
        fechamento: l.asOf,
      };
    case "serie":
      return {
        tipo: l.tipo,
        metrica: l.rotulo,
        ...(l.pontoDoMes === null
          ? {}
          : {
              mes: {
                rotulo: l.pontoDoMes.rotulo,
                valor: l.pontoDoMes.formatado,
              },
            }),
        pontos: l.pontos.map((p) => ({ rotulo: p.rotulo, valor: p.formatado })),
        destaques: l.destaques.map((d) => ({
          tipo: d.tipo,
          rotulo: d.ponto.rotulo,
          valor: d.ponto.formatado,
        })),
      };
    case "comparacao":
      return {
        tipo: l.tipo,
        itens: l.itens.map((i) => ({ metrica: i.rotulo, valor: i.formatado })),
        diferenca:
          l.diferenca === null
            ? null
            : { valor: l.diferenca.formatado, formula: l.diferenca.formula },
      };
    case "variacao":
      return {
        tipo: l.tipo,
        metrica: l.rotulo,
        atual: { ano: l.atual.ano, valor: l.atual.formatado },
        anterior: { ano: l.anterior.ano, valor: l.anterior.formatado },
        diferenca: l.diferenca?.formatado ?? null,
        variacaoPercentual: l.variacaoPercentual?.formatado ?? null,
      };
    case "ranking":
    case "decomposicao":
      return {
        tipo: l.tipo,
        metrica: l.rotulo,
        dimensao: l.dimensao,
        abre: l.abre,
        itens: l.itens.map((i) => ({
          rotulo: i.rotulo,
          valor: i.formatado,
          participacao: i.participacao?.formatado ?? null,
        })),
        total: l.total.formatado,
        outros: l.outros?.formatado ?? null,
        truncado: l.truncado,
      };
    case "grafico":
      return {
        tipo: l.tipo,
        painel: l.resumo.id,
        titulo: l.resumo.titulo,
        forma: l.resumo.forma,
        pontos: l.resumo.pontos.map((p) => ({
          rotulo: p.rotulo,
          valor: p.formatado,
        })),
        destaques: l.resumo.destaques.map((d) => ({
          tipo: d.tipo,
          rotulo: d.ponto.rotulo,
          valor: d.ponto.formatado,
        })),
        total: l.resumo.total?.formatado ?? null,
        nota: l.resumo.nota,
        truncado: l.resumo.truncado,
        quantidadeDePontos: l.resumo.quantidadeDePontos,
      };
    case "catalogo":
      return { tipo: l.tipo, metricas: l.metricas };
    /*
     * A tabela, só com as células escritas. Sem bruto ao lado: o módulo
     * inteiro existe para o modelo copiar em vez de reescrever, e um número
     * cru aqui seria convite para arredondar de outro jeito.
     */
    case "consulta":
      return {
        tipo: l.tipo,
        colunas: l.colunas.map((c) => c.nome),
        linhas: l.linhas.map((linha) => linha.celulas),
        linhasDevolvidas: l.linhas.length,
        truncado: l.truncado,
      };
  }
}

/* ------------------------------------------------------------------ *
 * O executor com memória
 * ------------------------------------------------------------------ */

export type ExecutorComMemoria = {
  readonly executar: Executor;
  /** As leituras feitas, na ordem. */
  readonly leituras: () => readonly ResultadoDeFerramenta[];
  /** Quantas chamadas foram recusadas pelo validador ou pelo limite. */
  readonly recusadas: () => number;
};

/**
 * O que o executor conta enquanto trabalha (T-434).
 *
 * `aoLeitura` sai antes de executar, com o pedido validado: é a frase de
 * andamento. `aoLida` sai depois, com o resultado: é o que deixa o laço
 * emitir a prévia na primeira leitura que nomeia uma métrica, sem esperar o
 * texto.
 */
export type EventosDoExecutor = {
  readonly aoLeitura?: (pedido: PedidoValidado) => void;
  readonly aoLida?: (resultado: ResultadoDeFerramenta) => Promise<void>;
};

/**
 * Cria o executor de uma pergunta.
 *
 * Valida, executa, acumula, devolve JSON. Acima de `MAXIMO_DE_CHAMADAS`, toda
 * chamada volta com erro de limite — o modelo recebe a resposta e conclui com
 * o que tem. Erro de perfil vira erro para o modelo; erro de fonte sobe, e a
 * rota o traduz como sempre.
 */
export function criarExecutor(
  contexto: ContextoDaTela,
  portas: Portas = PORTAS_DO_PRODUTO,
  eventos: EventosDoExecutor = {},
): ExecutorComMemoria {
  const leituras: ResultadoDeFerramenta[] = [];
  let feitas = 0;
  let recusadas = 0;

  const executar: Executor = async (chamada: Chamada) => {
    if (feitas >= MAXIMO_DE_CHAMADAS) {
      recusadas += 1;
      return JSON.stringify({
        erro: `limite de ${String(MAXIMO_DE_CHAMADAS)} leituras por pergunta atingido; responda com o que já leu`,
      });
    }
    const validacao = validarChamada(chamada, contexto);
    if (!validacao.ok) {
      recusadas += 1;
      return JSON.stringify({
        erro: validacao.erro,
        ...(validacao.metricasProximas === undefined
          ? {}
          : { metricasProximas: validacao.metricasProximas }),
      });
    }
    feitas += 1;
    eventos.aoLeitura?.(validacao.pedido);
    try {
      const leitura = await executarPedido(validacao.pedido, contexto, portas);
      const resultado = { ferramenta: validacao.pedido.nome, leitura };
      leituras.push(resultado);
      await eventos.aoLida?.(resultado);
      return JSON.stringify(paraOModeloLeitura(leitura));
    } catch (erro) {
      if (erro instanceof LeituraRecusada) {
        recusadas += 1;
        return JSON.stringify({
          erro: erro.motivo,
          ...(erro.metricasProximas.length === 0
            ? {}
            : { metricasProximas: erro.metricasProximas }),
        });
      }
      if (erro instanceof ForaDoEscopo || erro instanceof GraoProibido) {
        recusadas += 1;
        return JSON.stringify({
          erro: "este recorte está fora do perfil de quem pergunta",
        });
      }
      throw erro;
    }
  };

  return {
    executar,
    leituras: () => leituras,
    recusadas: () => recusadas,
  };
}
