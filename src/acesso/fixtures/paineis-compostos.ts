/**
 * O desenho das quatro formas compostas — os 6 painéis de T-119.
 *
 * Cascata, dispersão, régua de ciclo e mosaico geográfico. São as formas em que
 * o **arranjo** carrega significado: a cascata só faz sentido se os degraus
 * fecharem, a régua só faz sentido se as faixas se encaixarem, e a dispersão só
 * faz sentido se os dois eixos medirem coisas comparáveis entre si.
 *
 * ## O que a cascata promete
 *
 * Que os degraus **fecham sem resíduo**. Uma ponte da DRE que não chega ao
 * lucro líquido é pior que nenhuma: ela parece uma explicação completa e não é,
 * e quem a lê vai procurar o dinheiro que falta no lugar errado. Aqui o último
 * degrau é somado a partir dos anteriores, e não lido à parte — não há como
 * divergirem.
 */

import {
  VW_FATO_FATURAMENTO_CLIENTE,
  VW_FATO_FIN_MES,
} from "@/acesso/fixtures/fin";
import {
  calculoDaMetrica,
  emMilhoes,
  linhas,
  perfil,
  razao,
  type Recorte,
  soma,
} from "@/acesso/fixtures/kpis";
import { VW_DIM_UF } from "@/acesso/fixtures/dim";
import { TOP_CLIENTES } from "@/acesso/fixtures/referencia-perfil";
import type { Query, Sentido } from "@/semantica/contrato";

const BASE_DA_MARGEM = 100;

/** O que cada forma composta produz. */
export type DesenhoComposto =
  | {
      readonly forma: "cascata";
      readonly passos: readonly {
        readonly nome: string;
        readonly valor: number;
        readonly ehTotal: boolean;
      }[];
      readonly total: number | null;
    }
  | {
      readonly forma: "dispersao";
      readonly eixoX: { readonly rotulo: string; readonly unidade: "BRL_mi" };
      readonly eixoY: {
        readonly rotulo: string;
        readonly unidade: "BRL_mi" | "pct";
      };
      readonly pontos: readonly {
        readonly rotulo: string;
        readonly x: number;
        readonly y: number;
        readonly tamanho: number | null;
      }[];
      readonly total: number | null;
    }
  | {
      readonly forma: "regua-de-ciclo";
      readonly marcos: readonly {
        readonly dia: number;
        readonly rotulo: string;
      }[];
      readonly faixas: readonly {
        readonly de: number;
        readonly ate: number;
        readonly rotulo: string;
        readonly sentido: Sentido;
      }[];
      readonly total: number | null;
    }
  | {
      readonly forma: "mosaico-geografico";
      readonly celulas: readonly {
        readonly uf: string;
        readonly valor: number | null;
      }[];
      readonly total: number | null;
    };

function daMetrica(nome: string): (r: Recorte) => number | null {
  const calculo = calculoDaMetrica(nome);
  if (calculo === undefined) {
    throw new Error(
      `A métrica '${nome}' não tem cálculo. Um painel composto a pediu.`,
    );
  }
  return calculo;
}

/**
 * Monta uma cascata a partir dos degraus intermediários.
 *
 * Os totais **não** são lidos à parte: o primeiro é dado, e cada total
 * seguinte é a soma corrente dos degraus que vieram antes. É essa construção
 * que faz "fechar sem resíduo" ser uma propriedade e não uma coincidência a
 * conferir depois.
 *
 * Recebe `null` em qualquer degrau e devolve cascata vazia: meia ponte é pior
 * que nenhuma.
 */
function cascata(
  inicio: { readonly nome: string; readonly valor: number | null },
  degraus: readonly {
    readonly nome: string;
    readonly valor: number | null;
    readonly fechaAqui?: string;
  }[],
): DesenhoComposto {
  if (inicio.valor === null || degraus.some((d) => d.valor === null)) {
    return { forma: "cascata", passos: [], total: null };
  }

  const passos: { nome: string; valor: number; ehTotal: boolean }[] = [
    { nome: inicio.nome, valor: inicio.valor, ehTotal: true },
  ];
  let corrente = inicio.valor;

  for (const degrau of degraus) {
    const valor = degrau.valor ?? 0;
    passos.push({ nome: degrau.nome, valor, ehTotal: false });
    corrente += valor;
    if (degrau.fechaAqui !== undefined) {
      passos.push({ nome: degrau.fechaAqui, valor: corrente, ehTotal: true });
    }
  }

  return { forma: "cascata", passos, total: corrente };
}

/* ------------------------------------------------------------------ *
 * Os seis
 * ------------------------------------------------------------------ */

type Fabrica = (r: Recorte) => DesenhoComposto;

export const DESENHO_COMPOSTO: Readonly<Record<string, Fabrica>> = {
  "fin-dre": (r) => {
    const emMi = (medida: (l: (typeof VW_FATO_FIN_MES)[number]) => number) =>
      emMilhoes(soma("vw_fato_fin_mes", r, medida));

    /*
     * Os degraus saem com o **sinal do efeito sobre o resultado**: CMV entra
     * negativo porque consome receita. Guardá-los positivos e inverter no
     * desenho espalharia a convenção por dois lugares, e a próxima forma que
     * usasse a mesma view herdaria o sinal errado.
     */
    return cascata(
      { nome: "Receita líquida", valor: emMi((l) => l.receitaLiquida) },
      [
        { nome: "CMV", valor: negativo(emMi((l) => l.cmv)) },
        {
          nome: "Despesas operacionais",
          valor: negativo(emMi((l) => l.despesasOperacionais)),
          fechaAqui: "EBITDA",
        },
        {
          nome: "D&A",
          valor: negativo(emMi((l) => l.depreciacaoEAmortizacao)),
        },
        {
          nome: "Resultado financeiro",
          valor: negativo(emMi((l) => l.resultadoFinanceiro)),
        },
        {
          nome: "Não operacional",
          valor: negativo(emMi((l) => l.naoOperacional)),
          fechaAqui: "Lucro líquido",
        },
      ],
    );
  },

  "cx-ponte": (r) => {
    const emMi = (medida: (l: (typeof VW_FATO_FIN_MES)[number]) => number) =>
      emMilhoes(soma("vw_fato_fin_mes", r, medida));

    /*
     * O saldo inicial não é uma coluna: é o saldo do fim da janela menos tudo
     * o que aconteceu dentro dela. Lê-lo de outro lugar abriria a porta para a
     * ponte fechar num número e o painel de saldo mostrar outro.
     */
    const fim = daMetrica("saldo_caixa")(r);
    const fco = emMi((l) => l.fco);
    const capex = negativo(emMi((l) => l.capex));
    const financiamento = negativo(emMi((l) => l.financiamento));
    const movimento =
      fco === null || capex === null || financiamento === null
        ? null
        : fco + capex + financiamento;
    const inicio = fim === null || movimento === null ? null : fim - movimento;

    return cascata({ nome: "Saldo inicial", valor: inicio }, [
      { nome: "Operacional (FCO)", valor: fco },
      { nome: "Investimento (FCI)", valor: capex },
      {
        nome: "Financiamento (FCF)",
        valor: financiamento,
        fechaAqui: "Saldo final",
      },
    ]);
  },

  "ct-ciclo": (r) => {
    const pmr = daMetrica("pmr")(r);
    const pme = daMetrica("pme")(r);
    const pmp = daMetrica("pmp")(r);
    const ciclo = daMetrica("ciclo_financeiro")(r);

    if (pmr === null || pme === null || pmp === null || ciclo === null) {
      return { forma: "regua-de-ciclo", marcos: [], faixas: [], total: null };
    }

    /*
     * A régua é uma linha do tempo de uma unidade de estoque.
     *
     * Dia 0 é a compra. O fornecedor é pago no dia PMP. A venda acontece no dia
     * PME — quando o estoque gira — e o cliente paga PMR dias depois. O que
     * sobra entre pagar e receber é o ciclo, e é ele que consome capital de
     * giro.
     *
     * O ciclo não é desenhado como um marco: é a **faixa** entre o pagamento e
     * o recebimento, e por isso `de` e `ate` vêm dos outros dois marcos em vez
     * de de uma quarta medida. Somar PMR + PME − PMP e desenhar um traço solto
     * daria o mesmo número por outro caminho — e caminhos diferentes divergem.
     */
    return {
      forma: "regua-de-ciclo",
      marcos: [
        { dia: 0, rotulo: "Compra" },
        { dia: pmp, rotulo: "Paga o fornecedor (PMP)" },
        { dia: pme, rotulo: "Fatura (PME)" },
        { dia: pme + pmr, rotulo: "Recebe do cliente (PMR)" },
      ],
      faixas: [
        {
          de: 0,
          ate: pmp,
          rotulo: "Prazo do fornecedor (PMP)",
          sentido: "maior_melhor",
        },
        {
          de: 0,
          ate: pme,
          rotulo: "Estoque (PME)",
          sentido: "menor_melhor",
        },
        {
          de: pme,
          ate: pme + pmr,
          rotulo: "Recebimento (PMR)",
          sentido: "menor_melhor",
        },
        {
          de: pmp,
          ate: pme + pmr,
          rotulo: "Ciclo sem caixa",
          sentido: "menor_melhor",
        },
      ],
      total: ciclo,
    };
  },

  "fat-margem": (r) => {
    const doRecorte = linhas("vw_fato_faturamento_cliente", r);
    const pontos = TOP_CLIENTES.flatMap((cliente) => {
      const dele = doRecorte.filter((l) => l.cliente === cliente.codigo);
      if (dele.length === 0) return [];
      const receita = dele.reduce((a, l) => a + l.receita, 0);
      const margem = dele.reduce((a, l) => a + l.margemBase, 0);
      const emMi = emMilhoes(receita);
      const pct = razao(margem, receita);
      if (emMi === null || pct === null) return [];
      return [
        {
          rotulo: cliente.codigo,
          x: emMi,
          y: pct * BASE_DA_MARGEM,
          /*
           * O tamanho é a própria receita, de propósito.
           *
           * O protótipo usa `4 + c.r / 22` — geometria de pixel dentro do dado.
           * Aqui o envelope entrega a grandeza e a apresentação decide o raio:
           * é a regra 2 da seção 9.2, e é o que permite trocar a escala do
           * desenho sem tocar no número.
           */
          tamanho: emMi,
        },
      ];
    });

    return {
      forma: "dispersao",
      eixoX: { rotulo: "Receita do cliente", unidade: "BRL_mi" },
      eixoY: { rotulo: "Margem de contribuição", unidade: "pct" },
      pontos,
      total:
        pontos.length === 0
          ? null
          : emMilhoes(doRecorte.reduce((a, l) => a + l.receita, 0)),
    };
  },

  "int-scatter": (r) => {
    const areas = areasDoRecorte(r);
    const pontos = areas.flatMap((area) => {
      const daArea: Recorte = { ...r, q: { ...r.q, area } };
      const custo = daMetrica("custo_por_fte")(daArea);
      const receita = daMetrica("receita_por_fte")(daArea);
      const quadro = daMetrica("headcount_fte")(daArea);
      if (custo === null || receita === null) return [];
      return [{ rotulo: area, x: custo, y: receita, tamanho: quadro }];
    });

    return {
      forma: "dispersao",
      eixoX: { rotulo: "Custo anual por FTE", unidade: "BRL_mi" },
      eixoY: { rotulo: "Receita atribuída por FTE", unidade: "BRL_mi" },
      pontos,
      total: daMetrica("receita_por_fte")(r),
    };
  },

  "col-mapa": (r) => {
    /*
     * Uma célula por UF do cadastro.
     *
     * Nulo e zero são coisas diferentes aqui, e vale dizer qual acontece:
     * `vw_fato_rh_perfil` materializa todas as combinações, então **toda** UF
     * do cadastro tem linha em toda célula. Zero é medida — "não há ninguém
     * desta área neste estado" — e é o que aparece sob recorte estreito, em
     * 195 células ao longo dos recortes possíveis.
     *
     * Nulo fica reservado para o caso que a fixture não produz: UF sem linha
     * nenhuma. Quando o dado real entrar, ele acontece — um estado que saiu do
     * cadastro, um mês sem carga — e aí a célula precisa ficar cinza em vez de
     * ser pintada na cor mais fraca. Manter os dois casos distintos agora custa
     * uma linha; descobrir depois que zero e ausência viraram a mesma coisa
     * custa uma reunião.
     */
    const celulas = VW_DIM_UF.map((uf) => ({
      uf: uf.codigo,
      valor: perfil(r, "uf", [uf.codigo]),
    }));
    const conhecidos = celulas
      .map((c) => c.valor)
      .filter((v): v is number => v !== null);
    return {
      forma: "mosaico-geografico",
      celulas,
      total:
        conhecidos.length === 0 ? null : conhecidos.reduce((a, b) => a + b, 0),
    };
  },
};

/** As áreas do recorte — uma sob filtro de área, as sete no consolidado. */
function areasDoRecorte(r: Recorte): readonly Query["area"][] {
  if (r.q.area !== "todas") return [r.q.area];
  return [
    "operacoes",
    "comercial",
    "tecnologia",
    "logistica",
    "financeiro",
    "marketing",
    "rh",
  ];
}

/** O simétrico de um número, preservando a ausência. */
function negativo(valor: number | null): number | null {
  return valor === null ? null : -valor;
}

/** Os painéis compostos que já sabem se desenhar. */
export function paineisCompostosComDesenho(): readonly string[] {
  return Object.keys(DESENHO_COMPOSTO);
}

/** Só para o teste: a view que o mosaico usa como vocabulário de UF. */
export const UFS_DO_MOSAICO = VW_DIM_UF.map((u) => u.codigo);

/** Idem: os clientes que a dispersão de margem pode desenhar. */
export const CLIENTES_DA_DISPERSAO = TOP_CLIENTES.map((c) => c.codigo);

/** Idem: as linhas de faturamento, para conferir a reconciliação. */
export const FATURAMENTO = VW_FATO_FATURAMENTO_CLIENTE;
