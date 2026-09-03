/**
 * O estágio 2 do chat: **a aplicação resolve, e o modelo não participa**.
 *
 * Seção 7.1 do PRD, e o princípio P2: *"o chat não calcula; o chat lê"*. Entre
 * interpretar a pergunta e redigir a resposta existe esta fronteira — aqui a
 * métrica é validada contra o catálogo, a leitura passa pela mesma camada de
 * dados que as telas usam, e o número nasce.
 *
 * O modelo recebe o resultado disto para escrever o texto. Ele nunca produz um
 * número: os que aparecem no texto entram por substituição de campo, e o
 * verificador de RF-15 confere um a um contra este envelope.
 *
 * ## O que "explicar tudo o que foi considerado" quer dizer aqui
 *
 * Quatro coisas, e nenhuma delas é o modelo contando uma história:
 *
 * 1. **a fórmula**, que vem do catálogo e é a mesma que o painel mostra na tela
 *    (RF-04, princípio P3);
 * 2. **a composição** — os degraus que compõem o número, lidos do painel que o
 *    detalha. Para o lucro líquido, é a ponte da DRE inteira;
 * 3. **o apoio** — as métricas que explicam o número, declaradas em
 *    `apoio.ts` e lidas no mesmo recorte: para o ROE, lucro e patrimônio;
 * 4. **as leituras contra o custo do dinheiro** — Selic, CDI e IPCA, com a
 *    conta feita aqui (`leitura.ts`), nunca pelo modelo.
 *
 * Tudo sai de dados, não de prosa. O modelo transforma em frase.
 */

import { lerMetrica, lerPainel } from "@/acesso/leitura";
import type { TaxaDeReferencia } from "@/acesso/referencias/sgs";
import { lerReferencias } from "@/acesso/referencias/todas";
import { apoioDe } from "@/chat/apoio";
import {
  familiaDe,
  leiturasDeCusto,
  leiturasDeResultado,
  leiturasDeRetorno,
  type ComparacaoComJuros,
  type Familia,
} from "@/chat/leitura";
import { destinoDaMetrica } from "@/chat/roteamento";
import { CATALOGO_GERADO } from "@/semantica/catalogo-gerado";
import type {
  PanelResponse,
  Query,
  Sentido,
  Unidade,
} from "@/semantica/contrato";

export type { ComparacaoComJuros, Leitura } from "@/chat/leitura";

/** Um número que entrou na conta, com o rótulo que o painel ou o catálogo lhe dá. */
export type Consideracao = {
  readonly rotulo: string;
  readonly valor: number | null;
  readonly unidade: Unidade;
  /** Degrau do painel que detalha a métrica, ou métrica de apoio lida à parte. */
  readonly origem: "painel" | "apoio";
  /** O id da métrica de apoio; `null` para degrau de painel. */
  readonly metrica: string | null;
};

/** O que o estágio 2 entrega ao estágio 3. */
export type Resolucao = {
  readonly metrica: string;
  readonly rotulo: string;
  readonly valor: number | null;
  readonly unidade: Unidade;
  readonly formula: string;
  /** A decisão registrada da métrica, quando ela tem uma (seção 9.4). */
  readonly decisao: string | null;
  readonly asOf: string;
  readonly consideracoes: readonly Consideracao[];
  /** A família de leitura da métrica, quando ela tem uma. */
  readonly familia: Familia | null;
  /** As taxas que vieram do BCB, mesmo sem comparação — o texto pode citá-las. */
  readonly referencias: readonly TaxaDeReferencia[];
  readonly comparacao: ComparacaoComJuros | null;
  /** Por que a comparação não veio, quando não veio. */
  readonly comparacaoIndisponivelPorque: string | null;
  /** O que a tela deve fazer: filtros, tela e painel destacado (RF-13). */
  readonly acoes: {
    readonly filtros: Query;
    readonly tela: string | null;
    readonly painel: string | null;
  };
  /** As views que sustentam o número, para auditoria (seção 11). */
  readonly fontes: readonly string[];
  /** O envelope do painel citado, que a tela desenha sem reler. */
  readonly painel: PanelResponse | null;
};

/** A métrica pedida não existe no catálogo. */
export class MetricaForaDoCatalogo extends Error {
  constructor(
    readonly pedida: string,
    readonly proximas: readonly string[],
  ) {
    super(
      `A métrica '${pedida}' não está no catálogo. ` +
        (proximas.length === 0
          ? "Não há nenhuma próxima para sugerir."
          : `Próximas: ${proximas.join(", ")}.`) +
        " A recusa acontece aqui, no estágio 2, antes de qualquer leitura — o " +
        "modelo não decide o que existe (seção 7.1, RF-16).",
    );
    this.name = "MetricaForaDoCatalogo";
  }
}

/**
 * As métricas de nome parecido, para a recusa ser útil (RF-16).
 *
 * *"Pergunta sem métrica correspondente recebe recusa útil — 'não tenho essa
 * métrica; tenho estas três próximas' — nunca uma estimativa."*
 */
function proximasDe(pedida: string): readonly string[] {
  const alvo = pedida.toLowerCase();
  const QUANTAS = 3;
  return Object.keys(CATALOGO_GERADO)
    .map((id) => ({
      id,
      pontos: [...alvo].filter((c) => id.includes(c)).length,
    }))
    .sort((a, b) => b.pontos - a.pontos || a.id.localeCompare(b.id))
    .slice(0, QUANTAS)
    .map((x) => x.id);
}

/**
 * Os números que compõem o resultado, lidos do painel que o detalha.
 *
 * Cada forma decompõe de um jeito, e só as que **de fato** decompõem entram: a
 * ponte da DRE tem degraus nomeados, uma rosca tem fatias, um painel de
 * estatísticas tem números com rótulo. Um gráfico de linha de doze meses não
 * decompõe nada — listar os doze pontos como "o que foi considerado" seria
 * ruído com aparência de explicação.
 */
function consideracoesDo(envelope: PanelResponse): readonly Consideracao[] {
  const doPainel = (
    rotulo: string,
    valor: number | null,
    unidade: Unidade,
  ): Consideracao => ({
    rotulo,
    valor,
    unidade,
    origem: "painel",
    metrica: null,
  });

  switch (envelope.forma) {
    case "cascata":
      return envelope.passos.map((p) =>
        doPainel(p.nome, p.valor, envelope.unit),
      );
    case "estatisticas":
      return envelope.estatisticas.map((e) =>
        doPainel(e.rotulo, e.valor, e.unidade),
      );
    case "rosca":
      return envelope.fatias.map((f) =>
        doPainel(f.nome, f.valor, envelope.unit),
      );
    case "funil":
      return envelope.passos.map((p) =>
        doPainel(p.nome, p.valor, envelope.unit),
      );
    case "divisao":
      return envelope.grupos.flatMap((g) =>
        g.partes.map((p) =>
          doPainel(`${g.nome} · ${p.nome}`, p.valor, envelope.unit),
        ),
      );
    case "barras":
    case "linha":
    case "barras-horizontais":
    case "barras-empilhadas":
    case "mosaico-geografico":
    case "dispersao":
    case "regua-de-ciclo":
      return [];
  }
}

/**
 * As métricas de apoio, lidas em paralelo e no mesmo recorte da principal.
 *
 * Sem `try/catch` de propósito: apoio que não lê é defeito nosso — métrica no
 * catálogo sem cálculo —, e o produto prefere lançar a esconder. O caso
 * legítimo, recorte sem dado, vem como `null` e a tela escreve "sem dado".
 *
 * O mapa é parâmetro para o teste injetar um sobre métricas que existem.
 */
export async function lerApoio(
  metrica: string,
  consulta: Query,
  mapa: (id: string) => readonly string[] = apoioDe,
): Promise<readonly Consideracao[]> {
  return Promise.all(
    mapa(metrica).map(async (id) => {
      const lida = await lerMetrica(id, consulta);
      return {
        rotulo: CATALOGO_GERADO[id]?.rotulo ?? id,
        valor: lida.value,
        unidade: lida.unit,
        origem: "apoio" as const,
        metrica: id,
      };
    }),
  );
}

/**
 * O número lido contra o custo do dinheiro, por família.
 *
 * A conta é da aplicação, e não do modelo (princípio P2), e vem com a fórmula
 * escrita, como todo número do produto (princípio P3). Ver `leitura.ts`.
 */
async function compararComJuros(
  metrica: string,
  rotulo: string,
  valor: number | null,
  unidade: Unidade,
  familia: Familia | null,
  consulta: Query,
  referencias: readonly TaxaDeReferencia[],
): Promise<{
  readonly comparacao: ComparacaoComJuros | null;
  readonly porque: string | null;
}> {
  if (valor === null) {
    return { comparacao: null, porque: "não há resultado no recorte" };
  }

  switch (familia) {
    case null:
      /*
       * Só medida de **resultado** ou de **retorno**, e não qualquer valor.
       *
       * Comparar a folha com a Selic escreveria "a folha rendeu 15,5% contra
       * 14%", uma frase que soa certa e não quer dizer nada: folha é custo,
       * não retorno. Margem, crescimento e retenção são taxas de outra coisa.
       */
      return {
        comparacao: null,
        porque:
          unidade === "BRL_mi"
            ? "a comparação com juros vale para resultado, e esta métrica é de custo"
            : "esta métrica não se lê contra juros",
      };

    case "resultado": {
      if (referencias.find((r) => r.id === "selic") === undefined) {
        return {
          comparacao: null,
          porque: "não foi possível ler a Selic no Banco Central agora",
        };
      }
      const receita = await lerMetrica("receita_liquida", consulta);
      if (receita.value === null || receita.value === 0) {
        return {
          comparacao: null,
          porque: "sem receita no recorte, não há base para calcular retorno",
        };
      }
      return {
        comparacao: {
          familia,
          leituras: leiturasDeResultado(valor, receita.value, referencias),
          base: {
            rotulo: "Receita líquida",
            valor: receita.value,
            unidade: "BRL_mi",
          },
        },
        porque: null,
      };
    }

    case "retorno": {
      const leituras = leiturasDeRetorno(metrica, rotulo, valor, referencias);
      if (leituras.length === 0) {
        return {
          comparacao: null,
          porque:
            "não foi possível ler o CDI nem o IPCA no Banco Central agora",
        };
      }
      return { comparacao: { familia, leituras, base: null }, porque: null };
    }

    case "custo_de_capital": {
      const leituras = leiturasDeCusto(rotulo, valor, referencias);
      if (leituras.length === 0) {
        return {
          comparacao: null,
          porque: "não foi possível ler o CDI no Banco Central agora",
        };
      }
      return { comparacao: { familia, leituras, base: null }, porque: null };
    }

    case "liquidez":
    case "alavancagem":
    case "cobertura":
    case "qualidade":
      return {
        comparacao: null,
        porque: "esta métrica se lê pelo próprio múltiplo, não contra juros",
      };
  }
}

/**
 * Resolve uma intenção já interpretada.
 *
 * Recebe a métrica e o recorte; devolve o número, o que o compõe, o apoio, as
 * leituras e para onde a tela deve ir. O modelo não entra aqui — é esta a
 * fronteira que a seção 7.1 desenha.
 *
 * As quatro leituras correm em paralelo: a pergunta espera pela mais lenta, e
 * não pela soma. As referências só são buscadas quando a métrica tem família —
 * o turnover não se lê contra o CDI, e não precisa ir ao BCB para saber disso.
 */
export async function resolver(
  metrica: string,
  consulta: Query,
): Promise<Resolucao> {
  const entrada = CATALOGO_GERADO[metrica];
  if (entrada === undefined) {
    throw new MetricaForaDoCatalogo(metrica, proximasDe(metrica));
  }

  const destino = destinoDaMetrica(metrica);
  const painelId = destino?.painel ?? null;
  const familia = familiaDe(
    metrica,
    entrada.unidade,
    entrada.sentido as Sentido,
  );

  const [valor, painel, apoio, referencias] = await Promise.all([
    lerMetrica(metrica, consulta),
    painelId === null ? Promise.resolve(null) : lerPainel(painelId, consulta),
    lerApoio(metrica, consulta),
    familia === null
      ? Promise.resolve<readonly TaxaDeReferencia[]>([])
      : lerReferencias(),
  ]);

  const { comparacao, porque } = await compararComJuros(
    metrica,
    entrada.rotulo,
    valor.value,
    valor.unit,
    familia,
    consulta,
    referencias,
  );

  // Apoio cujo rótulo já veio como degrau do painel não entra duas vezes.
  const doPainel = painel === null ? [] : consideracoesDo(painel);
  const rotulosDoPainel = new Set(doPainel.map((c) => c.rotulo));

  return {
    metrica,
    rotulo: entrada.rotulo,
    valor: valor.value,
    unidade: valor.unit,
    formula: valor.formula,
    decisao: entrada.decisao,
    asOf: valor.asOf,
    consideracoes: [
      ...doPainel,
      ...apoio.filter((a) => !rotulosDoPainel.has(a.rotulo)),
    ],
    familia,
    referencias,
    comparacao,
    comparacaoIndisponivelPorque: porque,
    acoes: {
      filtros: consulta,
      tela: destino?.tela ?? null,
      painel: painelId,
    },
    fontes: [entrada.fonte],
    painel,
  };
}
