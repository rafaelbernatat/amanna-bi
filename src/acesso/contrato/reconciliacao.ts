/**
 * Como cada KPI reconcilia com o painel que o detalha (T-122, regra 1).
 *
 * A regra 1 da seção 9.2 diz: *"para a mesma `Query`, o KPI e o painel que o
 * detalha somam o mesmo total"*. Escrita assim ela parece uma comparação só, e
 * não é — os 60 pares mapeados reconciliam de **onze formas diferentes**.
 *
 * `rh-visao-headcount` é o último ponto de uma série; `fin-contas-pmr` é a
 * largura de uma faixa da régua; `rh-colab-superior-ou-mais` é a participação de
 * três categorias no total de um gráfico de barras. Uma suíte que comparasse
 * "valor do KPI" com "total do painel" em todos reprovaria quarenta pares
 * corretos e não pegaria nenhum defeito.
 *
 * ## Por que a forma é declarada, e não descoberta
 *
 * Escrevi um classificador que testava todos os alvos possíveis de cada painel
 * e ficava com o primeiro que batesse dentro da tolerância. Ele acertou a
 * maioria e **errou o suficiente para não servir**:
 *
 *   - casou `fin-visao-lucro-liquido` com o degrau "Não operacional", porque os
 *     dois valem −8 no recorte consolidado;
 *   - casou `rh-recrut-tempo-de-fechamento` com o traço da meta, porque 39,7
 *     está a menos de meio dia de 40;
 *   - casou `rh-visao-turnover-12m` com a **soma** de doze taxas mensais, que
 *     por construção se aproxima da taxa de doze meses — e que a regra 4 do
 *     próprio contrato proíbe somar.
 *
 * Os três passariam hoje e falhariam num recorte qualquer, ou pior: passariam
 * sempre, verificando a coisa errada. Por isso cada par está escrito aqui, e a
 * medição serviu de evidência e não de decisão.
 *
 * ## Treze pares não reconciliam, e isso está declarado
 *
 * Não é omissão: em treze casos o envelope do painel **não carrega** o número
 * do cartão. Cada um traz o motivo, e os motivos se agrupam em três famílias
 * que valem mais que a lista — estão no comentário de `NAO_RECONCILIA`.
 */

import type { PanelResponse, Unidade } from "@/semantica/contrato";
import { podeSomar } from "@/semantica/agregacao";

/* ------------------------------------------------------------------ *
 * As formas de reconciliar
 * ------------------------------------------------------------------ */

export type FormaDeReconciliacao =
  /** O número de manchete do painel — a medida sobre a janela. */
  | { readonly tipo: "total_do_painel" }
  /** O último ponto conhecido de uma série. Medida de estoque. */
  | { readonly tipo: "ultimo_da_serie"; readonly serie: string }
  /** A soma de uma série. Só para unidade somável (regra 4). */
  | { readonly tipo: "soma_da_serie"; readonly serie: string }
  /** Um degrau da cascata, com o sinal que ele tem no envelope. */
  | { readonly tipo: "passo"; readonly passo: string }
  /** Um degrau da cascata em módulo: o cartão diz "investimento: 140". */
  | { readonly tipo: "passo_em_modulo"; readonly passo: string }
  /** A largura de uma faixa da régua de ciclo. */
  | { readonly tipo: "largura_da_faixa"; readonly faixa: string }
  /** O número do centro da rosca. */
  | { readonly tipo: "centro_da_rosca" }
  /** Uma parte de um grupo de divisão. */
  | {
      readonly tipo: "parte_do_grupo";
      readonly grupo: string;
      readonly parte: string;
    }
  /** A soma de algumas categorias de um gráfico de barras. */
  | {
      readonly tipo: "soma_de_categorias";
      readonly categorias: readonly string[];
    }
  /** A soma das partes escolhidas de um grupo de divisão. */
  | {
      readonly tipo: "soma_de_partes";
      readonly grupo: string;
      readonly partes: readonly string[];
    }
  /** Quanto algumas categorias representam do total do painel. */
  | {
      readonly tipo: "participacao_de_categorias";
      readonly categorias: readonly string[];
    }
  /** A soma das categorias negativas, em módulo — economia orçamentária. */
  | { readonly tipo: "soma_de_categorias_negativas" }
  /** O menor ou o maior valor entre as categorias. */
  | {
      readonly tipo: "extremo_das_categorias";
      readonly extremo: "menor" | "maior";
    }
  /** Quantas células do mosaico têm dado. */
  | { readonly tipo: "contagem_de_celulas_com_dado" }
  /** Cem menos o total — retenção sobre um painel de turnover. */
  | { readonly tipo: "complemento_do_total" }
  /** A razão entre duas séries, em porcentagem: crescimento ano contra ano. */
  | {
      readonly tipo: "razao_entre_series";
      readonly numerador: string;
      readonly denominador: string;
    }
  /** O envelope não carrega o número do cartão. O motivo é obrigatório. */
  | { readonly tipo: "nao_reconcilia"; readonly porque: string };

export type ParDeReconciliacao = {
  readonly kpi: string;
  readonly painel: string;
  readonly forma: FormaDeReconciliacao;
};

/* ------------------------------------------------------------------ *
 * Os treze que não reconciliam
 * ------------------------------------------------------------------ */

/**
 * Os motivos, agrupados — e as famílias importam mais que a lista.
 *
 * **1. O painel de participação perde a base.** Cinco cartões contam coisas
 * (145 desligamentos, 48 vagas abertas) e o painel que os detalha é uma rosca
 * em porcentagem. A rosca mostra a repartição, o cartão mostra a base, e o
 * envelope de rosca não tem onde guardar a base — `total` já é 100, que é a
 * unidade do painel. O protótipo escreve a base no subtítulo ("145 saídas no
 * período"), então a informação existe no produto e não no contrato. **Vale uma
 * tarefa própria**, e está anotado no commit desta.
 *
 * **2. Razão que o painel mostra como série secundária.** Três cartões são
 * razões cuja janela **não é agregável a partir dos pontos** — somar doze
 * "custo por FTE" não dá o custo por FTE do ano, e a regra 4 proíbe tentar. O
 * painel carrega a série mês a mês e um `total` só, que é o da medida
 * principal. Reconciliar exigiria um segundo total no envelope.
 *
 * **3. O painel mede outra coisa.** Cinco pares onde `detalhadoPor` é um
 * ponteiro de navegação — "é ali que você olha isto" — e não uma promessa de
 * que o número aparece. `rh-trein-investimento` aponta para um painel de horas
 * por área; `rh-sal-encargos` aponta para a composição da folha, onde o mesmo
 * encargo aparece sobre outro denominador. Nenhum é defeito: são leituras
 * diferentes que moram na mesma tela.
 */
const NAO_RECONCILIA: readonly ParDeReconciliacao[] = [
  /* Família 1 — a rosca perde a base */
  {
    kpi: "rh-turnover-desligamentos",
    painel: "tov-tipos",
    forma: {
      tipo: "nao_reconcilia",
      porque:
        "o cartão conta 145 desligamentos e a rosca reparte 100% entre os " +
        "tipos; o envelope de rosca não tem onde guardar a base absoluta",
    },
  },
  {
    kpi: "rh-recrut-vagas-abertas",
    painel: "rec-status",
    forma: {
      tipo: "nao_reconcilia",
      porque: "mesma família: contagem no cartão, participação na rosca",
    },
  },
  {
    kpi: "rh-recrut-em-andamento",
    painel: "rec-status",
    forma: {
      tipo: "nao_reconcilia",
      porque: "mesma família: contagem no cartão, participação na rosca",
    },
  },
  {
    kpi: "rh-recrut-fechadas-12m",
    painel: "rec-status",
    forma: {
      tipo: "nao_reconcilia",
      porque: "mesma família: contagem no cartão, participação na rosca",
    },
  },
  {
    kpi: "rh-recrut-canceladas",
    painel: "rec-status",
    forma: {
      tipo: "nao_reconcilia",
      porque: "mesma família: contagem no cartão, participação na rosca",
    },
  },

  /* Família 2 — razão em série secundária */
  {
    kpi: "rh-visao-custo-por-fte",
    painel: "rh-folha",
    forma: {
      tipo: "nao_reconcilia",
      porque:
        "o painel mostra o custo por FTE como série mensal e declara como " +
        "total a folha; somar os doze pontos não dá o custo por FTE do ano, e " +
        "a regra 4 proíbe somar razão",
    },
  },
  {
    kpi: "rh-trein-horas-por-fte",
    painel: "tre-horas",
    forma: {
      tipo: "nao_reconcilia",
      porque:
        "horas por FTE precisa do quadro como denominador, e o painel de " +
        "treinamento não o carrega — a razão não sai do envelope",
    },
  },
  {
    kpi: "fin-visao-margem-liquida",
    painel: "fin-margens",
    forma: {
      tipo: "nao_reconcilia",
      porque:
        "o painel traz as três margens como séries mensais e um total só, que " +
        "é o da margem bruta; a margem líquida da janela não é a soma nem o " +
        "último ponto da série dela",
    },
  },

  /* Família 3 — o painel mede outra coisa */
  {
    kpi: "rh-colab-idade-media",
    painel: "col-idade",
    forma: {
      tipo: "nao_reconcilia",
      porque:
        "a média vem da soma de idades, exata; o painel reparte o quadro em " +
        "faixas, e a média das faixas seria outra aproximação — as duas estão " +
        "certas e não são o mesmo número",
    },
  },
  {
    kpi: "rh-colab-tempo-medio-de-casa",
    painel: "col-tempo",
    forma: {
      tipo: "nao_reconcilia",
      porque: "mesma família de idade média: exata contra faixas",
    },
  },
  {
    kpi: "rh-trein-investimento",
    painel: "tre-area",
    forma: {
      tipo: "nao_reconcilia",
      porque:
        "o cartão mede reais e o painel mede horas por área; o ponteiro é de " +
        "navegação, não promessa de que o número aparece",
    },
  },
  {
    kpi: "rh-sal-encargos",
    painel: "sal-comp",
    forma: {
      tipo: "nao_reconcilia",
      porque:
        "o cartão é encargos sobre salários (37,5%) e a fatia é encargos " +
        "sobre a folha inteira (22,6%) — denominadores diferentes, ambos certos",
    },
  },
  {
    kpi: "rh-sal-variavel",
    painel: "sal-comp",
    forma: {
      tipo: "nao_reconcilia",
      porque: "o cartão é em reais e a rosca é em participação",
    },
  },
];

/* ------------------------------------------------------------------ *
 * Os 47 que reconciliam
 * ------------------------------------------------------------------ */

const t = (kpi: string, painel: string): ParDeReconciliacao => ({
  kpi,
  painel,
  forma: { tipo: "total_do_painel" },
});

const RECONCILIA: readonly ParDeReconciliacao[] = [
  /* O número de manchete do painel — o caso mais comum, e o mais direto. */
  t("rh-visao-turnover-12m", "rh-turnover"),
  t("rh-visao-retencao-12m", "rh-retencao"),
  t("rh-visao-folha-total", "rh-folha"),
  t("rh-colab-colaboradores", "col-area"),
  t("rh-turnover-turnover-12m", "tov-12m"),
  t("rh-turnover-custo-do-turnover", "tov-custo"),
  t("rh-recrut-tempo-de-fechamento", "rec-tempo"),
  t("rh-trein-horas-de-treinamento", "tre-horas"),
  t("rh-engaj-enps", "eng-enps"),
  t("rh-engaj-engajamento", "eng-eng"),
  t("rh-engaj-absenteismo", "eng-abs"),
  t("rh-sal-folha-total", "sal-folha"),
  t("rh-sal-salario-medio", "sal-medio"),
  t("fin-visao-receita-liquida", "fin-receita"),
  t("fin-visao-ebitda", "fin-ebitda"),
  t("fin-visao-margem-bruta", "fin-margens"),
  t("fin-visao-lucro-liquido", "fin-dre"),
  t("fin-caixa-saldo-de-caixa", "cx-saldo"),
  t("fin-orc-orcado", "orc-vs"),
  t("fin-orc-desvio", "orc-desvio"),
  t("fin-contas-ciclo-de-conversao", "ct-ciclo"),
  t("fin-fat-faturamento", "fat-evolucao"),
  t("int-cruz-receita-por-colaborador", "int-rpc"),
  t("int-cruz-ebitda-per-capita", "int-ebitda-pc"),
  t("int-cruz-despesa-de-pessoal", "int-pct"),

  /* Estoque: o último ponto conhecido, nunca a soma. */
  {
    kpi: "rh-visao-headcount",
    painel: "rh-headcount",
    forma: { tipo: "ultimo_da_serie", serie: "Headcount (FTE)" },
  },
  {
    kpi: "int-cruz-headcount",
    painel: "int-hc-desp",
    forma: { tipo: "ultimo_da_serie", serie: "Headcount (FTE)" },
  },
  {
    kpi: "rh-trein-participacao",
    painel: "tre-horas",
    forma: { tipo: "ultimo_da_serie", serie: "Participação" },
  },

  /* Soma de série, só onde a unidade se soma. */
  {
    kpi: "fin-orc-realizado",
    painel: "orc-vs",
    forma: { tipo: "soma_da_serie", serie: "Realizado" },
  },
  {
    kpi: "rh-sal-beneficios",
    painel: "sal-benef",
    forma: { tipo: "soma_de_categorias", categorias: ["Benefícios"] },
  },

  /* A cascata do caixa: cada cartão é um degrau. */
  {
    kpi: "fin-caixa-geracao-operacional",
    painel: "cx-ponte",
    forma: { tipo: "passo", passo: "Operacional (FCO)" },
  },
  {
    kpi: "fin-caixa-investimento-fci",
    painel: "cx-ponte",
    forma: { tipo: "passo_em_modulo", passo: "Investimento (FCI)" },
  },
  {
    kpi: "fin-caixa-financiamento-fcf",
    painel: "cx-ponte",
    forma: { tipo: "passo_em_modulo", passo: "Financiamento (FCF)" },
  },

  /* A régua: cada prazo é a largura de uma faixa. */
  {
    kpi: "fin-contas-pmr",
    painel: "ct-ciclo",
    forma: { tipo: "largura_da_faixa", faixa: "Recebimento (PMR)" },
  },
  {
    kpi: "fin-contas-pme",
    painel: "ct-ciclo",
    forma: { tipo: "largura_da_faixa", faixa: "Estoque (PME)" },
  },
  {
    kpi: "fin-contas-pmp",
    painel: "ct-ciclo",
    forma: { tipo: "largura_da_faixa", faixa: "Prazo do fornecedor (PMP)" },
  },

  /* Rosca e divisão. */
  {
    kpi: "rh-trein-conclusao-media",
    painel: "tre-conclusao",
    forma: { tipo: "centro_da_rosca" },
  },
  {
    kpi: "rh-engaj-promotores",
    painel: "eng-cat",
    forma: {
      tipo: "parte_do_grupo",
      grupo: "Categorias do eNPS",
      parte: "Promotores",
    },
  },
  {
    kpi: "rh-colab-trabalho-flexivel",
    painel: "col-perfil",
    forma: {
      tipo: "soma_de_partes",
      grupo: "Modalidade",
      partes: ["hibrido", "remoto"],
    },
  },

  /* Participação de um subconjunto de categorias. */
  {
    kpi: "rh-colab-superior-ou-mais",
    painel: "col-escol",
    forma: {
      tipo: "participacao_de_categorias",
      categorias: ["superior", "pos-graduacao", "mestrado-mais"],
    },
  },
  {
    kpi: "fin-contas-inadimplencia",
    painel: "cr-aging",
    forma: { tipo: "participacao_de_categorias", categorias: ["mais-90d"] },
  },

  /* Soma de categorias escolhidas. */
  {
    kpi: "rh-turnover-custo-de-reposicao",
    painel: "tov-custo",
    forma: {
      tipo: "soma_de_categorias",
      categorias: ["ramp-up", "produtividade"],
    },
  },
  {
    kpi: "fin-orc-economia-obtida",
    painel: "orc-desvio",
    forma: { tipo: "soma_de_categorias_negativas" },
  },

  /* Os que leem a forma do painel, e não um valor dele. */
  {
    kpi: "rh-colab-estados-atendidos",
    painel: "col-mapa",
    forma: { tipo: "contagem_de_celulas_com_dado" },
  },
  {
    kpi: "rh-engaj-area-mais-critica",
    painel: "eng-area",
    forma: { tipo: "extremo_das_categorias", extremo: "menor" },
  },
  {
    kpi: "rh-turnover-retencao-12m",
    painel: "tov-12m",
    forma: { tipo: "complemento_do_total" },
  },
  {
    kpi: "fin-fat-crescimento-yoy",
    painel: "fat-evolucao",
    forma: {
      tipo: "razao_entre_series",
      numerador: "Ano atual",
      denominador: "Ano anterior",
    },
  },
];

/** Os 60 pares mapeados, reconciliáveis ou não. */
export const RECONCILIACAO: readonly ParDeReconciliacao[] = [
  ...RECONCILIA,
  ...NAO_RECONCILIA,
];

const POR_KPI: ReadonlyMap<string, ParDeReconciliacao> = new Map(
  RECONCILIACAO.map((p) => [p.kpi, p]),
);

export function reconciliacaoDe(kpi: string): ParDeReconciliacao | undefined {
  return POR_KPI.get(kpi);
}

/* ------------------------------------------------------------------ *
 * A leitura do envelope
 * ------------------------------------------------------------------ */

const CEM = 100;

function somaConhecidos(valores: readonly (number | null)[]): number | null {
  const conhecidos = valores.filter((v): v is number => v !== null);
  return conhecidos.length === 0 ? null : conhecidos.reduce((a, b) => a + b, 0);
}

function ultimoConhecido(valores: readonly (number | null)[]): number | null {
  for (let i = valores.length - 1; i >= 0; i -= 1) {
    const v = valores[i];
    if (v !== undefined && v !== null) return v;
  }
  return null;
}

/** A série pedida, ou `null` quando o painel não a tem. */
function serie(
  envelope: PanelResponse,
  nome: string,
): readonly (number | null)[] | null {
  if (!("series" in envelope)) return null;
  return envelope.series.find((s) => s.name === nome)?.values ?? null;
}

/** Os valores das categorias pedidas de um painel cartesiano. */
function categorias(
  envelope: PanelResponse,
  quais: readonly string[],
): readonly (number | null)[] | null {
  if (!("categories" in envelope) || !("series" in envelope)) return null;
  const valores = envelope.series[0]?.values ?? [];
  return quais.map((c) => {
    const i = envelope.categories.indexOf(c);
    return i === -1 ? null : (valores[i] ?? null);
  });
}

/**
 * O número que o painel oferece para a reconciliação.
 *
 * `undefined` quer dizer "o envelope não tem esta forma" — que é diferente de
 * `null`, que é "tem, e está vazia no recorte". A diferença chega ao relatório:
 * a primeira é declaração errada, a segunda é recorte sem dado.
 *
 * ## A distinção custou 3.456 falsos vermelhos
 *
 * A primeira versão devolvia `undefined` sempre que não achava o alvo — e um
 * painel vazio não tem alvo nenhum. Sob os 384 recortes do ano sem dado, a
 * régua devolve zero faixas, a cascata zero degraus e a divisão zero partes;
 * a suíte lia isso como "declaração errada" e acusava nove pares corretos.
 *
 * A regra que separa os dois casos: **carga vazia é ausência de dado; carga
 * cheia sem o alvo declarado é declaração errada**. Um `faixas: []` não é uma
 * régua com o nome trocado, é uma régua sem nada para medir.
 */
export function valorDoPainel(
  envelope: PanelResponse,
  forma: FormaDeReconciliacao,
  unidade: Unidade,
): number | null | undefined {
  switch (forma.tipo) {
    case "total_do_painel":
      return envelope.total;

    case "ultimo_da_serie": {
      const s = serie(envelope, forma.serie);
      return s === null ? undefined : ultimoConhecido(s);
    }

    case "soma_da_serie": {
      /*
       * Somar taxa é o que a regra 4 proíbe, e uma suíte que o fizesse
       * contradiria o próprio contrato que ela defende. Declarar `soma_da_serie`
       * numa unidade não somável é erro de quem declarou, e vira `undefined`
       * para o relatório apontar a declaração, não o dado.
       */
      if (!podeSomar(unidade)) return undefined;
      const s = serie(envelope, forma.serie);
      return s === null ? undefined : somaConhecidos(s);
    }

    case "passo":
    case "passo_em_modulo": {
      /*
       * `passos` existe na cascata e no funil, e os dois tipam o valor
       * diferente: na cascata é `number`, no funil é `number | null`. O
       * estreitamento por `in` devolve a união, então o nulo precisa ser tratado
       * — e ele é ausência de dado, não zero.
       */
      if (!("passos" in envelope)) return undefined;
      if (envelope.passos.length === 0) return null;
      const p = envelope.passos.find((x) => x.nome === forma.passo);
      if (p === undefined) return undefined;
      if (p.valor === null) return null;
      return forma.tipo === "passo" ? p.valor : Math.abs(p.valor);
    }

    case "largura_da_faixa": {
      if (!("faixas" in envelope)) return undefined;
      if (envelope.faixas.length === 0) return null;
      const f = envelope.faixas.find((x) => x.rotulo === forma.faixa);
      return f === undefined ? undefined : f.ate - f.de;
    }

    case "centro_da_rosca":
      return "centro" in envelope ? envelope.centro.valor : undefined;

    case "parte_do_grupo": {
      if (!("grupos" in envelope)) return undefined;
      const g = envelope.grupos.find((x) => x.nome === forma.grupo);
      if (g === undefined) return undefined;
      if (g.partes.length === 0) return null;
      const p = g.partes.find((x) => x.nome === forma.parte);
      return p === undefined ? undefined : p.valor;
    }

    case "soma_de_partes": {
      if (!("grupos" in envelope)) return undefined;
      const g = envelope.grupos.find((x) => x.nome === forma.grupo);
      if (g === undefined) return undefined;
      if (g.partes.length === 0) return null;
      const escolhidas = g.partes.filter((p) => forma.partes.includes(p.nome));
      if (escolhidas.length !== forma.partes.length) return undefined;
      return escolhidas.reduce((a, p) => a + p.valor, 0);
    }

    case "soma_de_categorias": {
      const valores = categorias(envelope, forma.categorias);
      return valores === null ? undefined : somaConhecidos(valores);
    }

    case "participacao_de_categorias": {
      if (!("series" in envelope)) return undefined;
      const todas = envelope.series[0]?.values ?? [];
      const total = somaConhecidos(todas);
      const parte = somaConhecidos(
        categorias(envelope, forma.categorias) ?? [],
      );
      if (total === null || total === 0 || parte === null) return null;
      return (parte / total) * CEM;
    }

    case "soma_de_categorias_negativas": {
      if (!("series" in envelope)) return undefined;
      const todas = envelope.series[0]?.values ?? [];
      const negativas = todas.filter((v): v is number => v !== null && v < 0);
      return negativas.length === 0
        ? null
        : Math.abs(negativas.reduce((a, b) => a + b, 0));
    }

    case "extremo_das_categorias": {
      if (!("series" in envelope)) return undefined;
      const conhecidos = (envelope.series[0]?.values ?? []).filter(
        (v): v is number => v !== null,
      );
      if (conhecidos.length === 0) return null;
      return forma.extremo === "menor"
        ? Math.min(...conhecidos)
        : Math.max(...conhecidos);
    }

    case "contagem_de_celulas_com_dado": {
      /*
       * Sem nenhuma célula com dado, "quantos estados" não é zero: é
       * desconhecido. Zero afirmaria que a empresa não opera em lugar nenhum.
       */
      if (!("celulas" in envelope)) return undefined;
      const comDado = envelope.celulas.filter(
        (c) => c.valor !== null && c.valor > 0,
      );
      const algumConhecido = envelope.celulas.some((c) => c.valor !== null);
      return algumConhecido ? comDado.length : null;
    }

    case "complemento_do_total":
      return envelope.total === null ? null : CEM - envelope.total;

    case "razao_entre_series": {
      const num = serie(envelope, forma.numerador);
      const den = serie(envelope, forma.denominador);
      if (num === null || den === null) return undefined;
      const a = somaConhecidos(num);
      const b = somaConhecidos(den);
      if (a === null || b === null || b === 0) return null;
      return (a / b - 1) * CEM;
    }

    case "nao_reconcilia":
      return undefined;
  }
}
