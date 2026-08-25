/**
 * O desenho das cinco formas categóricas — os 34 painéis de T-118.
 *
 * Arquivo próprio porque as formas são de outra natureza. Em `paineis.ts` toda
 * carga é categorias × séries; aqui cada forma tem carga própria — a rosca tem
 * fatias e um centro, o funil tem passos, a divisão tem grupos de partes, e o
 * painel de estatísticas tem números soltos, cada um com unidade e fórmula
 * suas. Espremer as cinco no molde cartesiano daria um envelope que mente sobre
 * o que carrega.
 *
 * ## A regra que atravessa as cinco
 *
 * **Participação se calcula sobre o recorte, nunca sobre um total fixo.** No
 * protótipo a conta é `pct(g.v, 1240)` — o quadro inteiro cravado no
 * denominador —, e por isso filtrar por área lá deixa as fatias somando muito
 * menos que 100 %. Aqui o denominador é a soma do que está na tela, e a rosca
 * fecha em qualquer recorte.
 */

import {
  CLIENTES_A_RECEBER,
  FORNECEDORES_A_PAGAR,
  NATUREZAS_DE_SAIDA,
  rotuloDe,
} from "@/acesso/fixtures/contraparte";
import { VW_FATO_RH_DESLIGAMENTO } from "@/acesso/fixtures/desligamento";
import { VW_DIM_CARGO } from "@/acesso/fixtures/dim";
import { AGREGADO_DE_AREA } from "@/acesso/fixtures/eixos";
import {
  VW_FATO_CONTAS,
  VW_FATO_FATURAMENTO_CLIENTE,
  VW_FATO_ORCAMENTO,
  VW_FATO_SAIDA_CATEGORIA,
} from "@/acesso/fixtures/fin";
import {
  calculoDaMetrica,
  emMilhoes,
  emPorcento,
  linhas,
  perfil,
  pertence,
  razao,
  type Recorte,
  soma,
} from "@/acesso/fixtures/kpis";
import { CENTROS_DE_CUSTO } from "@/acesso/fixtures/referencia-fin";
import {
  QUEBRAS_DO_QUADRO,
  SEGMENTOS_DE_CLIENTE,
} from "@/acesso/fixtures/referencia-perfil";
import { VW_FATO_VAGAS } from "@/acesso/fixtures/rh";
import { VW_FATO_TURNOVER_CUSTO } from "@/acesso/fixtures/turnover-custo";
import type { Parte, Query, Sentido } from "@/semantica/contrato";

const CEM = 100;
const MESES_DO_ANO = 12;

/** Uma estatística pronta, menos a fórmula — que vem da declaração. */
export type EstatisticaCalculada = {
  readonly valor: number | null;
  readonly sentido: Sentido;
  readonly rodape: string | null;
};

/** O que cada forma categórica produz. */
export type DesenhoCategorico =
  | {
      readonly forma: "barras-horizontais";
      readonly categorias: readonly string[];
      readonly valores: readonly (readonly (number | null)[])[];
      readonly total: number | null;
    }
  | {
      readonly forma: "rosca";
      readonly fatias: readonly Parte[];
      readonly centro: {
        readonly valor: number | null;
        readonly rotulo: string;
      };
      readonly total: number | null;
    }
  | {
      readonly forma: "funil";
      readonly passos: readonly {
        readonly nome: string;
        readonly valor: number | null;
      }[];
      readonly total: number | null;
    }
  | {
      readonly forma: "divisao";
      readonly grupos: readonly {
        readonly nome: string;
        readonly total: number | null;
        readonly partes: readonly Parte[];
      }[];
      readonly total: number | null;
    }
  | {
      readonly forma: "estatisticas";
      readonly estatisticas: readonly EstatisticaCalculada[];
      readonly total: number | null;
    };

/* ------------------------------------------------------------------ *
 * Auxiliares
 * ------------------------------------------------------------------ */

function daMetrica(nome: string): (r: Recorte) => number | null {
  const calculo = calculoDaMetrica(nome);
  if (calculo === undefined) {
    throw new Error(
      `A métrica '${nome}' não tem cálculo. Um painel categórico a pediu.`,
    );
  }
  return calculo;
}

/**
 * As áreas e as modalidades, tipadas como o contrato as declara.
 *
 * `AREAS_ARMAZENADAS` é `readonly string[]` — vem do cadastro, e o cadastro não
 * sabe do tipo. Estes painéis precisam **construir** um recorte por área, e um
 * recorte pede o tipo do contrato.
 *
 * A saída poderia ser um `as`, e não é: um `as` aqui calaria o compilador
 * justamente sobre "esta área existe no produto?", que é a pergunta. A lista
 * está escrita, e um teste prova que ela é exatamente a do cadastro — se
 * alguém acrescentar uma área e esquecer daqui, reprova.
 */
const AREAS: readonly Query["area"][] = [
  "operacoes",
  "comercial",
  "tecnologia",
  "logistica",
  "financeiro",
  "marketing",
  "rh",
];

const MODALIDADES: readonly Query["modalidade"][] = [
  "presencial",
  "hibrido",
  "remoto",
];

/**
 * As áreas que o painel enumera.
 *
 * Sob recorte de uma área só, **uma** categoria. É o item do aceite de T-118 —
 * devolver as sete com seis zeradas mostraria a empresa inteira a quem pediu
 * um pedaço, e o zero seria mentira: não é que a área não tenha quadro, é que
 * ela não está no recorte.
 */
function areasDoRecorte(r: Recorte): readonly Query["area"][] {
  if (r.q.area !== AGREGADO_DE_AREA) return [r.q.area];
  return AREAS;
}

/** Avalia uma medida por área, cada uma como um recorte de área só. */
function porArea(
  r: Recorte,
  medir: (daArea: Recorte) => number | null,
): { categorias: readonly string[]; valores: readonly (number | null)[] } {
  const areas = areasDoRecorte(r);
  return {
    categorias: areas,
    valores: areas.map((area) => medir({ ...r, q: { ...r.q, area } })),
  };
}

/**
 * Converte valores em participação de 100 %.
 *
 * O denominador é a soma do que está na tela — ver o cabeçalho. Total zero
 * devolve nulo, e não zero por cento: sem carteira, a pergunta "que fatia isto
 * é" não tem resposta (princípio PR-4).
 */
/**
 * A fatia de uma categoria sem linha no recorte.
 *
 * Zero **por cento**, e não ausência: a categoria existe, não teve movimento, e
 * o total que serve de denominador é conhecido. É diferente do caso em que não
 * há denominador nenhum, tratado logo acima — ali a pergunta não tem resposta e
 * a repartição inteira vem nula.
 *
 * O nome existe porque um `?? 0` solto seria indistinguível de descuido, e a
 * regra de T-141 reprova com razão: nesta camada, zero escrito à mão quase
 * sempre é ausência disfarçada.
 */
const SEM_MOVIMENTO_NO_RECORTE = 0;

function participacao(
  valores: readonly (number | null)[],
): readonly (number | null)[] {
  const conhecidos = valores.filter((v): v is number => v !== null);
  const total = conhecidos.reduce((a, b) => a + b, 0);
  if (conhecidos.length === 0 || total === 0) return valores.map(() => null);
  return valores.map((v) =>
    v === null ? SEM_MOVIMENTO_NO_RECORTE : (v / total) * CEM,
  );
}

/**
 * O total de um painel de participação.
 *
 * É **cem**, e não a base absoluta. O envelope declara uma unidade só, e a
 * desses painéis é `pct`: devolver "145" num painel de porcentagem faria o
 * número grande e as fatias falarem línguas diferentes, e quem lesse os dois
 * juntos teria de adivinhar qual estava certo. A base absoluta — "145 saídas no
 * período" — é leitura em prosa, e é de T-133.
 *
 * Nulo quando não há base: sem saídas no recorte, "que fatia isto é" não tem
 * resposta, e cem seria a afirmação de que está tudo repartido (PR-4).
 */
function totalDeParticipacao(base: number | null): number | null {
  return base === null || base === 0 ? null : CEM;
}

/** A soma de uma série, nula quando nada é conhecido. */
function somaDaSerie(serie: readonly (number | null)[]): number | null {
  const conhecidos = serie.filter((v): v is number => v !== null);
  return conhecidos.length === 0 ? null : conhecidos.reduce((a, b) => a + b, 0);
}

/**
 * Fatias a partir de rótulos e valores, já em participação.
 *
 * Sem denominador, **nenhuma fatia** — e não um anel de zeros. `Parte.valor` é
 * `number` no contrato, então "não sei" não cabe numa fatia; o que cabe é a
 * repartição não existir, e o `total: null` do envelope dizer por quê.
 */
function fatiasDe(
  rotulos: readonly string[],
  valores: readonly (number | null)[],
): readonly Parte[] {
  const pcts = participacao(valores);
  if (pcts.every((v) => v === null)) return [];
  return pcts.flatMap((valor, i) =>
    valor === null ? [] : [{ nome: rotulos[i] ?? "", valor }],
  );
}

/** A quebra de uma view por chave, na ordem das categorias pedidas. */
function quebrar<T extends { mes: string }>(
  todas: readonly T[],
  r: Recorte,
  categorias: readonly string[],
  chave: (l: T) => string,
  medida: (l: T) => number,
): readonly (number | null)[] {
  const doRecorte = todas.filter((l) => pertence(l, r));
  return categorias.map((categoria) => {
    const daCategoria = doRecorte.filter((l) => chave(l) === categoria);
    return daCategoria.length === 0
      ? null
      : daCategoria.reduce((a, l) => a + medida(l), 0);
  });
}

/** O último mês da janela. */
function ultimoMes(r: Recorte): Recorte {
  const ultimo = r.meses.at(-1);
  return { ...r, meses: ultimo === undefined ? [] : [ultimo] };
}

/** Os valores de uma quebra do quadro, na ordem declarada. */
function valoresDaQuebra(dimensao: keyof typeof QUEBRAS_DO_QUADRO) {
  return QUEBRAS_DO_QUADRO[dimensao].map((v) => v.codigo);
}

/** O quadro por valor de uma dimensão do perfil, no fim da janela. */
function quadroPor(
  r: Recorte,
  dimensao: keyof typeof QUEBRAS_DO_QUADRO,
): { categorias: readonly string[]; valores: readonly (number | null)[] } {
  const valores = valoresDaQuebra(dimensao);
  return {
    categorias: valores,
    valores: valores.map((v) => perfil(r, dimensao, [v])),
  };
}

/** As saídas por valor de uma dimensão, somadas na janela. */
function saidasPor(
  r: Recorte,
  dimensao: string,
  valores: readonly string[],
): readonly (number | null)[] {
  return quebrar(
    VW_FATO_RH_DESLIGAMENTO.filter((l) => l.dimensao === dimensao),
    r,
    valores,
    (l) => l.valor,
    (l) => l.desligamentos,
  );
}

/** Uma estatística simples: valor, sentido e rodapé. */
function est(
  valor: number | null,
  sentido: Sentido = "neutro",
  rodape: string | null = null,
): EstatisticaCalculada {
  return { valor, sentido, rodape };
}

/* ------------------------------------------------------------------ *
 * O desenho de cada painel
 * ------------------------------------------------------------------ */

type Fabrica = (r: Recorte) => DesenhoCategorico;

/** Atalho: barras horizontais de uma série só. */
function barras(
  categorias: readonly string[],
  valores: readonly (number | null)[],
  total: number | null,
): DesenhoCategorico {
  return { forma: "barras-horizontais", categorias, valores: [valores], total };
}

/**
 * Barras horizontais com um traço de referência.
 *
 * A referência é uma série de verdade, com um ponto por categoria, e não um
 * número solto no envelope. É o que permite a apresentação desenhar o traço na
 * mesma escala das barras sem recalcular nada — e é o que a declaração de
 * origem promete quando lista uma série de papel `referencia`.
 */
function barrasComMeta(
  categorias: readonly string[],
  valores: readonly (number | null)[],
  meta: number,
  total: number | null,
): DesenhoCategorico {
  return {
    forma: "barras-horizontais",
    categorias,
    valores: [valores, categorias.map(() => meta)],
    total,
  };
}

/** A meta anual de turnover, em %. Traço de `tov-area` e `tov-corte`. */
const META_DE_TURNOVER = 14;

/** A meta de dias até o aceite. Traço de `rec-tempo`. */
const META_DE_DIAS_DE_FECHAMENTO = 40;

export const DESENHO_CATEGORICO: Readonly<Record<string, Fabrica>> = {
  /* ---------------- rh/visao ---------------- */

  "rh-flash": (r) => {
    const admissoes = soma("vw_fato_rh_mes", r, (l) => l.admissoes);
    const saidas = soma("vw_fato_rh_mes", r, (l) => l.desligamentos);
    const porAreaTurnover = porArea(r, daMetrica("turnover_12m"));
    const ordenadas = porAreaTurnover.valores
      .map((v, i) => ({ area: porAreaTurnover.categorias[i] ?? "", v }))
      .filter((x): x is { area: string; v: number } => x.v !== null)
      .sort((a, b) => a.v - b.v);

    const melhor = ordenadas[0];
    const pior = ordenadas.at(-1);
    return {
      forma: "estatisticas",
      estatisticas: [
        est(
          admissoes === null || saidas === null ? null : admissoes - saidas,
          "maior_melhor",
        ),
        est(melhor?.v ?? null, "menor_melhor", melhor?.area ?? null),
        est(pior?.v ?? null, "menor_melhor", pior?.area ?? null),
      ],
      total: admissoes === null || saidas === null ? null : admissoes - saidas,
    };
  },

  "rh-areas": (r) => {
    const quadro = porArea(r, daMetrica("headcount_fte"));
    return barras(
      quadro.categorias,
      quadro.valores,
      somaDaSerie(quadro.valores),
    );
  },

  /* ---------------- rh/colab ---------------- */

  "col-area": (r) => {
    const quadro = porArea(r, daMetrica("headcount_fte"));
    return barras(
      quadro.categorias,
      quadro.valores,
      somaDaSerie(quadro.valores),
    );
  },

  "col-perfil": (r) => {
    const genero = quadroPor(r, "genero");
    const modalidades = MODALIDADES;
    const noFimDaJanela = ultimoMes(r);
    const porModalidade = modalidades.map((modalidade) =>
      soma(
        "vw_fato_rh_mes",
        { ...noFimDaJanela, q: { ...r.q, modalidade } },
        (l) => l.headcountFte,
      ),
    );

    return {
      forma: "divisao",
      grupos: [
        {
          nome: "Gênero",
          total: somaDaSerie(genero.valores),
          partes: fatiasDe(genero.categorias, genero.valores),
        },
        {
          nome: "Modalidade",
          total: somaDaSerie(porModalidade),
          partes: fatiasDe(modalidades, porModalidade),
        },
      ],
      total: totalDeParticipacao(somaDaSerie(genero.valores)),
    };
  },

  "col-idade": (r) => {
    const q = quadroPor(r, "faixa_etaria");
    return barras(q.categorias, q.valores, somaDaSerie(q.valores));
  },

  "col-escol": (r) => {
    const q = quadroPor(r, "escolaridade");
    return barras(q.categorias, q.valores, somaDaSerie(q.valores));
  },

  "col-geo": (r) => {
    const q = quadroPor(r, "uf");
    const comQuadro = q.valores.filter((v) => v !== null && v > 0);
    const total = somaDaSerie(q.valores) ?? 0;
    const sp = q.valores[q.categorias.indexOf("SP")] ?? null;
    const QUATRO = 4;
    const topQuatro = [...q.valores]
      .filter((v): v is number => v !== null)
      .sort((a, b) => b - a)
      .slice(0, QUATRO)
      .reduce((a, b) => a + b, 0);

    return {
      forma: "estatisticas",
      estatisticas: [
        est(comQuadro.length, "neutro", "de 27 unidades federativas"),
        est(emPorcento(razao(sp, total)), "neutro", "São Paulo"),
        est(
          total === 0 ? null : (topQuatro / total) * CEM,
          "neutro",
          "as quatro maiores UFs somadas",
        ),
      ],
      total: comQuadro.length,
    };
  },

  /* ---------------- rh/turnover ---------------- */

  "tov-tipos": (r) => {
    const tipos = [
      ...new Set(
        VW_FATO_RH_DESLIGAMENTO.filter((l) => l.dimensao === "tipo").map(
          (l) => l.valor,
        ),
      ),
    ];
    const saidas = saidasPor(r, "tipo", tipos);
    const pcts = participacao(saidas);
    const voluntario = pcts[tipos.indexOf("voluntario")] ?? null;
    return {
      forma: "rosca",
      fatias: fatiasDe(tipos, saidas),
      centro: { valor: voluntario, rotulo: "voluntário" },
      total: totalDeParticipacao(somaDaSerie(saidas)),
    };
  },

  "tov-area": (r) =>
    barrasComMeta(
      porArea(r, daMetrica("turnover_12m")).categorias,
      porArea(r, daMetrica("turnover_12m")).valores,
      META_DE_TURNOVER,
      daMetrica("turnover_12m")(r),
    ),

  "tov-corte": (r) => {
    /*
     * Dois cortes no mesmo eixo, que é o que o painel existe para permitir.
     *
     * A taxa de cada valor é saídas do valor sobre quadro do valor — e não
     * sobre o quadro total. Dividir pelo total daria a *participação* nas
     * saídas, que é outra pergunta: a faixa 25–34 tem mais saídas que a 18–24
     * simplesmente por ser maior, e o painel diria o contrário do que quer.
     */
    const cortes = ["genero", "faixa_etaria"] as const;
    const categorias: string[] = [];
    const taxas: (number | null)[] = [];

    for (const corte of cortes) {
      const valores = valoresDaQuebra(corte);
      const saidas = saidasPor(r, corte, valores);
      valores.forEach((v, i) => {
        const quadro = perfil(ultimoMes(r), corte, [v]);
        categorias.push(v);
        taxas.push(emPorcento(razao(saidas[i] ?? null, quadro)));
      });
    }

    return barrasComMeta(
      categorias,
      taxas,
      META_DE_TURNOVER,
      daMetrica("turnover_12m")(r),
    );
  },

  "tov-resumo": (r) => {
    const custo = (reposicao: boolean) => {
      const codigos = reposicao
        ? ["recrutamento", "ramp-up", "produtividade"]
        : ["rescisao"];
      return emMilhoes(
        somaDaSerie(
          quebrar(
            VW_FATO_TURNOVER_CUSTO,
            r,
            codigos,
            (l) => l.componente,
            (l) => l.valor,
          ),
        ),
      );
    };
    const rescisao = custo(false);
    const reposicao = custo(true);
    const total =
      rescisao === null || reposicao === null ? null : rescisao + reposicao;

    return {
      forma: "estatisticas",
      estatisticas: [
        est(rescisao, "menor_melhor", "verbas rescisórias pagas no período"),
        est(reposicao, "menor_melhor", "recrutamento, ramp-up e produtividade"),
        est(total, "menor_melhor", null),
      ],
      total,
    };
  },

  /* ---------------- rh/recrut ---------------- */

  "rec-status": (r) => {
    const rotulos = ["Abertas", "Em andamento", "Fechadas", "Canceladas"];
    const valores = [
      soma("vw_fato_vagas", r, (l) => l.abertas),
      soma("vw_fato_vagas", r, (l) => l.emAndamento),
      soma("vw_fato_vagas", r, (l) => l.fechadas),
      soma("vw_fato_vagas", r, (l) => l.canceladas),
    ];
    const pcts = participacao(valores);
    return {
      forma: "rosca",
      fatias: fatiasDe(rotulos, valores),
      centro: { valor: pcts[2] ?? null, rotulo: "fechadas" },
      total: totalDeParticipacao(somaDaSerie(valores)),
    };
  },

  "rec-funil": (r) => {
    const passos = [
      { nome: "Candidaturas", medida: (l: LinhaDeVagas) => l.candidaturas },
      { nome: "Triagem", medida: (l: LinhaDeVagas) => l.triagem },
      { nome: "Entrevistas", medida: (l: LinhaDeVagas) => l.entrevistas },
      { nome: "Propostas", medida: (l: LinhaDeVagas) => l.propostas },
      { nome: "Contratados", medida: (l: LinhaDeVagas) => l.contratados },
    ];
    const valores = passos.map((p) => soma("vw_fato_vagas", r, p.medida));
    return {
      forma: "funil",
      passos: passos.map((p, i) => ({
        nome: p.nome,
        valor: valores[i] ?? null,
      })),
      // O topo do funil: o total do painel é quem entrou, não a soma dos
      // passos — somar candidatura com contratação contaria a mesma pessoa
      // cinco vezes.
      total: valores[0] ?? null,
    };
  },

  "rec-fontes": (r) => {
    const fontes = [
      ...new Set(linhas("vw_fato_vagas_fonte", r).map((l) => l.fonte)),
    ].sort();
    const contratados = quebrar(
      linhas("vw_fato_vagas_fonte", r),
      r,
      fontes,
      (l) => l.fonte,
      (l) => l.contratados,
    );
    return barras(
      fontes,
      participacao(contratados),
      totalDeParticipacao(somaDaSerie(contratados)),
    );
  },

  "rec-tempo": (r) => {
    const t = porArea(r, daMetrica("tempo_fechamento"));
    return barrasComMeta(
      t.categorias,
      t.valores,
      META_DE_DIAS_DE_FECHAMENTO,
      daMetrica("tempo_fechamento")(r),
    );
  },

  "rec-resumo": (r) => {
    const movimentadas =
      (soma("vw_fato_vagas", r, (l) => l.abertas) ?? 0) +
      (soma("vw_fato_vagas", r, (l) => l.emAndamento) ?? 0) +
      (soma("vw_fato_vagas", r, (l) => l.fechadas) ?? 0) +
      (soma("vw_fato_vagas", r, (l) => l.canceladas) ?? 0);
    const fechadas = soma("vw_fato_vagas", r, (l) => l.fechadas);

    return {
      forma: "estatisticas",
      estatisticas: [
        est(
          movimentadas === 0 ? null : movimentadas,
          "neutro",
          "abertas, em andamento, fechadas e canceladas",
        ),
        est(
          movimentadas === 0 ? null : emPorcento(razao(fechadas, movimentadas)),
          "maior_melhor",
          "fechadas ÷ vagas movimentadas",
        ),
        est(daMetrica("custo_por_contratacao")(r), "menor_melhor", null),
        est(daMetrica("tempo_fechamento")(r), "menor_melhor", null),
      ],
      total: movimentadas === 0 ? null : movimentadas,
    };
  },

  /* ---------------- rh/trein ---------------- */

  "tre-conclusao": (r) => {
    const concluidas = daMetrica("conclusao_treinamento")(r);
    return {
      forma: "rosca",
      /*
       * Sem trilha iniciada no recorte não há o que repartir, e o anel some.
       * Desenhar "0% concluídas / 100% em andamento" afirmaria que existem
       * trilhas paradas — a afirmação oposta à que o dado sustenta.
       */
      fatias:
        concluidas === null
          ? []
          : [
              { nome: "Concluídas", valor: concluidas },
              { nome: "Em andamento", valor: CEM - concluidas },
            ],
      centro: { valor: concluidas, rotulo: "concluídas" },
      total: concluidas === null ? null : CEM,
    };
  },

  "tre-modal": (r) => {
    const modalidades = [
      ...new Set(
        linhas("vw_fato_treinamento", r).map((l) => l.modalidadeDeTrilha),
      ),
    ].sort();
    const horas = quebrar(
      linhas("vw_fato_treinamento", r),
      r,
      modalidades,
      (l) => l.modalidadeDeTrilha,
      (l) => l.horas,
    );
    return {
      forma: "divisao",
      grupos: [
        {
          nome: "Horas por modalidade",
          total: somaDaSerie(horas),
          partes: fatiasDe(modalidades, horas),
        },
      ],
      total: totalDeParticipacao(somaDaSerie(horas)),
    };
  },

  "tre-conclmod": (r) => {
    const modalidades = [
      ...new Set(
        linhas("vw_fato_treinamento", r).map((l) => l.modalidadeDeTrilha),
      ),
    ].sort();
    const doRecorte = linhas("vw_fato_treinamento", r);
    const taxas = modalidades.map((modalidade) => {
      const daModalidade = doRecorte.filter(
        (l) => l.modalidadeDeTrilha === modalidade,
      );
      const iniciadas = daModalidade.reduce(
        (a, l) => a + l.trilhasIniciadas,
        0,
      );
      const concluidas = daModalidade.reduce(
        (a, l) => a + l.trilhasConcluidas,
        0,
      );
      return emPorcento(razao(concluidas, iniciadas));
    });
    return barras(modalidades, taxas, daMetrica("conclusao_treinamento")(r));
  },

  "tre-invest": (r) => ({
    forma: "estatisticas",
    estatisticas: [
      est(daMetrica("investimento_treinamento")(r), "neutro", null),
      est(daMetrica("horas_treinamento")(r), "maior_melhor", null),
      est(
        daMetrica("participacao_treinamento")(r),
        "maior_melhor",
        "do quadro com ao menos uma trilha",
      ),
    ],
    total: daMetrica("investimento_treinamento")(r),
  }),

  "tre-area": (r) => {
    const areas = areasDoRecorte(r);
    const horas = quebrar(
      linhas("vw_fato_treinamento", r),
      r,
      areas,
      (l) => l.area,
      (l) => l.horas,
    );
    return barras(areas, horas, somaDaSerie(horas));
  },

  /* ---------------- rh/engaj ---------------- */

  "eng-area": (r) => {
    const e = porArea(r, daMetrica("engajamento_area"));
    return barras(e.categorias, e.valores, daMetrica("engajamento_area")(r));
  },

  "eng-cat": (r) => {
    /*
     * Somado na janela, e não lido no último mês.
     *
     * A primeira versão usava `noFim`, e a suíte da regra 1 pegou: o cartão
     * `rh-engaj-promotores` dizia 41,27 % e este painel, na mesma tela, dizia
     * 41,07 %. Dois números para a mesma coisa, com 0,2 p.p. de diferença — o
     * suficiente para aparecer e para ninguém saber qual seguir.
     *
     * O certo é somar: respondente de pesquisa é FLUXO, não estoque. Cada mês
     * traz uma rodada nova, e "quantos promotores houve no período" soma as
     * rodadas. Ler só dezembro faria o filtro de período não chegar ao dado —
     * o achado 6 do Anexo D em outra forma —, e é o que a fórmula do catálogo
     * já dizia: `soma(promotores) / soma(respondentes)`.
     */
    const rotulos = ["Promotores", "Neutros", "Detratores"];
    const valores = [
      soma("vw_fato_rh_mes", r, (l) => l.promotores),
      soma("vw_fato_rh_mes", r, (l) => l.neutros),
      soma("vw_fato_rh_mes", r, (l) => l.detratores),
    ];
    return {
      forma: "divisao",
      grupos: [
        {
          nome: "Categorias do eNPS",
          total: somaDaSerie(valores),
          partes: fatiasDe(rotulos, valores),
        },
      ],
      total: totalDeParticipacao(somaDaSerie(valores)),
    };
  },

  "eng-clima": (r) => {
    const porAreaEng = porArea(r, daMetrica("engajamento_area"));
    const piores = porAreaEng.valores
      .map((v, i) => ({ area: porAreaEng.categorias[i] ?? "", v }))
      .filter((x): x is { area: string; v: number } => x.v !== null)
      .sort((a, b) => a.v - b.v);
    const pior = piores[0];

    return {
      forma: "estatisticas",
      estatisticas: [
        est(daMetrica("enps")(r), "maior_melhor", null),
        est(daMetrica("engajamento_area")(r), "maior_melhor", null),
        est(daMetrica("absenteismo")(r), "menor_melhor", null),
        est(pior?.v ?? null, "maior_melhor", pior?.area ?? null),
      ],
      total: daMetrica("enps")(r),
    };
  },

  /* ---------------- rh/sal ---------------- */

  "sal-medio": (r) => {
    const s = porArea(r, daMetrica("salario_medio"));
    return barras(s.categorias, s.valores, daMetrica("salario_medio")(r));
  },

  "sal-comp": (r) => {
    const rotulos = ["Salários", "Encargos", "Benefícios", "Variável"];
    const valores = [
      emMilhoes(soma("vw_fato_rh_mes", r, (l) => l.salarios)),
      emMilhoes(soma("vw_fato_rh_mes", r, (l) => l.encargos)),
      emMilhoes(soma("vw_fato_rh_mes", r, (l) => l.beneficios)),
      emMilhoes(soma("vw_fato_rh_mes", r, (l) => l.variavel)),
    ];
    const pcts = participacao(valores);
    return {
      forma: "rosca",
      fatias: fatiasDe(rotulos, valores),
      centro: { valor: pcts[0] ?? null, rotulo: "salários" },
      total: totalDeParticipacao(somaDaSerie(valores)),
    };
  },

  "sal-folha": (r) => {
    const f = porArea(r, daMetrica("folha_total"));
    return barras(f.categorias, f.valores, daMetrica("folha_total")(r));
  },

  "sal-benef": (r) => {
    const rotulos = ["Encargos", "Benefícios"];
    const valores = [
      emMilhoes(soma("vw_fato_rh_mes", r, (l) => l.encargos)),
      emMilhoes(soma("vw_fato_rh_mes", r, (l) => l.beneficios)),
    ];
    return barras(rotulos, valores, somaDaSerie(valores));
  },

  "sal-resumo": () => {
    /*
     * O único painel que não lê fato nenhum.
     *
     * Os limites da política de remuneração são cadastro: não têm mês nem
     * célula, e por isso não mudam com o recorte. Está declarado como
     * invariante — a alternativa, fingir que respondem ao filtro, seria pior.
     */
    const tetos = VW_DIM_CARGO.map((c) => c.ate).filter(
      (v): v is number => v !== null,
    );
    const pisos = VW_DIM_CARGO.map((c) => c.de);
    const maior = tetos.length === 0 ? null : Math.max(...tetos);
    const menor = pisos.length === 0 ? null : Math.min(...pisos);
    const maiorCargo = VW_DIM_CARGO.find((c) => c.ate === maior);
    const menorCargo = VW_DIM_CARGO.find((c) => c.de === menor);

    return {
      forma: "estatisticas",
      estatisticas: [
        est(emMilhoes(maior), "neutro", maiorCargo?.rotulo ?? null),
        est(emMilhoes(menor), "neutro", menorCargo?.rotulo ?? null),
        est(
          razao(maior, menor),
          "menor_melhor",
          "entre o menor e o maior salário base",
        ),
      ],
      total: emMilhoes(maior),
    };
  },

  /* ---------------- fin ---------------- */

  "cx-cat": (r) => {
    const codigos = NATUREZAS_DE_SAIDA.map((n) => n.codigo);
    const valores = quebrar(
      VW_FATO_SAIDA_CATEGORIA,
      r,
      codigos,
      (l) => l.categoria,
      (l) => l.valor,
    ).map(emMilhoes);
    return barras(
      codigos.map((c) => rotuloDe(NATUREZAS_DE_SAIDA, c)),
      valores,
      somaDaSerie(valores),
    );
  },

  "orc-gastos": (r) => {
    const centros = CENTROS_DE_CUSTO.map((c) => c.codigo);
    const valores = quebrar(
      VW_FATO_ORCAMENTO,
      r,
      centros,
      (l) => l.centroDeCusto,
      (l) => l.realizado,
    ).map(emMilhoes);
    return barras(centros, valores, somaDaSerie(valores));
  },

  "cr-inadim": (r) => {
    const nomeados = CLIENTES_A_RECEBER.filter(
      (c) => c.codigo !== "outros-clientes",
    );
    const vencido = VW_FATO_CONTAS.filter((l) => l.faixaDeAging !== "a-vencer");
    const valores = quebrar(
      vencido,
      ultimoMes(r),
      nomeados.map((c) => c.codigo),
      (l) => l.contraparte,
      (l) => l.aReceber,
    ).map(emMilhoes);
    return barras(
      nomeados.map((c) => c.rotulo),
      valores,
      somaDaSerie(valores),
    );
  },

  "cp-fornec": (r) => {
    const nomeados = FORNECEDORES_A_PAGAR.filter(
      (c) => c.codigo !== "outros-fornecedores",
    );
    const valores = quebrar(
      VW_FATO_CONTAS,
      ultimoMes(r),
      nomeados.map((c) => c.codigo),
      (l) => l.contraparte,
      (l) => l.aPagar,
    ).map(emMilhoes);
    return barras(
      nomeados.map((c) => c.rotulo),
      valores,
      somaDaSerie(valores),
    );
  },

  "fat-segm": (r) => {
    const valores = quebrar(
      VW_FATO_FATURAMENTO_CLIENTE,
      r,
      SEGMENTOS_DE_CLIENTE,
      (l) => l.segmento,
      (l) => l.receita,
    );
    const pcts = participacao(valores);
    return {
      forma: "rosca",
      fatias: fatiasDe(SEGMENTOS_DE_CLIENTE, valores),
      centro: { valor: pcts[0] ?? null, rotulo: "indústria" },
      total: totalDeParticipacao(somaDaSerie(valores)),
    };
  },
};

/** O tipo das linhas de vagas, para as medidas do funil. */
type LinhaDeVagas = (typeof VW_FATO_VAGAS)[number];

/** Os painéis categóricos que já sabem se desenhar. */
export function paineisCategoricosComDesenho(): readonly string[] {
  return Object.keys(DESENHO_CATEGORICO);
}

/** Reexportado para quem monta o envelope. */
export { MESES_DO_ANO };
