/**
 * `getPanel` para barras, linha e barras empilhadas — os 31 painéis de T-117.
 *
 * ## O painel e o cartão calculam pela mesma função
 *
 * Onde a medida do painel é a mesma do cartão, o desenho chama
 * `calculoDaMetrica` em vez de repetir a conta. `rh/visao` mostra o turnover
 * como cartão e como linha ao mesmo tempo; com duas implementações bastaria uma
 * divergência de denominador para a tela exibir dois números para a mesma coisa,
 * e quem os visse não teria como saber qual está certo. É o princípio PR-1
 * aplicado ao código, e não só ao dado.
 *
 * ## Cada categoria é um recorte de um mês
 *
 * A série mensal não tem fórmula própria: é a mesma métrica avaliada num
 * recorte de um mês só, mês a mês, com os mesmos filtros dimensionais. Corrigir
 * a fórmula corrige o painel junto, por construção.
 *
 * ## O que este módulo não faz
 *
 * **Nota em prosa.** `note` sai sempre nula, e isso é o contrato — "nula quando
 * não vale para o recorte". Escrever nota aqui seria escrever um número
 * absoluto que só vale no consolidado e deixá-lo aparecer sob qualquer recorte,
 * que é exatamente o defeito que T-133 existe para caçar. A nota é dela.
 *
 * **Formatar.** Nenhum número sai daqui como texto. Unidade e casas são da
 * apresentação (regra 2 da seção 9.2).
 */

import {
  diasUteisDoMes,
  VW_FATO_CAIXA_DIARIO,
} from "@/acesso/fixtures/caixa-diario";
import { AGREGADO_DE_AREA } from "@/acesso/fixtures/eixos";
import {
  VW_FATO_CONTAS,
  VW_FATO_FATURAMENTO_CLIENTE,
  VW_FATO_ORCAMENTO,
} from "@/acesso/fixtures/fin";
import {
  calculoDaMetrica,
  emMilhoes,
  emPorcento,
  pertence,
  perfil,
  razao,
  type Recorte,
  recorteDe,
  soma,
} from "@/acesso/fixtures/kpis";
import {
  CENTROS_DE_CUSTO,
  FAIXAS_DE_AGING,
} from "@/acesso/fixtures/referencia-fin";
import {
  FAIXAS_DE_RATING,
  type NomeDeQuebra,
  QUEBRAS_DO_QUADRO,
} from "@/acesso/fixtures/referencia-perfil";
import { VW_FATO_RH_MES, VW_FATO_VAGAS } from "@/acesso/fixtures/rh";
import { VW_FATO_TURNOVER_CUSTO } from "@/acesso/fixtures/turnover-custo";
import {
  DESENHO_CATEGORICO,
  paineisCategoricosComDesenho,
} from "@/acesso/fixtures/paineis-categoricos";
import type { Unidade } from "@/semantica/contrato";
import type {
  PainelBarras,
  PainelBarrasEmpilhadas,
  PainelBarrasHorizontais,
  PainelDivisao,
  PainelEstatisticas,
  PainelFunil,
  PainelLinha,
  PainelRosca,
  Query,
  Serie,
} from "@/semantica/contrato";
import type { DesenhoCategorico } from "@/acesso/fixtures/paineis-categoricos";
import type { OrigemDePainel } from "@/semantica/origem-de-painel";
import { origemDoPainel } from "@/semantica/origem-de-painel";
import { painelPorId } from "@/semantica/paineis";

/** O painel pedido não existe no registro de T-107. */
export class PainelDesconhecido extends Error {
  constructor(id: string) {
    super(
      `Não existe painel '${id}' no registro dos 71. Devolver envelope vazio ` +
        "aqui faria um id errado parecer um recorte sem dado.",
    );
    this.name = "PainelDesconhecido";
  }
}

/** O painel existe, mas ainda não sabe se desenhar. Nomeia a tarefa. */
export class PainelSemDesenho extends Error {
  constructor(id: string, forma: string) {
    super(
      `O painel '${id}' é da forma '${forma}', que entra com T-118 ou T-119. ` +
        "Devolver vazio misturaria 'sem dado no recorte' com 'sem código'.",
    );
    this.name = "PainelSemDesenho";
  }
}

/**
 * O que um desenho produz.
 *
 * `total` é o número que o painel afirma sobre a janela inteira, e **não** a
 * soma das categorias. A diferença importa em toda medida que não se soma:
 * somar doze percentuais de folha sobre receita daria 186 %, e o painel
 * passaria a afirmar algo que não existe. Para essas, o total é a mesma medida
 * avaliada sobre a janela toda — que é como o cartão da mesma tela a calcula, e
 * é o que impede painel e cartão de discordarem (princípio PR-1).
 */
type Desenho = {
  readonly categorias: readonly string[];
  readonly valores: readonly (readonly (number | null)[])[];
  readonly total: number | null;
};

const CEM = 100;

/* ------------------------------------------------------------------ *
 * Auxiliares de desenho
 * ------------------------------------------------------------------ */

/** A métrica do catálogo, ou um erro que diz qual falta. */
function daMetrica(nome: string): (r: Recorte) => number | null {
  const calculo = calculoDaMetrica(nome);
  if (calculo === undefined) {
    throw new Error(
      `A métrica '${nome}' não tem cálculo. Um painel a pediu, e devolver ` +
        "nulo esconderia a falta atrás de um gráfico vazio.",
    );
  }
  return calculo;
}

/** Avalia mês a mês: cada categoria é um recorte de um mês só. */
function porMes(
  r: Recorte,
  medir: (mensal: Recorte) => number | null,
): readonly (number | null)[] {
  return r.meses.map((mes) => medir({ ...r, meses: [mes] }));
}

/** A série de uma métrica do catálogo, mês a mês. */
function serieDaMetrica(r: Recorte, nome: string): readonly (number | null)[] {
  const calculo = daMetrica(nome);
  return porMes(r, calculo);
}

/** Uma linha de referência: o mesmo valor em toda categoria. */
function constante(
  quantas: number,
  valor: number | null,
): readonly (number | null)[] {
  return Array.from({ length: quantas }, () => valor);
}

/** A soma acumulada, preservando a ausência. */
function acumular(
  serie: readonly (number | null)[],
): readonly (number | null)[] {
  let total: number | null = null;
  return serie.map((v) => {
    if (v === null) return total;
    total = (total ?? 0) + v;
    return total;
  });
}

/**
 * A quebra de uma view por um atributo, somando uma medida.
 *
 * Devolve na ordem das categorias pedidas, e **não** na ordem em que os valores
 * aparecem nos dados: categoria sem linha vira nulo em vez de sumir. Um painel
 * que perde categorias conforme o recorte muda de forma na tela, e quem compara
 * dois recortes lado a lado compara desenhos diferentes.
 */
function quebrar<T extends { mes: string }>(
  todas: readonly T[],
  r: Recorte,
  categorias: readonly string[],
  chave: (l: T) => string,
  medida: (l: T) => number,
): readonly (number | null)[] {
  const doRecorte = todas.filter((l) => pertence(l as T & { mes: string }, r));
  return categorias.map((categoria) => {
    const daCategoria = doRecorte.filter((l) => chave(l) === categoria);
    return daCategoria.length === 0
      ? null
      : daCategoria.reduce((a, l) => a + medida(l), 0);
  });
}

/**
 * A série mensal de uma medida, com o total da janela junto.
 *
 * A mesma função entra nas duas pontas: aplicada a um recorte de um mês dá o
 * ponto, aplicada ao recorte inteiro dá o total. É essa identidade que garante
 * que o número grande do painel e os pontos dele venham da mesma definição.
 */
function mensalComTotal(
  r: Recorte,
  medir: (recorte: Recorte) => number | null,
): { valores: readonly (number | null)[]; total: number | null } {
  return { valores: porMes(r, medir), total: medir(r) };
}

/** A soma de uma partição — aging, componentes, faixas. Nula se tudo é nulo. */
function somaDaSerie(serie: readonly (number | null)[]): number | null {
  const conhecidos = serie.filter((v): v is number => v !== null);
  return conhecidos.length === 0 ? null : conhecidos.reduce((a, b) => a + b, 0);
}

/** O último mês da janela, para as medidas de estoque. */
function ultimoMes(r: Recorte): string | undefined {
  return r.meses.at(-1);
}

/* ------------------------------------------------------------------ *
 * O desenho de cada painel
 * ------------------------------------------------------------------ */

type FabricaDeDesenho = (r: Recorte) => Desenho;

const DESENHO: Readonly<Record<string, FabricaDeDesenho>> = {
  /* ---------------- rh/visao ---------------- */

  "rh-headcount": (r) => {
    const admissoes = mensalComTotal(r, (m) =>
      soma("vw_fato_rh_mes", m, (l) => l.admissoes),
    );
    return {
      categorias: r.meses,
      valores: [
        admissoes.valores,
        porMes(r, (m) => soma("vw_fato_rh_mes", m, (l) => l.desligamentos)),
        serieDaMetrica(r, "headcount_fte"),
      ],
      total: admissoes.total,
    };
  },

  "rh-turnover": (r) => ({
    categorias: r.meses,
    valores: [
      serieDaMetrica(r, "turnover_12m"),
      constante(r.meses.length, META_DE_TURNOVER),
    ],
    // Taxa não se soma: o total é o turnover da janela inteira, que é o mesmo
    // número que o cartão de `rh/visao` mostra ao lado.
    total: daMetrica("turnover_12m")(r),
  }),

  "rh-retencao": (r) => ({
    categorias: r.meses,
    valores: [
      porMes(r, (m) => {
        const entrou = soma("vw_fato_rh_mes", m, (l) => l.admissoes);
        const saiu = soma("vw_fato_rh_mes", m, (l) => l.desligamentos);
        return entrou === null || saiu === null ? null : entrou - saiu;
      }),
      serieDaMetrica(r, "retencao_12m"),
    ],
    total: daMetrica("retencao_12m")(r),
  }),

  "rh-folha": (r) => ({
    categorias: r.meses,
    valores: [
      serieDaMetrica(r, "folha_total"),
      serieDaMetrica(r, "custo_por_fte"),
    ],
    total: daMetrica("folha_total")(r),
  }),

  /* ---------------- rh/colab ---------------- */

  "col-tempo": (r) => {
    const faixas = valoresDaQuebra("tempo_de_casa");
    const quadro = faixas.map((faixa) => perfil(r, "tempo_de_casa", [faixa]));
    // Partição: as faixas cobrem o quadro inteiro, então somar é legítimo.
    return {
      categorias: faixas,
      valores: [quadro],
      total: somaDaSerie(quadro),
    };
  },

  /* ---------------- rh/turnover ---------------- */

  "tov-12m": (r) => ({
    categorias: r.meses,
    valores: [
      serieDaMetrica(r, "turnover_12m"),
      constante(r.meses.length, META_DE_TURNOVER),
    ],
    total: daMetrica("turnover_12m")(r),
  }),

  "tov-custo": (r) => {
    const componentes = [
      ...new Set(VW_FATO_TURNOVER_CUSTO.map((l) => l.componente)),
    ];
    const custo = quebrar(
      VW_FATO_TURNOVER_CUSTO,
      r,
      componentes,
      (l) => l.componente,
      (l) => l.valor,
    ).map(emMilhoes);
    return {
      categorias: componentes,
      valores: [custo],
      total: somaDaSerie(custo),
    };
  },

  /* ---------------- rh/recrut ---------------- */

  "rec-dias": (r) => ({
    categorias: r.meses,
    valores: [
      serieDaMetrica(r, "tempo_fechamento"),
      constante(r.meses.length, META_DE_DIAS_DE_FECHAMENTO),
    ],
    // Média de dias não se soma: 476 dias seria o tempo de fechar uma vaga.
    total: daMetrica("tempo_fechamento")(r),
  }),

  "rec-vagas": (r) => {
    const areas = areasDoRecorte(r);
    const porStatus = (medida: (l: (typeof VW_FATO_VAGAS)[number]) => number) =>
      quebrar(VW_FATO_VAGAS, r, areas, (l) => l.area, medida);
    const abertas = porStatus((l) => l.abertas);
    return {
      categorias: areas,
      valores: [
        abertas,
        porStatus((l) => l.emAndamento),
        porStatus((l) => l.fechadas),
      ],
      total: somaDaSerie(abertas),
    };
  },

  /* ---------------- rh/trein ---------------- */

  "tre-horas": (r) => ({
    categorias: r.meses,
    valores: [
      serieDaMetrica(r, "horas_treinamento"),
      serieDaMetrica(r, "participacao_treinamento"),
    ],
    total: daMetrica("horas_treinamento")(r),
  }),

  /* ---------------- rh/engaj ---------------- */

  "eng-enps": (r) => ({
    categorias: r.meses,
    valores: [
      serieDaMetrica(r, "enps"),
      constante(r.meses.length, ZONA_FAVORAVEL_DE_ENPS),
    ],
    total: daMetrica("enps")(r),
  }),

  "eng-eng": (r) => ({
    categorias: r.meses,
    valores: [serieDaMetrica(r, "engajamento_area")],
    total: daMetrica("engajamento_area")(r),
  }),

  "eng-abs": (r) => ({
    categorias: r.meses,
    valores: [serieDaMetrica(r, "absenteismo")],
    total: daMetrica("absenteismo")(r),
  }),

  /* ---------------- rh/sal ---------------- */

  "sal-faixas": (r) => {
    const faixas = valoresDaQuebra("faixa_salarial");
    const quadro = faixas.map((faixa) => perfil(r, "faixa_salarial", [faixa]));
    return {
      categorias: faixas,
      valores: [quadro],
      total: somaDaSerie(quadro),
    };
  },

  /* ---------------- fin/visao ---------------- */

  "fin-receita": (r) => ({
    categorias: r.meses,
    valores: [
      serieDaMetrica(r, "receita_liquida"),
      porMes(r, (m) =>
        emMilhoes(
          soma("vw_fato_fin_mes", m, (l) => l.receitaLiquidaAnoAnterior),
        ),
      ),
    ],
    total: daMetrica("receita_liquida")(r),
  }),

  "fin-margens": (r) => ({
    categorias: r.meses,
    valores: [
      serieDaMetrica(r, "margem_bruta"),
      porMes(r, margemEbitda),
      serieDaMetrica(r, "margem_liquida"),
    ],
    // Margem nao se soma: o total e a margem bruta da janela inteira.
    total: daMetrica("margem_bruta")(r),
  }),

  "fin-ebitda": (r) => ({
    categorias: r.meses,
    valores: [serieDaMetrica(r, "ebitda"), serieDaMetrica(r, "fco")],
    total: daMetrica("ebitda")(r),
  }),

  /* ---------------- fin/caixa ---------------- */

  "cx-diario": (r) => {
    const dias = diasUteisDoRecorte(r);
    const fluxo = dias.map((dia) => {
      const doDia = VW_FATO_CAIXA_DIARIO.filter(
        (l) => l.dia === dia && pertence(l, { ...r, meses: [l.mes] }),
      );
      return doDia.length === 0
        ? null
        : emMilhoes(doDia.reduce((a, l) => a + l.entradas - l.saidas, 0));
    });
    return { categorias: dias, valores: [fluxo], total: somaDaSerie(fluxo) };
  },

  "cx-saldo": (r) => ({
    categorias: r.meses,
    valores: [serieDaMetrica(r, "saldo_caixa")],
    /*
     * Estoque: o total e o saldo do fim da janela, e nao a soma dos doze
     * saldos -- que somaria a empresa doze vezes.
     */
    total: daMetrica("saldo_caixa")(r),
  }),

  "cx-fluxo": (r) => {
    const entradas = porMes(r, (m) =>
      emMilhoes(soma("vw_fato_fin_mes", m, (l) => l.entradasDeCaixa)),
    );
    const saidas = porMes(r, (m) =>
      emMilhoes(soma("vw_fato_fin_mes", m, (l) => l.saidasDeCaixa)),
    );
    return {
      categorias: r.meses,
      /*
       * O saldo acumulado é o saldo de caixa lido no fim de cada mês, e não a
       * soma corrente das duas barras. Parecem a mesma coisa e não são: o saldo
       * carrega o que existia antes da janela, e a soma das barras começaria do
       * zero — desenhando uma empresa que abriu em janeiro.
       */
      valores: [entradas, saidas, serieDaMetrica(r, "saldo_caixa")],
      total: somaDaSerie(entradas),
    };
  },

  /* ---------------- fin/orc ---------------- */

  "orc-vs": (r) => ({
    categorias: r.meses,
    valores: [serieDaMetrica(r, "orcado"), serieDaMetrica(r, "realizado")],
    total: daMetrica("orcado")(r),
  }),

  "orc-desvio": (r) => {
    const centros = CENTROS_DE_CUSTO.map((c) => c.codigo);
    const desvio = quebrar(
      VW_FATO_ORCAMENTO,
      r,
      centros,
      (l) => l.centroDeCusto,
      (l) => l.realizado - l.orcado,
    );
    const emMi = desvio.map(emMilhoes);
    return { categorias: centros, valores: [emMi], total: somaDaSerie(emMi) };
  },

  "orc-acum": (r) => ({
    categorias: r.meses,
    valores: [
      acumular(serieDaMetrica(r, "orcado")),
      acumular(serieDaMetrica(r, "realizado")),
    ],
    // Serie ja acumulada: somar de novo daria a soma das somas parciais.
    total: daMetrica("orcado")(r),
  }),

  /* ---------------- fin/contas ---------------- */

  "cr-aging": (r) => agingDe(r, (l) => l.aReceber),
  "cp-aging": (r) => agingDe(r, (l) => l.aPagar),

  /* ---------------- fin/fat ---------------- */

  "fat-evolucao": (r) => ({
    categorias: r.meses,
    valores: [
      serieDaMetrica(r, "receita_liquida"),
      porMes(r, (m) =>
        emMilhoes(
          soma("vw_fato_fin_mes", m, (l) => l.receitaLiquidaAnoAnterior),
        ),
      ),
    ],
    total: daMetrica("receita_liquida")(r),
  }),

  "fat-risco": (r) => {
    /*
     * Uma categoria por ano com dado, e uma série por faixa.
     *
     * O protótipo desenha 2026 e 2025 empilhados. A fixture tem um ano só, e
     * inventar o outro para preencher a tela seria fabricar histórico — o
     * segundo ano entra quando T-152 trouxer 2025. Uma categoria é o que se
     * sabe, e é o que se mostra.
     */
    const anos = [...new Set(r.meses.map((m) => m.slice(0, 4)))].sort();
    const doRecorte = VW_FATO_FATURAMENTO_CLIENTE.filter((l) => pertence(l, r));
    const porFaixa = FAIXAS_DE_RATING.map((faixa) =>
      anos.map((ano) => {
        const doAno = doRecorte.filter((l) => l.mes.startsWith(ano));
        const total = doAno.reduce((a, l) => a + l.receita, 0);
        const daFaixa = doAno
          .filter((l) => l.rating === faixa)
          .reduce((a, l) => a + l.receita, 0);
        return total === 0 ? null : (daFaixa / total) * CEM;
      }),
    );
    return {
      categorias: anos,
      valores: porFaixa,
      /*
       * As faixas repartem 100 % da carteira, e e isso que o total afirma.
       * Nulo quando nao ha carteira no recorte -- e nao 100, que diria "esta
       * tudo classificado" sobre um conjunto vazio.
       */
      total: doRecorte.length === 0 ? null : CEM,
    };
  },

  /* ---------------- int/cruz ---------------- */

  "int-rpc": (r) => ({
    categorias: r.meses,
    valores: [serieDaMetrica(r, "receita_por_fte")],
    total: daMetrica("receita_por_fte")(r),
  }),

  "int-ebitda-pc": (r) => ({
    categorias: r.meses,
    valores: [serieDaMetrica(r, "ebitda_por_fte")],
    total: daMetrica("ebitda_por_fte")(r),
  }),

  "int-hc-desp": (r) => ({
    categorias: r.meses,
    valores: [
      serieDaMetrica(r, "folha_total"),
      serieDaMetrica(r, "receita_liquida"),
      serieDaMetrica(r, "headcount_fte"),
    ],
    total: daMetrica("folha_total")(r),
  }),

  "int-pct": (r) => {
    const serie = serieDaMetrica(r, "folha_sobre_receita");
    const noPeriodo = daMetrica("folha_sobre_receita")(r);
    return {
      categorias: r.meses,
      valores: [serie, constante(r.meses.length, noPeriodo)],
      /*
       * A media do periodo e o traco E o total: sao o mesmo numero, e e assim
       * que o painel diz "a linha oscila em torno disto".
       */
      total: noPeriodo,
    };
  },
};

/* ------------------------------------------------------------------ *
 * Medidas que só o painel usa
 * ------------------------------------------------------------------ */

/*
 * Os três traços de referência que o protótipo desenha.
 *
 * São **metas**, e não medidas: números de negócio que alguém definiu, não
 * somas de linha. Por isso ficam nomeados aqui e não vêm de view nenhuma — a
 * regra de T-141 libera exatamente este caso pela lista branca de nomes.
 *
 * Quando o catálogo passar a carregar meta por métrica (seção 9.4), eles saem
 * daqui e vêm de lá. Enquanto não carrega, ficar escrito com nome é melhor do
 * que ficar escrito sem.
 */

/** A meta anual de turnover, em %. Traço de `rh-turnover` e `tov-12m`. */
const META_DE_TURNOVER = 14;

/** A meta de dias até o aceite. Traço de `rec-dias`. */
const META_DE_DIAS_DE_FECHAMENTO = 40;

/** O limiar da zona favorável de eNPS. Traço de `eng-enps`. */
const ZONA_FAVORAVEL_DE_ENPS = 30;

/**
 * Margem EBITDA: não é métrica do catálogo, e o painel precisa dela.
 *
 * `margem_bruta` e `margem_liquida` existem porque viraram cartão; a de EBITDA
 * só aparece como linha. Fica aqui em vez de virar entrada de catálogo porque
 * entrada de catálogo carrega decisão registrada e versionada — e esta é
 * derivada de dois números que já a têm.
 */
function margemEbitda(r: Recorte): number | null {
  const ebitda = daMetrica("ebitda")(r);
  const receita = daMetrica("receita_liquida")(r);
  return emPorcento(razao(ebitda, receita));
}

/** Os valores de uma quebra do quadro, na ordem declarada. */
function valoresDaQuebra(dimensao: NomeDeQuebra): readonly string[] {
  return QUEBRAS_DO_QUADRO[dimensao].map((v) => v.codigo);
}

/**
 * As áreas que o painel enumera.
 *
 * Sob recorte de uma área só, o painel devolve **uma** categoria — que é o que
 * "quebrado por área sob recorte de uma área" tem de significar. Devolver as
 * sete com seis zeradas mostraria a empresa inteira a quem pediu um pedaço.
 */
function areasDoRecorte(r: Recorte): readonly string[] {
  if (r.q.area !== AGREGADO_DE_AREA) return [r.q.area];
  return [...new Set(VW_FATO_RH_MES.map((l) => l.area))];
}

/**
 * Os últimos dias úteis da janela — no máximo trinta.
 *
 * O título do painel diz "últimos 30 dias", e trinta é quanto ele desenha.
 * Devolver os 261 dias úteis de um ano inteiro faria barras de menos de um
 * pixel e trocaria a leitura do painel: ele existe para mostrar o ritmo de
 * pagamento dentro de um mês, não a série do ano — essa é `cx-fluxo`.
 *
 * O corte é pelo **fim** da janela, então o painel acompanha o recorte: quem
 * escolher um período que termina antes vê os trinta dias que antecedem esse
 * fim. Nas quatro janelas da tabela 6.2 o desenho é o mesmo, e a razão é que as
 * quatro terminam em dezembro — invariância declarada, não coincidência.
 *
 * Janela mais curta que trinta dias úteis devolve o que existe. Completar com
 * dias de antes do recorte mostraria, dentro de um filtro, dado que o filtro
 * excluiu.
 */
const DIAS_UTEIS_DO_PAINEL = 30;

function diasUteisDoRecorte(r: Recorte): readonly string[] {
  const todos = r.meses.flatMap((mes) => diasUteisDoMes(mes));
  return todos.slice(-DIAS_UTEIS_DO_PAINEL);
}

/** Aging por faixa, no fechamento do último mês da janela. */
function agingDe(
  r: Recorte,
  medida: (l: (typeof VW_FATO_CONTAS)[number]) => number,
): Desenho {
  const faixas = FAIXAS_DE_AGING.map((f) => f.codigo);
  const ultimo = ultimoMes(r);
  const doFim = { ...r, meses: ultimo === undefined ? [] : [ultimo] };
  const saldo = quebrar(
    VW_FATO_CONTAS,
    doFim,
    faixas,
    (l) => l.faixaDeAging,
    medida,
  ).map(emMilhoes);
  return { categorias: faixas, valores: [saldo], total: somaDaSerie(saldo) };
}

/* ------------------------------------------------------------------ *
 * O envelope
 * ------------------------------------------------------------------ */

/** As três formas que T-117 cobre, como tipo. */
export type PainelCartesiano =
  PainelBarras | PainelLinha | PainelBarrasEmpilhadas;

/** As cinco formas que T-118 cobre. */
export type PainelCategorico =
  | PainelBarrasHorizontais
  | PainelRosca
  | PainelFunil
  | PainelDivisao
  | PainelEstatisticas;

/** O que `getPanel` sabe devolver hoje: T-117 mais T-118. */
export type PainelDesenhado = PainelCartesiano | PainelCategorico;

/**
 * O painel pedido, no recorte pedido.
 *
 * O tipo de retorno é a união das **três** formas, e não `PanelResponse`
 * inteiro. A primeira versão montava o objeto e fechava com `as PanelResponse`,
 * e o `as` fazia exatamente o que um `as` faz: calava o compilador sobre a
 * única coisa que ele tinha a dizer. `PanelResponse` é união de doze variantes
 * e `series` não existe em nove delas — quem chamasse esta função e lesse
 * `.series` descobriria isso em produção, não aqui.
 */
export function calcularPainel(id: string, q: Query): PainelDesenhado {
  const registro = painelPorId(id);
  if (registro === undefined) throw new PainelDesconhecido(id);

  const origem = origemDoPainel(id);
  const forma = registro.forma;
  if (origem === undefined) throw new PainelSemDesenho(id, forma);

  const categorico = DESENHO_CATEGORICO[id];
  if (categorico !== undefined) {
    return montarCategorico(id, registro, origem, recorteDe(q), categorico);
  }

  const desenhar = DESENHO[id];
  if (
    desenhar === undefined ||
    (forma !== "barras" && forma !== "linha" && forma !== "barras-empilhadas")
  ) {
    throw new PainelSemDesenho(id, forma);
  }

  const r = recorteDe(q);
  const desenho = desenhar(r);

  const series: Serie[] = origem.series.map((declarada, i) => ({
    name: declarada.nome,
    values: desenho.valores[i] ?? [],
    papel: declarada.papel,
  }));

  const comum = {
    id: registro.id,
    title: registro.titulo,
    unit: registro.unidade ?? origem.series[0]?.unidade ?? "contagem",
    formula: origem.formula,
    total: desenho.total,
    // A nota é de T-133: escrevê-la aqui deixaria um absoluto do consolidado
    // aparecer sob qualquer recorte.
    note: null,
    asOf: fechamentoDoRecorte(r),
    categories: desenho.categorias,
    series,
  };

  // Três retornos e não um: é assim que o compilador confere cada variante da
  // união contra o objeto montado, em vez de aceitar a palavra de um `as`.
  if (forma === "barras") return { ...comum, forma };
  if (forma === "linha") return { ...comum, forma };
  return { ...comum, forma };
}

/** A data de fechamento que originou os números (seção 10.2). */
function fechamentoDoRecorte(r: Recorte): string {
  const ultimo = ultimoMes(r);
  if (ultimo === undefined) return "";
  const [ano, mes] = ultimo.split("-");
  const dia = new Date(Date.UTC(Number(ano), Number(mes), 0)).getUTCDate();
  return `${ultimo}-${String(dia)}`;
}

/**
 * O envelope das cinco formas categóricas.
 *
 * Cada forma carrega uma coisa diferente — fatias e centro, passos, grupos de
 * partes, números soltos — e por isso o `switch` é por forma e não por
 * conveniência. O compilador confere cada ramo contra a variante certa da
 * união, que é o que impede um envelope de `rosca` sair sem centro.
 */
function montarCategorico(
  id: string,
  registro: { readonly titulo: string; readonly unidade: Unidade | null },
  origem: OrigemDePainel,
  r: Recorte,
  desenhar: (recorte: Recorte) => DesenhoCategorico,
): PainelCategorico {
  const desenho = desenhar(r);
  const comum = {
    id,
    title: registro.titulo,
    unit: registro.unidade ?? origem.series[0]?.unidade ?? "contagem",
    formula: origem.formula,
    total: desenho.total,
    // A nota é de T-133, pela mesma razão das formas cartesianas.
    note: null,
    asOf: fechamentoDoRecorte(r),
  };

  if (desenho.forma === "barras-horizontais") {
    const series: Serie[] = origem.series.map((declarada, i) => ({
      name: declarada.nome,
      values: desenho.valores[i] ?? [],
      papel: declarada.papel,
    }));
    return {
      ...comum,
      forma: "barras-horizontais",
      categories: desenho.categorias,
      series,
    };
  }

  if (desenho.forma === "rosca") {
    return {
      ...comum,
      forma: "rosca",
      fatias: desenho.fatias,
      centro: desenho.centro,
    };
  }

  if (desenho.forma === "funil") {
    return { ...comum, forma: "funil", passos: desenho.passos };
  }

  if (desenho.forma === "divisao") {
    return { ...comum, forma: "divisao", grupos: desenho.grupos };
  }

  /*
   * Estatísticas: cada número traz a **própria** fórmula, que vem da
   * declaração e não do painel. PR-3 vale por número, e "vagas movimentadas" e
   * "taxa de conversão" não compartilham como foram obtidas.
   */
  return {
    ...comum,
    forma: "estatisticas",
    estatisticas: desenho.estatisticas.map((calculada, i) => {
      const declarada = origem.series[i];
      return {
        rotulo: declarada?.nome ?? "",
        valor: calculada.valor,
        unidade: declarada?.unidade ?? "contagem",
        formula: declarada?.formulaPropria ?? origem.formula,
        sentido: calculada.sentido,
        rodape: calculada.rodape,
      };
    }),
  };
}

/** Os painéis que já sabem se desenhar. Serve à conferência de cobertura. */
export function paineisComDesenho(): readonly string[] {
  return [...Object.keys(DESENHO), ...paineisCategoricosComDesenho()];
}
