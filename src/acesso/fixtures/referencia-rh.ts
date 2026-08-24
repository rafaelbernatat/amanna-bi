/**
 * As séries de referência de RH, transcritas do protótipo (T-110).
 *
 * ## De onde vêm estes números
 *
 * Do objeto `D` de `public/design/Dashboard BI v2.dc.html`, que o EXECUTE trata
 * como fonte da verdade de comportamento de tela e que é **somente leitura**.
 * Não foram inventados aqui: são os valores que já foram aprovados visualmente
 * na Fase 0, e usá-los é o que faz o mockup parecer com o que foi aprovado.
 *
 * Este arquivo é a **entrada** da modelagem; as linhas dimensionais em `rh.ts`
 * são a saída. A diferença importa: aqui estão totais mensais e perfis por
 * área — lá está uma linha por mês × entidade × área × modalidade, que é o grão
 * que o adaptador consulta.
 *
 * ## O que foi conferido antes de transcrever
 *
 * As séries **fecham entre si**, e isso foi medido, não suposto:
 *
 * | Conta | Resultado |
 * |---|---|
 * | `soma(admissoes)` | 241 — o valor do Anexo C |
 * | `soma(desligamentos)` | 145 — idem, e igual à soma dos 4 tipos de desligamento |
 * | `soma(folha)` | R$ 186 mi — idem |
 * | `headcount` de dezembro | 1.240 FTE — idem, e igual à soma das 7 áreas e à das 3 modalidades |
 * | `soma(horas de treinamento)` | 21.400 h — o valor do aceite de T-110 |
 * | fluxo mês a mês | `hc[m] = hc[m-1] + adm[m] - desl[m]` fecha nos **doze** meses |
 *
 * ## As duas divergências do Anexo C
 *
 * Registradas em [D-H03](../../../docs/decisoes/D-H03-modo-mockup.md) e são o
 * material pronto da reunião de H-03.
 *
 * **1. O saldo inicial é 1.144, não 1.150.** O Anexo C escreve
 * `1.240 FTE = 1.150 + 241 admissões - 145 saídas`, e a conta dá 1.246. O
 * protótipo resolve a questão sozinho: `hc[0] = 1150` é o fechamento de
 * **janeiro**, não a abertura do ano. Com abertura 1.144 o fluxo fecha nos doze
 * meses, incluindo janeiro (1.144 + 18 - 12 = 1.150). O 1.150 do Anexo C está
 * na posição errada da fórmula.
 *
 * **2. O turnover de 18,4% não é derivável.** Com 145 desligamentos sobre um
 * headcount médio de 1.200, a taxa é **12,1%**. Para dar 18,4% seriam precisos
 * ~221 desligamentos, e aí as 241 admissões deixariam o headcount em 1.164 e
 * não em 1.240. A série `tov` do protótipo e o `tov` por área contam a mesma
 * história paralela: a média ponderada deles é 19,3%, o que implicaria 239
 * desligamentos.
 *
 * A escolha para o mockup: **o fluxo é a fonte, e o turnover é calculado dele.**
 * Guardar 18,4% como série literal reproduziria o achado 5 do Anexo D — um KPI
 * que não responde ao recorte — que é o que RF-07 proíbe e o que as regras de
 * lint de T-141 e T-181 já policiam. O que se preserva do protótipo é a
 * **forma** do painel `tov-area`: o `tov` por área entra como peso da
 * repartição dos 145, então o ranking entre áreas continua igual.
 */

/* ------------------------------------------------------------------ *
 * Séries mensais — janeiro a dezembro
 * ------------------------------------------------------------------ */

/** Headcount FTE no fechamento de cada mês. Estoque: agrega por `last`. */
export const HEADCOUNT_MENSAL: readonly number[] = [
  1150, 1162, 1174, 1181, 1195, 1203, 1198, 1210, 1222, 1231, 1236, 1240,
];

/** Admissões do mês. Fluxo: agrega por `sum`. Soma 241. */
export const ADMISSOES_MENSAL: readonly number[] = [
  18, 22, 25, 16, 28, 20, 12, 26, 24, 20, 14, 16,
];

/** Desligamentos do mês. Fluxo: agrega por `sum`. Soma 145. */
export const DESLIGAMENTOS_MENSAL: readonly number[] = [
  12, 10, 13, 9, 14, 12, 17, 14, 12, 11, 9, 12,
];

/**
 * O saldo de abertura do ano, **derivado** e não transcrito.
 *
 * É o que faz o fluxo fechar em janeiro. Ver a divergência 1 no cabeçalho: o
 * Anexo C escreve 1.150 aqui, que é o fechamento de janeiro.
 */
export const SALDO_DE_ABERTURA: number =
  (HEADCOUNT_MENSAL[0] ?? 0) -
  (ADMISSOES_MENSAL[0] ?? 0) +
  (DESLIGAMENTOS_MENSAL[0] ?? 0);

/** Folha do mês em reais. Soma R$ 186 mi. Inteiro para a soma ser exata. */
export const FOLHA_MENSAL_REAIS: readonly number[] = [
  14_800_000, 15_000_000, 15_100_000, 15_200_000, 15_400_000, 15_500_000,
  15_500_000, 15_600_000, 15_700_000, 15_800_000, 15_900_000, 16_500_000,
];

/** Absenteísmo do mês, em pontos percentuais. Taxa: agrega por `ratio`. */
export const ABSENTEISMO_MENSAL: readonly number[] = [
  2.2, 2.3, 2.5, 2.4, 2.6, 2.5, 2.8, 2.9, 3.0, 2.8, 2.7, 2.7,
];

/** eNPS do mês, em pontos (-100 a +100). Taxa: agrega por `ratio`. */
export const ENPS_MENSAL: readonly number[] = [
  21, 23, 22, 26, 28, 30, 27, 29, 31, 30, 33, 32,
];

/**
 * Percentual de detratores em cada mês.
 *
 * Não está no protótipo como série: lá só existe a foto de dezembro
 * (`enpsCat` = 41 promotores, 50 neutros, 9 detratores). A série foi construída
 * para **chegar** nessa foto — dezembro é 9% — e para que
 * `promotores - detratores` reproduza `ENPS_MENSAL` em cada mês. Sem os três
 * componentes o eNPS não teria como ser recalculado sob recorte, e viraria
 * número fixo (achado 5 do Anexo D).
 */
export const DETRATORES_PCT_MENSAL: readonly number[] = [
  18, 17, 17, 15, 14, 13, 14, 13, 12, 11, 10, 9,
];

/** Engajamento médio do mês, em pontos de 0 a 100. Taxa: `ratio`. */
export const ENGAJAMENTO_MENSAL: readonly number[] = [
  68, 69, 70, 71, 72, 73, 71, 72, 73, 74, 75, 74,
];

/** Cobertura da pesquisa de clima: fração do quadro que respondeu. */
export const COBERTURA_DA_PESQUISA = 0.74;

/** Horas previstas de trabalho por FTE em um mês. */
export const HORAS_PREVISTAS_POR_FTE = 160;

/** Horas de treinamento realizadas no mês. Soma 21.400. */
export const HORAS_TREINAMENTO_MENSAL: readonly number[] = [
  1420, 1680, 1910, 1740, 2050, 2210, 1580, 1490, 1830, 1960, 1780, 1750,
];

/** Percentual do quadro com ao menos uma trilha, por mês. */
export const PARTICIPACAO_TREINAMENTO_MENSAL: readonly number[] = [
  71, 69, 72, 68, 74, 77, 73, 71, 75, 76, 72, 78,
];

/** Dias médios para fechar uma vaga, por mês. */
export const DIAS_PARA_FECHAR_MENSAL: readonly number[] = [
  46, 44, 45, 43, 42, 41, 43, 40, 41, 39, 40, 42,
];

/* ------------------------------------------------------------------ *
 * Perfil por área
 * ------------------------------------------------------------------ */

/**
 * O perfil de cada área, na ordem do vocabulário.
 *
 * As colunas **não são proporcionais entre si**, e é isso que dá valor ao
 * conjunto: Tecnologia tem 13,5% do quadro e 22% da folha; RH tem 4,5% do
 * quadro e o melhor engajamento. Um dataset onde toda medida se distribui pelo
 * mesmo perfil não distingue um adaptador correto de um que multiplica tudo
 * pelo mesmo fator — que é exatamente o achado 3 do Anexo D, e é o controle
 * negativo que T-140 vai exigir.
 */
export type PerfilDeArea = {
  readonly codigo: string;
  /** Headcount FTE em dezembro. Soma 1.240. */
  readonly headcount: number;
  /** Folha do ano em reais. Soma R$ 186 mi. */
  readonly folhaReais: number;
  /** Horas de treinamento no ano. Soma 21.400. */
  readonly horasTreinamento: number;
  /** Turnover do protótipo, usado como **peso** da repartição (ver cabeçalho). */
  readonly pesoDeDesligamento: number;
  /** Dias médios para fechar uma vaga na área. */
  readonly diasParaFechar: number;
  /** Engajamento médio da área, em pontos. */
  readonly engajamento: number;
  /** Vagas no ano: abertas, em andamento, fechadas. */
  readonly vagas: readonly [number, number, number];
};

export const PERFIL_POR_AREA: readonly PerfilDeArea[] = [
  {
    codigo: "operacoes",
    headcount: 486,
    folhaReais: 58_000_000,
    horasTreinamento: 7800,
    pesoDeDesligamento: 22.4,
    diasParaFechar: 29,
    engajamento: 72,
    vagas: [14, 7, 38],
  },
  {
    codigo: "comercial",
    headcount: 214,
    folhaReais: 34_000_000,
    horasTreinamento: 4200,
    pesoDeDesligamento: 24.1,
    diasParaFechar: 38,
    engajamento: 73,
    vagas: [11, 5, 22],
  },
  {
    codigo: "tecnologia",
    headcount: 168,
    folhaReais: 41_000_000,
    horasTreinamento: 4600,
    pesoDeDesligamento: 14.2,
    diasParaFechar: 61,
    engajamento: 80,
    vagas: [13, 6, 14],
  },
  {
    codigo: "logistica",
    headcount: 142,
    folhaReais: 17_000_000,
    horasTreinamento: 2100,
    pesoDeDesligamento: 19.8,
    diasParaFechar: 26,
    engajamento: 70,
    vagas: [5, 2, 11],
  },
  {
    codigo: "financeiro",
    headcount: 96,
    folhaReais: 18_000_000,
    horasTreinamento: 1300,
    pesoDeDesligamento: 9.4,
    diasParaFechar: 44,
    engajamento: 79,
    vagas: [2, 1, 5],
  },
  {
    codigo: "marketing",
    headcount: 78,
    folhaReais: 12_000_000,
    horasTreinamento: 900,
    pesoDeDesligamento: 16.7,
    diasParaFechar: 47,
    engajamento: 77,
    vagas: [2, 1, 4],
  },
  {
    codigo: "rh",
    headcount: 56,
    folhaReais: 6_000_000,
    horasTreinamento: 500,
    pesoDeDesligamento: 8.9,
    diasParaFechar: 33,
    engajamento: 82,
    vagas: [1, 1, 2],
  },
];

/** Vagas canceladas no ano. O protótipo não as distribui por área. */
export const VAGAS_CANCELADAS = 12;

/* ------------------------------------------------------------------ *
 * Perfil por modalidade de trabalho
 * ------------------------------------------------------------------ */

/** Headcount de dezembro por modalidade. Soma 1.240. */
export const HEADCOUNT_POR_MODALIDADE: readonly {
  readonly codigo: string;
  readonly headcount: number;
}[] = [
  { codigo: "presencial", headcount: 604 },
  { codigo: "hibrido", headcount: 472 },
  { codigo: "remoto", headcount: 164 },
];

/* ------------------------------------------------------------------ *
 * Recrutamento e treinamento
 * ------------------------------------------------------------------ */

/** As cinco etapas do funil, no ano. Contratados = 96 = vagas fechadas. */
export const FUNIL_ANUAL: readonly {
  readonly etapa: string;
  readonly total: number;
}[] = [
  { etapa: "candidaturas", total: 4820 },
  { etapa: "triagem", total: 1180 },
  { etapa: "entrevistas", total: 412 },
  { etapa: "propostas", total: 128 },
  { etapa: "contratados", total: 96 },
];

/** Participação de cada fonte nas contratações efetivadas, em %. Soma 100. */
export const FONTES_DE_CANDIDATO: readonly {
  readonly codigo: string;
  readonly rotulo: string;
  readonly participacao: number;
}[] = [
  { codigo: "indicacao", rotulo: "Indicação", participacao: 34 },
  { codigo: "linkedin", rotulo: "LinkedIn", participacao: 27 },
  {
    codigo: "banco-de-talentos",
    rotulo: "Banco de talentos",
    participacao: 14,
  },
  { codigo: "agencia", rotulo: "Agência", participacao: 11 },
  { codigo: "site-proprio", rotulo: "Site próprio", participacao: 9 },
  { codigo: "outros", rotulo: "Outros", participacao: 5 },
];

/** As cinco trilhas e o investimento anual de cada uma. Soma R$ 4,2 mi. */
export const TRILHAS: readonly {
  readonly codigo: string;
  readonly rotulo: string;
  readonly investimentoReais: number;
}[] = [
  { codigo: "tecnico", rotulo: "Técnico", investimentoReais: 1_600_000 },
  { codigo: "lideranca", rotulo: "Liderança", investimentoReais: 1_400_000 },
  { codigo: "compliance", rotulo: "Compliance", investimentoReais: 500_000 },
  { codigo: "idiomas", rotulo: "Idiomas", investimentoReais: 400_000 },
  { codigo: "soft-skills", rotulo: "Soft skills", investimentoReais: 300_000 },
];

/**
 * A modalidade **do treinamento**, que não é a modalidade de trabalho.
 *
 * São duas dimensões diferentes com nomes parecidos, e confundi-las é o tipo de
 * erro que só aparece na reunião: o quadro se divide em Presencial, Híbrido e
 * Remoto; a trilha se dá em Online, Presencial ou Híbrido. Um colaborador
 * remoto faz trilha presencial sem contradição nenhuma.
 */
export const MODALIDADES_DE_TREINAMENTO: readonly {
  readonly codigo: string;
  readonly rotulo: string;
  /** Horas no ano. Soma 21.400. */
  readonly horas: number;
  /** Percentual das trilhas iniciadas que foram concluídas. */
  readonly conclusao: number;
}[] = [
  { codigo: "online", rotulo: "Online", horas: 11_800, conclusao: 58 },
  { codigo: "presencial", rotulo: "Presencial", horas: 6200, conclusao: 86 },
  { codigo: "hibrido", rotulo: "Híbrido", horas: 3400, conclusao: 71 },
];

/** Desligamentos do ano por tipo. Soma 145. */
export const DESLIGAMENTOS_POR_TIPO: readonly {
  readonly codigo: string;
  readonly rotulo: string;
  readonly total: number;
}[] = [
  { codigo: "voluntario", rotulo: "Voluntário", total: 90 },
  { codigo: "sem-justa-causa", rotulo: "Sem justa causa", total: 42 },
  { codigo: "aposentadoria", rotulo: "Aposentadoria", total: 8 },
  { codigo: "outros", rotulo: "Outros", total: 5 },
];
