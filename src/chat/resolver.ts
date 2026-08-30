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
 * Três coisas, e nenhuma delas é o modelo contando uma história:
 *
 * 1. **a fórmula**, que vem do catálogo e é a mesma que o painel mostra na tela
 *    (RF-04, princípio P3);
 * 2. **as considerações** — os degraus que compõem o número, lidos do painel
 *    que o detalha. Para o lucro líquido, é a ponte da DRE inteira: receita
 *    líquida, CMV, despesas, EBITDA, D&A, resultado financeiro, não
 *    operacional. Cada um com o seu valor, no mesmo recorte;
 * 3. **a referência externa**, quando ela ajuda a ler o número — hoje a Selic.
 *
 * Os três saem de dados, não de prosa. O modelo os transforma em frase.
 */

import { lerMetrica, lerPainel } from "@/acesso/leitura";
import { lerSelic, type TaxaDeReferencia } from "@/acesso/referencias/selic";
import { destinoDaMetrica } from "@/chat/roteamento";
import { CATALOGO_GERADO } from "@/semantica/catalogo-gerado";
import type { PanelResponse, Query, Unidade } from "@/semantica/contrato";

/** Um número que entrou na conta, com o rótulo que o painel lhe dá. */
export type Consideracao = {
  readonly rotulo: string;
  readonly valor: number | null;
  readonly unidade: Unidade;
};

/** A leitura do resultado contra o custo do dinheiro. */
export type ComparacaoComJuros = {
  readonly taxa: TaxaDeReferencia;
  /** O resultado em % sobre a base, para ficar na mesma unidade da taxa. */
  readonly retornoPercentual: number;
  /** Sobre o que a porcentagem foi calculada. */
  readonly base: { readonly rotulo: string; readonly valor: number };
  /** Como o número foi obtido. Princípio P3 vale aqui também. */
  readonly formula: string;
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
  switch (envelope.forma) {
    case "cascata":
      return envelope.passos.map((p) => ({
        rotulo: p.nome,
        valor: p.valor,
        unidade: envelope.unit,
      }));
    case "estatisticas":
      return envelope.estatisticas.map((e) => ({
        rotulo: e.rotulo,
        valor: e.valor,
        unidade: e.unidade,
      }));
    case "rosca":
      return envelope.fatias.map((f) => ({
        rotulo: f.nome,
        valor: f.valor,
        unidade: envelope.unit,
      }));
    case "funil":
      return envelope.passos.map((p) => ({
        rotulo: p.nome,
        valor: p.valor,
        unidade: envelope.unit,
      }));
    case "divisao":
      return envelope.grupos.flatMap((g) =>
        g.partes.map((p) => ({
          rotulo: `${g.nome} · ${p.nome}`,
          valor: p.valor,
          unidade: envelope.unit,
        })),
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

/** Fração convertida em porcentagem. */
const PERCENTUAL = 100;

/**
 * O resultado lido contra o custo do dinheiro.
 *
 * Um lucro em reais e uma taxa em % ao ano não se comparam direto. O que se
 * compara é o **retorno**: quanto o resultado representa sobre a base que o
 * gerou. Com receita líquida de R$ 1.200 mi e lucro de -R$ 8 mi, o retorno é
 * -0,7% — e a Selic a 14% diz o resto da frase sozinha.
 *
 * A conta é da aplicação, e não do modelo (princípio P2), e vem com a fórmula
 * escrita, como todo número do produto (princípio P3).
 */
async function compararComJuros(
  valor: number | null,
  unidade: Unidade,
  sentido: string,
  consulta: Query,
): Promise<{
  readonly comparacao: ComparacaoComJuros | null;
  readonly porque: string | null;
}> {
  if (valor === null) {
    return { comparacao: null, porque: "não há resultado no recorte" };
  }
  if (unidade !== "BRL_mi") {
    return {
      comparacao: null,
      porque: "a comparação com juros vale para resultado em reais",
    };
  }

  /*
   * Só medida de **resultado**, e não qualquer valor em reais.
   *
   * Comparar a folha com a Selic escreveria "a folha rendeu 15,5% contra 14%",
   * uma frase que soa certa e não quer dizer nada: folha é custo, não retorno.
   * O catálogo já distingue os dois — `sentido` diz se subir é bom —, e é essa
   * distinção que decide se a comparação faz sentido.
   */
  if (sentido !== "maior_melhor") {
    return {
      comparacao: null,
      porque:
        "a comparação com juros vale para resultado, e esta métrica é de custo",
    };
  }

  const taxa = await lerSelic();
  if (taxa === null) {
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
      taxa,
      retornoPercentual: (valor / receita.value) * PERCENTUAL,
      base: { rotulo: "Receita líquida", valor: receita.value },
      formula: "retorno = resultado ÷ receita líquida do mesmo recorte",
    },
    porque: null,
  };
}

/**
 * Resolve uma intenção já interpretada.
 *
 * Recebe a métrica e o recorte; devolve o número, o que o compõe, a comparação
 * e para onde a tela deve ir. O modelo não entra aqui — é esta a fronteira que
 * a seção 7.1 desenha.
 */
export async function resolver(
  metrica: string,
  consulta: Query,
): Promise<Resolucao> {
  const entrada = CATALOGO_GERADO[metrica];
  if (entrada === undefined) {
    throw new MetricaForaDoCatalogo(metrica, proximasDe(metrica));
  }

  const [valor, destino] = [
    await lerMetrica(metrica, consulta),
    destinoDaMetrica(metrica),
  ];

  const painel =
    destino?.painel === undefined || destino.painel === null
      ? null
      : await lerPainel(destino.painel, consulta);

  const { comparacao, porque } = await compararComJuros(
    valor.value,
    valor.unit,
    entrada.sentido,
    consulta,
  );

  return {
    metrica,
    rotulo: entrada.rotulo,
    valor: valor.value,
    unidade: valor.unit,
    formula: valor.formula,
    decisao: entrada.decisao,
    asOf: valor.asOf,
    consideracoes: painel === null ? [] : consideracoesDo(painel),
    comparacao,
    comparacaoIndisponivelPorque: porque,
    acoes: {
      filtros: consulta,
      tela: destino?.tela ?? null,
      painel: destino?.painel ?? null,
    },
    fontes: [entrada.fonte],
    painel,
  };
}
