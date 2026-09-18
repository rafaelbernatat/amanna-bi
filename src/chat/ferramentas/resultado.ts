/**
 * O que uma ferramenta devolve: a leitura, já formatada, com os rótulos que
 * o verificador vai exigir por perto de cada número.
 *
 * Os tipos moram aqui, e não em `executar.ts`, porque três lugares os leem:
 * o executor os produz, o verificador (`perguntar.ts`) confere o texto contra
 * eles, e a tela os desenha. Nenhum dos três deriva número novo: o que está
 * em `formatado` é o que aparece.
 */

import { formatarValor } from "@/apresentacao/formato/formato";
import type { Derivada } from "@/chat/ferramentas/derivar";
import type { NomeDeFerramenta } from "@/chat/ferramentas/catalogo";
import {
  variantesDoRotulo,
  type PontoDoResumo,
  type ResumoDoPainel,
} from "@/chat/grafico";
import type {
  DimensaoDeRanking,
  PanelResponse,
  Query,
  Unidade,
} from "@/semantica/contrato";

/** Um valor com a sua forma escrita. */
export type ValorFormatado = {
  readonly valor: number | null;
  readonly formatado: string | null;
};

export type LeituraDeMetrica = {
  readonly tipo: "metrica";
  readonly metrica: string;
  readonly rotulo: string;
  readonly unidade: Unidade;
  readonly valor: number | null;
  readonly formatado: string | null;
  readonly formula: string;
  readonly asOf: string;
  readonly filtros: Query;
};

export type LeituraDeSerie = {
  readonly tipo: "serie";
  readonly metrica: string;
  readonly rotulo: string;
  readonly unidade: Unidade;
  /** O painel de onde a série saiu. */
  readonly painel: string;
  readonly pontos: readonly PontoDoResumo[];
  readonly destaques: ResumoDoPainel["destaques"];
  readonly filtros: Query;
  /** O envelope lido, para a conversa desenhar sem reler (T-432). */
  readonly desenho: PanelResponse;
};

export type LeituraDeComparacao = {
  readonly tipo: "comparacao";
  readonly itens: readonly LeituraDeMetrica[];
  /** `a − b` das duas primeiras, quando têm a mesma unidade e valor. */
  readonly diferenca: Derivada | null;
  readonly filtros: Query;
};

export type LeituraDeVariacao = {
  readonly tipo: "variacao";
  readonly metrica: string;
  readonly rotulo: string;
  readonly unidade: Unidade;
  readonly atual: ValorFormatado & { readonly ano: string };
  readonly anterior: ValorFormatado & { readonly ano: string };
  readonly diferenca: Derivada | null;
  readonly variacaoPercentual: Derivada | null;
  readonly filtros: Query;
};

export type ItemDeRankingLido = {
  readonly codigo: string;
  readonly rotulo: string;
  readonly valor: number | null;
  readonly formatado: string | null;
  readonly participacao: Derivada | null;
};

export type LeituraDeRanking = {
  readonly tipo: "ranking" | "decomposicao";
  readonly metrica: string;
  readonly rotulo: string;
  readonly dimensao: DimensaoDeRanking;
  readonly unidade: Unidade;
  readonly itens: readonly ItemDeRankingLido[];
  readonly total: ValorFormatado;
  /** O que ficou fora dos itens mostrados, quando a lista foi cortada. */
  readonly outros: Derivada | null;
  readonly abre: boolean;
  readonly truncado: boolean;
  readonly formula: string;
  readonly asOf: string;
  readonly filtros: Query;
  /** Os itens como barras horizontais, montadas do que foi lido (T-432). */
  readonly desenho: PanelResponse;
};

export type LeituraDeGrafico = {
  readonly tipo: "grafico";
  readonly resumo: ResumoDoPainel;
  readonly filtros: Query;
  /** O envelope lido, para a conversa desenhar sem reler (T-432). */
  readonly desenho: PanelResponse;
};

export type LeituraDeCatalogo = {
  readonly tipo: "catalogo";
  readonly busca: string;
  readonly metricas: readonly {
    readonly id: string;
    readonly rotulo: string;
    readonly unidade: Unidade;
  }[];
};

export type LeituraDeFerramenta =
  | LeituraDeMetrica
  | LeituraDeSerie
  | LeituraDeComparacao
  | LeituraDeVariacao
  | LeituraDeRanking
  | LeituraDeGrafico
  | LeituraDeCatalogo;

/** Uma leitura, com a ferramenta que a produziu, como fica na `Resolucao`. */
export type ResultadoDeFerramenta = {
  readonly ferramenta: NomeDeFerramenta;
  readonly leitura: LeituraDeFerramenta;
};

/* ------------------------------------------------------------------ *
 * O que o verificador pode aceitar
 * ------------------------------------------------------------------ */

/**
 * Um número que o texto pode citar. `rotulos` nulo é número livre — o valor
 * de uma métrica, um total, uma derivação nossa. Com rótulos, o número só
 * passa se um deles estiver por perto no texto.
 */
export type NumeroPermitido = {
  readonly texto: string;
  readonly rotulos: readonly string[] | null;
};

function livre(formatado: string | null): NumeroPermitido[] {
  return formatado === null ? [] : [{ texto: formatado, rotulos: null }];
}

function comRotulo(p: PontoDoResumo): NumeroPermitido[] {
  return p.formatado === null
    ? []
    : [{ texto: p.formatado, rotulos: variantesDoRotulo(p.rotulo) }];
}

/** Os números de um resumo de painel: destaques e total livres, pontos com rótulo. */
export function numerosDoResumo(r: ResumoDoPainel): NumeroPermitido[] {
  return [
    ...livre(r.total?.formatado ?? null),
    ...r.destaques.flatMap((d) => livre(d.ponto.formatado)),
    ...r.pontos.flatMap(comRotulo),
  ];
}

/** Os números que uma leitura autoriza o texto a citar. */
export function numerosDe(l: LeituraDeFerramenta): readonly NumeroPermitido[] {
  switch (l.tipo) {
    case "metrica":
      return livre(l.formatado);
    case "serie":
      return [
        ...l.destaques.flatMap((d) => livre(d.ponto.formatado)),
        ...l.pontos.flatMap(comRotulo),
      ];
    case "comparacao":
      return [
        ...l.itens.flatMap((i) => livre(i.formatado)),
        ...livre(l.diferenca?.formatado ?? null),
      ];
    case "variacao":
      return [
        ...livre(l.atual.formatado),
        ...livre(l.anterior.formatado),
        ...livre(l.diferenca?.formatado ?? null),
        ...livre(l.variacaoPercentual?.formatado ?? null),
      ];
    case "ranking":
    case "decomposicao":
      return [
        ...livre(l.total.formatado),
        ...livre(l.outros?.formatado ?? null),
        ...l.itens.flatMap((i) =>
          i.formatado === null
            ? []
            : [
                { texto: i.formatado, rotulos: variantesDoRotulo(i.rotulo) },
                ...(i.participacao === null
                  ? []
                  : [
                      {
                        texto: i.participacao.formatado,
                        rotulos: variantesDoRotulo(i.rotulo),
                      },
                    ]),
              ],
        ),
      ];
    case "grafico":
      return numerosDoResumo(l.resumo);
    case "catalogo":
      return [];
  }
}

/* ------------------------------------------------------------------ *
 * A frase montada de cada leitura
 * ------------------------------------------------------------------ */

const SEM_DADO = "sem dado neste recorte";

function ouSemDado(formatado: string | null): string {
  return formatado ?? SEM_DADO;
}

/**
 * Uma frase por leitura, feita só dos campos formatados.
 *
 * É o piso do texto composto: quando o modelo escreve um número que não
 * existe, o que vai para a tela é isto. Não tem como divergir do envelope.
 */
export function fraseDe(l: LeituraDeFerramenta): string {
  switch (l.tipo) {
    case "metrica":
      return `${l.rotulo}: ${ouSemDado(l.formatado)}.`;
    case "serie": {
      const partes = l.destaques.map(
        (d) =>
          `${d.tipo === "maior" ? "pico" : d.tipo === "menor" ? "vale" : "último"} em ${d.ponto.rotulo} (${ouSemDado(d.ponto.formatado)})`,
      );
      return `${l.rotulo}, mês a mês: ${partes.length === 0 ? SEM_DADO : partes.join("; ")}.`;
    }
    case "comparacao": {
      const itens = l.itens
        .map((i) => `${i.rotulo} ${ouSemDado(i.formatado)}`)
        .join("; ");
      const dif =
        l.diferenca === null
          ? ""
          : ` Diferença: ${l.diferenca.formatado} (${l.diferenca.formula}).`;
      return `Comparação: ${itens}.${dif}`;
    }
    case "variacao": {
      const dif =
        l.diferenca === null
          ? ""
          : ` Diferença: ${l.diferenca.formatado}` +
            (l.variacaoPercentual === null
              ? "."
              : `, ou ${l.variacaoPercentual.formatado}.`);
      return (
        `${l.rotulo}: ${ouSemDado(l.atual.formatado)} em ${l.atual.ano}, ` +
        `contra ${ouSemDado(l.anterior.formatado)} em ${l.anterior.ano}.${dif}`
      );
    }
    case "ranking":
    case "decomposicao": {
      if (!l.abre) {
        return `${l.rotulo} não abre por ${l.dimensao.replace(/_/g, " ")} nesta fonte.`;
      }
      const itens = l.itens
        .map(
          (i) =>
            `${i.rotulo} ${ouSemDado(i.formatado)}` +
            (i.participacao === null ? "" : ` (${i.participacao.formatado})`),
        )
        .join("; ");
      const outros = l.outros === null ? "" : ` Outros: ${l.outros.formatado}.`;
      return `${l.rotulo} por ${l.dimensao.replace(/_/g, " ")}: ${itens}. Total: ${ouSemDado(l.total.formatado)}.${outros}`;
    }
    case "grafico": {
      const r = l.resumo;
      const destaques = r.destaques
        .map(
          (d) =>
            `${d.tipo} em ${d.ponto.rotulo} (${ouSemDado(d.ponto.formatado)})`,
        )
        .join("; ");
      const total =
        r.total === null ? "" : ` Total: ${ouSemDado(r.total.formatado)}.`;
      return (
        `O gráfico "${r.titulo}" (${r.forma}) mostra ${String(r.quantidadeDePontos)} ponto(s)` +
        (destaques === "" ? "." : `: ${destaques}.`) +
        total +
        (r.nota === null ? "" : ` ${r.nota}`)
      );
    }
    case "catalogo":
      return l.metricas.length === 0
        ? `Nenhuma métrica do catálogo casa com "${l.busca}".`
        : `Métricas próximas de "${l.busca}": ${l.metricas.map((m) => m.rotulo).join("; ")}.`;
  }
}

/** Formata um valor lido, ou `null`. Atalho para quem monta leituras. */
export function formatado(
  valor: number | null,
  unidade: Unidade,
): string | null {
  return valor === null ? null : formatarValor(valor, unidade);
}
