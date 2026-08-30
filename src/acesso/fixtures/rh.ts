/**
 * As três views de fato de RH, no grão da seção 10.1 (T-110).
 *
 * | View | Grão | Medidas |
 * |---|---|---|
 * | `vw_fato_rh_mes` | mês × entidade × área × modalidade | headcount, admissões, desligamentos, folha, absenteísmo, eNPS, engajamento |
 * | `vw_fato_vagas` | mês × área | abertas, em andamento, fechadas, canceladas, dias para fechar, etapas do funil |
 * | `vw_fato_treinamento` | mês × área × trilha × modalidade de trilha | horas, investimento, participação, conclusão |
 *
 * ## Taxa nenhuma é armazenada
 *
 * Absenteísmo, eNPS e engajamento **não** existem como coluna. O que existe é o
 * numerador e o denominador de cada um — horas ausentes e horas previstas,
 * promotores e detratores e respondentes, pontos somados e respondentes.
 *
 * É a regra 4 do contrato levada a sério: *"o catálogo marca cada métrica como
 * `sum | last | ratio`, para que um recorte de 3 meses nunca some percentuais"*.
 * Uma taxa guardada pronta não tem como ser recalculada sob recorte — some com
 * a média, ou pior, aparece somada. Guardando os componentes, o recorte de
 * Tecnologia em julho recalcula a taxa daquele recorte, que é o que RF-01 pede.
 *
 * ## O headcount é fluxo acumulado, não série independente
 *
 * `headcountFte` de cada célula é o saldo de abertura mais o acumulado de
 * admissões menos desligamentos daquela célula. A identidade contábil vale em
 * **todo** grão, não só no total — e por isso o painel de saldo líquido fecha
 * com o de quadro em qualquer recorte.
 *
 * O saldo de abertura é derivado ao contrário: parte-se do quadro de dezembro
 * por área e modalidade, que é o que o protótipo aprovou, e subtrai-se o
 * acumulado do ano. Assim dezembro reproduz a foto aprovada **e** a identidade
 * fecha nos doze meses.
 */

import {
  AREAS_ARMAZENADAS,
  celulas,
  ENTIDADES_ARMAZENADAS,
  MODALIDADES_ARMAZENADAS,
  mesesDe,
  type Celula,
} from "@/acesso/fixtures/eixos";
import { fatiaDaEntidade } from "@/acesso/fixtures/entidade";
import {
  ABSENTEISMO_MENSAL,
  ADMISSOES_MENSAL,
  COBERTURA_DA_PESQUISA,
  DESLIGAMENTOS_MENSAL,
  DETRATORES_PCT_MENSAL,
  DIAS_PARA_FECHAR_MENSAL,
  ENGAJAMENTO_MENSAL,
  ENPS_MENSAL,
  FOLHA_MENSAL_REAIS,
  FONTES_DE_CANDIDATO,
  FUNIL_ANUAL,
  HEADCOUNT_MENSAL,
  HEADCOUNT_POR_MODALIDADE,
  HORAS_PREVISTAS_POR_FTE,
  HORAS_TREINAMENTO_MENSAL,
  MODALIDADES_DE_TREINAMENTO,
  PARTICIPACAO_TREINAMENTO_MENSAL,
  CUSTO_POR_CABECA_DA_MODALIDADE,
  PERFIL_POR_AREA,
  TRILHAS,
  VAGAS_CANCELADAS,
} from "@/acesso/fixtures/referencia-rh";
import {
  COMPOSICAO_DA_FOLHA,
  CUSTO_DO_TURNOVER,
  CUSTO_POR_CONTRATACAO,
  IDADE_MEDIA,
  TEMPO_MEDIO_ATE_A_SAIDA,
  TEMPO_MEDIO_DE_CASA,
} from "@/acesso/fixtures/referencia-perfil";
import {
  ajustarMargemDeColuna,
  repartir,
  repartirMatriz,
  repartirMatrizComPerfil,
} from "@/acesso/fixtures/reparticao";
import {
  ADMISSAO_POR_MODALIDADE,
  FOLHA_POR_AREA,
  FOLHA_POR_ENTIDADE,
  FOLHA_POR_MODALIDADE,
  noMes,
} from "@/acesso/fixtures/sazonalidade";

/** O ano que esta fixture carrega. 2025 entra com T-152. */
export const ANO_DA_FIXTURE = "2026";

const MESES = mesesDe(ANO_DA_FIXTURE);
const CELULAS = celulas();
const CEM_PORCENTO = 100;

/* ------------------------------------------------------------------ *
 * Auxiliares de peso
 * ------------------------------------------------------------------ */

function perfilDe(area: string) {
  const achado = PERFIL_POR_AREA.find((p) => p.codigo === area);
  if (achado === undefined) {
    throw new Error(`Área '${area}' não tem perfil em referencia-rh.ts.`);
  }
  return achado;
}

function indiceDaCelula(c: Celula): number {
  return CELULAS.findIndex(
    (x) =>
      x.entidade === c.entidade &&
      x.area === c.area &&
      x.modalidade === c.modalidade,
  );
}

/* ------------------------------------------------------------------ *
 * O quadro de dezembro, com as duas margens exatas
 * ------------------------------------------------------------------ */

/**
 * Headcount de dezembro por área × modalidade.
 *
 * As duas margens fecham ao mesmo tempo — a soma por área reproduz o perfil do
 * protótipo e a soma por modalidade reproduz 604/472/164. Repartir por área e
 * depois por modalidade dentro de cada área acertaria a primeira e erraria a
 * segunda, e aí o painel de modalidade discordaria do painel de área sobre o
 * tamanho da mesma empresa.
 */
const QUADRO_DEZEMBRO_AREA_MODALIDADE = repartirMatriz(
  PERFIL_POR_AREA.map((p) => p.headcount),
  MODALIDADES_ARMAZENADAS.map(
    (m) => HEADCOUNT_POR_MODALIDADE.find((x) => x.codigo === m)?.headcount ?? 0,
  ),
);

/** Headcount de dezembro por célula, dividindo cada par pela fatia da entidade. */
const QUADRO_DEZEMBRO: readonly number[] = (() => {
  const saida = CELULAS.map(() => 0);
  AREAS_ARMAZENADAS.forEach((area, i) => {
    MODALIDADES_ARMAZENADAS.forEach((modalidade, j) => {
      const total = QUADRO_DEZEMBRO_AREA_MODALIDADE[i]?.[j] ?? 0;
      const primeira = ENTIDADES_ARMAZENADAS[0] ?? "";
      const naPrimeira = Math.round(
        total * fatiaDaEntidade(primeira, "headcount"),
      );
      for (const entidade of ENTIDADES_ARMAZENADAS) {
        const k = indiceDaCelula({ entidade, area, modalidade });
        // Dividir em duas e dar o resto à segunda mantém a soma do par exata,
        // e com ela as duas margens acima.
        saida[k] = entidade === primeira ? naPrimeira : total - naPrimeira;
      }
    });
  });
  return saida;
})();

/* ------------------------------------------------------------------ *
 * O fluxo: admissões e desligamentos por célula e por mês
 * ------------------------------------------------------------------ */

/**
 * O quadro de um par área × modalidade, **sem** entidade.
 *
 * É a base de todo peso, e é o detalhe que um teste pegou. Partir de
 * `QUADRO_DEZEMBRO`, que já traz a divisão 62/38 do quadro embutida, e depois
 * multiplicar pela fatia da medida aplica **duas** inclinações de entidade em
 * cima da outra: a folha saía com 78% em SP em vez dos 68% declarados, e a
 * admissão com 75% em vez de 58%. Errado de um jeito difícil de ver, porque as
 * somas continuavam fechando — só a repartição interna estava torta.
 */
function quadroDoPar(area: string, modalidade: string): number {
  const i = AREAS_ARMAZENADAS.indexOf(area);
  const j = MODALIDADES_ARMAZENADAS.indexOf(modalidade);
  return QUADRO_DEZEMBRO_AREA_MODALIDADE[i]?.[j] ?? 0;
}

/** Pesos de admissão: o quadro do par, inclinado pela fatia de entidade. */
const PESO_DE_ADMISSAO = CELULAS.map(
  (c) =>
    quadroDoPar(c.area, c.modalidade) *
    fatiaDaEntidade(c.entidade, "admissoes"),
);

/**
 * Pesos de desligamento.
 *
 * O `tov` por área do protótipo entra **como peso**, não como taxa. Ver o
 * cabeçalho de `referencia-rh.ts`: os 18,4% do Anexo C não são deriváveis dos
 * 145 desligamentos, então o nível vem do fluxo e a **forma** vem daqui. O
 * ranking entre áreas no painel `tov-area` continua o do protótipo.
 */
const PESO_DE_DESLIGAMENTO = CELULAS.map(
  (c) =>
    quadroDoPar(c.area, c.modalidade) *
    perfilDe(c.area).pesoDeDesligamento *
    fatiaDaEntidade(c.entidade, "desligamentos"),
);

/**
 * Reparte um total anual por mês **e** por célula, com as duas margens exatas.
 *
 * Repartir mês a mês, cada um por conta própria, parecia equivalente e não é.
 * São 241 admissões espalhadas por 42 células em 12 meses: quase toda célula
 * recebe zero, e a sobra de cada mês vai, pelo desempate de índice, sempre para
 * as primeiras da lista — que são as de uma entidade só. O efeito medido foi a
 * Unidade SP ficar com 60,2% das admissões onde a fatia declarada é 58%, e com
 * 72,4% dos desligamentos onde é 66%.
 *
 * Um viés que vem da **ordem do vetor** é o pior tipo, porque não aparece em
 * nenhuma soma: os totais fecham, e só a repartição interna está torta. Com as
 * duas margens fixas o mês continua exato e a célula recebe o seu anual.
 */
function porMesECelula(
  totalPorMes: readonly number[],
  pesoPorCelula: readonly number[],
  /**
   * A inclinação de cada célula ao longo dos meses (T-140.2).
   *
   * Ausente, a repartição é a proporcional de sempre: a fatia de cada célula é
   * a mesma nos doze meses. É o que basta para medida cujo perfil não muda ao
   * longo do ano — admissão e desligamento já variam sozinhos, porque são
   * contagens pequenas repartidas mês a mês.
   *
   * Presente, o interior segue a curva **sem** mexer nas margens: o total do
   * mês e o total da célula no ano continuam exatos.
   */
  inclinacao?: (mes: number, celula: Celula) => number,
): readonly (readonly number[])[] {
  const total = totalPorMes.reduce((a, b) => a + b, 0);
  const colunas = repartir(total, pesoPorCelula);
  if (inclinacao === undefined) return repartirMatriz(totalPorMes, colunas);

  const perfil = totalPorMes.map((_t, m) =>
    CELULAS.map((celula, c) => (pesoPorCelula[c] ?? 0) * inclinacao(m, celula)),
  );
  return repartirMatrizComPerfil(totalPorMes, colunas, perfil);
}

/**
 * A inclinação da admissão: só a modalidade (T-140.2).
 *
 * É o que faz a composição do quadro andar ao longo do ano. Entidade e área
 * ficam de fora porque a contratação delas já varia sozinha — são contagens de
 * uma a duas dezenas por mês, e a repartição inteira delas oscila por conta
 * própria. A modalidade não oscilava: era a mesma fatia nos doze meses.
 */
function inclinacaoDaAdmissao(mes: number, celula: Celula): number {
  return noMes(ADMISSAO_POR_MODALIDADE, celula.modalidade, mes);
}

/**
 * A inclinação da folha: entidade, área e modalidade compostas (T-140.2).
 *
 * As três se multiplicam porque as três agem ao mesmo tempo sobre a mesma
 * célula — o décimo terceiro concentra na Unidade SP, a revisão de julho
 * concentra em Tecnologia, e o remoto cresce o ano inteiro. Uma célula de
 * Tecnologia remota em SP carrega as três.
 */
function inclinacaoDaFolha(mes: number, celula: Celula): number {
  return (
    noMes(FOLHA_POR_ENTIDADE, celula.entidade, mes) *
    noMes(FOLHA_POR_AREA, celula.area, mes) *
    noMes(FOLHA_POR_MODALIDADE, celula.modalidade, mes)
  );
}

const ADMISSOES = porMesECelula(
  ADMISSOES_MENSAL,
  PESO_DE_ADMISSAO,
  inclinacaoDaAdmissao,
);
const DESLIGAMENTOS = porMesECelula(DESLIGAMENTOS_MENSAL, PESO_DE_DESLIGAMENTO);

/**
 * O saldo de abertura de cada célula, derivado de trás para frente.
 *
 * `abertura = quadro de dezembro - (admissões do ano - desligamentos do ano)`.
 * É o que faz dezembro reproduzir a foto aprovada e a identidade contábil valer
 * em todos os meses. A soma dá 1.144, que é o número que o Anexo C escreve como
 * 1.150 — ver a divergência 1 em `referencia-rh.ts`.
 */
const SALDO_DE_ABERTURA_POR_CELULA = CELULAS.map((_, k) => {
  const liquido = MESES.reduce(
    (acc, _mes, m) =>
      acc + (ADMISSOES[m]?.[k] ?? 0) - (DESLIGAMENTOS[m]?.[k] ?? 0),
    0,
  );
  return (QUADRO_DEZEMBRO[k] ?? 0) - liquido;
});

/** Headcount por célula e mês: o saldo de abertura mais o fluxo acumulado. */
const HEADCOUNT: readonly (readonly number[])[] = (() => {
  const saida: number[][] = [];
  const corrente = [...SALDO_DE_ABERTURA_POR_CELULA];
  for (let m = 0; m < MESES.length; m += 1) {
    for (let k = 0; k < CELULAS.length; k += 1) {
      corrente[k] =
        (corrente[k] ?? 0) +
        (ADMISSOES[m]?.[k] ?? 0) -
        (DESLIGAMENTOS[m]?.[k] ?? 0);
    }
    saida.push([...corrente]);
  }
  return saida;
})();

/* ------------------------------------------------------------------ *
 * Folha, clima e absenteísmo
 * ------------------------------------------------------------------ */

/**
 * O custo por cabeça da modalidade, normalizado dentro da área (T-140.3).
 *
 * A média ponderada pelo quadro da área é 1 por construção, e isso e não outra
 * coisa é o que mantém os invariantes: a folha anual de cada área continua a
 * declarada em `PERFIL_POR_AREA`, e a fatia de entidade continua 0,68, porque o
 * fator multiplica igual as três modalidades de uma mesma entidade.
 *
 * Sem a normalização, dar 1,22 ao remoto inflaria a folha da área inteira — e o
 * painel de folha por área passaria a discordar do número aprovado, por um
 * motivo que ninguém pediu.
 */
function custoRelativoNaArea(area: string, modalidade: string): number {
  const custo = (m: string) => CUSTO_POR_CABECA_DA_MODALIDADE[m] ?? 0;
  const quadro = MODALIDADES_ARMAZENADAS.reduce(
    (a, m) => a + quadroDoPar(area, m),
    0,
  );
  const ponderado = MODALIDADES_ARMAZENADAS.reduce(
    (a, m) => a + quadroDoPar(area, m) * custo(m),
    0,
  );
  if (ponderado === 0) return 1;
  return (custo(modalidade) * quadro) / ponderado;
}

/**
 * Pesos de folha — deliberadamente diferentes dos de quadro.
 *
 * Tecnologia tem 13,5% do quadro e 22% da folha. Um adaptador que multiplique
 * tudo por um fator só acerta o quadro e erra a folha, que é o controle
 * negativo que T-140 vai exigir e que o achado 3 do Anexo D descreve.
 *
 * A área entra pela folha dela; a modalidade, pela fração do quadro daquela
 * área; a entidade, pela fatia da folha. Multiplicar pelo quadro **absoluto**
 * em vez da fração faria a área pesar `folha × quadro`, e aí Operações — grande
 * e barata — passaria à frente de Tecnologia — pequena e cara. Foi o que o
 * teste de custo por FTE pegou.
 */
const PESO_DE_FOLHA = CELULAS.map(
  (c) =>
    perfilDe(c.area).folhaReais *
    (quadroDoPar(c.area, c.modalidade) / perfilDe(c.area).headcount) *
    custoRelativoNaArea(c.area, c.modalidade) *
    fatiaDaEntidade(c.entidade, "folha"),
);

/**
 * A folha, repartida nas quatro parcelas que a compoem (T-143).
 *
 * Salarios, encargos, beneficios e variavel somam a folha do mes -- e a folha
 * do mes deixa de ser uma coluna propria para ser a soma das quatro. Sem isso o
 * KPI "Encargos 37,5%" nao teria numerador nem denominador: ele e
 * `encargos / salarios`, e nao `encargos / folha`, que daria 22,6%.
 */
const UM_MILHAO = 1_000_000;

/**
 * A repartição mes x parcela, com as duas margens exatas.
 *
 * Repartir cada mes por conta propria fecha o mes e deixa o ANO derivar: os
 * salarios sairam com R$ 111.999.997 contra os R$ 112 mi do prototipo, tres
 * reais a menos. Some numa tela que arredonda para milhoes, e aparece no dia em
 * que alguem exportar o CSV.
 */
const FOLHA_MES_POR_PARCELA = repartirMatriz(
  FOLHA_MENSAL_REAIS,
  COMPOSICAO_DA_FOLHA.map((c) => c.milhoes * UM_MILHAO),
);

const COMPONENTES_DA_FOLHA = COMPOSICAO_DA_FOLHA.map((_, k) =>
  porMesECelula(
    MESES.map((_mes, m) => FOLHA_MES_POR_PARCELA[m]?.[k] ?? 0),
    PESO_DE_FOLHA,
    inclinacaoDaFolha,
  ),
);

/** A folha de cada celula: a soma das quatro parcelas, nunca uma quinta coluna. */
const FOLHA = MESES.map((_mes, m) =>
  CELULAS.map((_c, k) =>
    COMPONENTES_DA_FOLHA.reduce((t, comp) => t + (comp[m]?.[k] ?? 0), 0),
  ),
);

/** Respondentes da pesquisa de clima, por célula e mês. */
const RESPONDENTES = MESES.map((_, m) => {
  const total = Math.round((HEADCOUNT_MENSAL[m] ?? 0) * COBERTURA_DA_PESQUISA);
  return repartir(total, HEADCOUNT[m] ?? []);
});

function totalDoMes(matriz: readonly (readonly number[])[], m: number): number {
  return (matriz[m] ?? []).reduce((a, b) => a + b, 0);
}

/** Promotores, neutros e detratores por célula e mês. */
const CLIMA = MESES.map((_, m) => {
  const respondentes = totalDoMes(RESPONDENTES, m);
  const pesos = RESPONDENTES[m] ?? [];
  const detratoresTotal = Math.round(
    ((DETRATORES_PCT_MENSAL[m] ?? 0) / CEM_PORCENTO) * respondentes,
  );
  const promotoresTotal =
    detratoresTotal +
    Math.round(((ENPS_MENSAL[m] ?? 0) / CEM_PORCENTO) * respondentes);
  const promotores = repartir(promotoresTotal, pesos);
  const detratores = repartir(detratoresTotal, pesos);
  const neutros = pesos.map(
    (r, k) => r - (promotores[k] ?? 0) - (detratores[k] ?? 0),
  );
  return { promotores, neutros, detratores };
});

/**
 * Pontos de engajamento somados, por célula e mês.
 *
 * A média é `pontos / respondentes`. Guardar a soma e não a média é o que
 * permite recalcular a média de qualquer recorte — de uma área, de um trimestre
 * ou dos dois juntos — em vez de tirar média de médias, que dá outro número.
 */
const ENGAJAMENTO = MESES.map((_, m) => {
  const respondentes = totalDoMes(RESPONDENTES, m);
  const pesos = (RESPONDENTES[m] ?? []).map(
    (r, k) => r * perfilDe(CELULAS[k]?.area ?? "").engajamento,
  );
  return repartir((ENGAJAMENTO_MENSAL[m] ?? 0) * respondentes, pesos);
});

/** Horas previstas e horas ausentes, por célula e mês. */
const HORAS_PREVISTAS = MESES.map((_, m) =>
  (HEADCOUNT[m] ?? []).map((hc) => hc * HORAS_PREVISTAS_POR_FTE),
);
const HORAS_AUSENTES = MESES.map((_, m) => {
  const previstas = (HORAS_PREVISTAS[m] ?? []).reduce((a, b) => a + b, 0);
  const ausentes = Math.round(
    ((ABSENTEISMO_MENSAL[m] ?? 0) / CEM_PORCENTO) * previstas,
  );
  return repartir(ausentes, HORAS_PREVISTAS[m] ?? []);
});

/* ------------------------------------------------------------------ *
 * As médias que viram soma (T-143)
 * ------------------------------------------------------------------ */

/**
 * O quanto a idade e o tempo de casa de uma área se afastam da média.
 *
 * **Derivado do turnover, não inventado.** Área que perde gente rápido tem
 * quadro mais novo e mais recente — é a mesma relação que o dataset já conta em
 * `pesoDeDesligamento`. Sem essa variação, "Idade média" continuaria dando 34,2
 * em todo recorte, que é exatamente o defeito do achado 5 que esta tarefa
 * existe para tirar.
 *
 * O tempo de casa varia mais que a idade: rotatividade zera tempo de casa e
 * não zera idade.
 */
const TURNOVER_TIPICO = 16.5;
const SENSIBILIDADE_DA_IDADE = 100;
const SENSIBILIDADE_DO_TEMPO = 50;

function fatorDaArea(area: string, sensibilidade: number): number {
  return (
    1 - (perfilDe(area).pesoDeDesligamento - TURNOVER_TIPICO) / sensibilidade
  );
}

/**
 * E a mesma inclinação por entidade.
 *
 * A Unidade SP é a operação mais nova: contrata mais rápido, e por isso tem
 * quadro um pouco mais jovem e com menos tempo de casa. Sem esta segunda
 * inclinação, "Idade média" dava o mesmo número em SP e nas demais — e um KPI
 * que ignora uma das cinco dimensões do recorte é o achado 5 pela metade.
 *
 * Foi um teste de invariantes que apontou, e não a leitura do código.
 */
const DIFERENCA_ENTRE_ENTIDADES = 0.04;

function fatorDaEntidade(entidade: string, sensibilidade: number): number {
  const maisNova = entidade === ENTIDADES_ARMAZENADAS[0];
  const efeito =
    (DIFERENCA_ENTRE_ENTIDADES * SENSIBILIDADE_DO_TEMPO) / sensibilidade;
  return maisNova ? 1 - efeito : 1 + efeito;
}

/** Reparte um total mensal pelas células, pesando por quadro e por área. */
function somaDeAtributo(media: number, sensibilidade: number) {
  const pesos = CELULAS.map(
    (c, k) =>
      (QUADRO_DEZEMBRO[k] ?? 0) *
      fatorDaArea(c.area, sensibilidade) *
      fatorDaEntidade(c.entidade, sensibilidade),
  );
  return MESES.map((_mes, m) => {
    const quadro = (HEADCOUNT[m] ?? []).reduce((a, b) => a + b, 0);
    // Pesos por célula, mas ponderados pelo quadro **daquele mês**, para que a
    // média de cada área acompanhe o quadro que ela tem no mês.
    const pesosDoMes = pesos.map(
      (p, k) =>
        p * ((HEADCOUNT[m]?.[k] ?? 0) / Math.max(1, QUADRO_DEZEMBRO[k] ?? 1)),
    );
    return repartir(Math.round(media * quadro), pesosDoMes);
  });
}

const SOMA_DE_IDADE = somaDeAtributo(IDADE_MEDIA, SENSIBILIDADE_DA_IDADE);
const SOMA_DE_TEMPO_DE_CASA = somaDeAtributo(
  TEMPO_MEDIO_DE_CASA,
  SENSIBILIDADE_DO_TEMPO,
);

/**
 * Tempo de casa de quem saiu. Denominador: os desligamentos, não o quadro.
 *
 * É a diferença que o registro de KPIs já anotava: `tov-corte` mede taxa por
 * gênero e faixa etária, em percentual; este KPI mede anos. Trocar o
 * denominador daria um número plausível e errado.
 */
const SOMA_DE_TEMPO_ATE_A_SAIDA = MESES.map((_mes, m) => {
  const saidas = (DESLIGAMENTOS[m] ?? []).reduce((a, b) => a + b, 0);
  return repartir(
    Math.round(TEMPO_MEDIO_ATE_A_SAIDA * saidas),
    DESLIGAMENTOS[m] ?? [],
  );
});

/**
 * O custo do turnover, em duas parcelas (T-115).
 *
 * `custoDeReposicao` e ramp-up mais produtividade perdida; `custoDeDesligamento`
 * e rescisao mais o recrutamento de reposicao. A soma das duas e o custo total,
 * e o painel `tov-custo` quebra as quatro.
 *
 * Repartido pelos **desligamentos**, ponderado pela folha por FTE da area:
 * perder uma pessoa cara custa mais que perder uma barata. Sem essa segunda
 * ponderacao o custo seria um multiplo fixo dos desligamentos, e o KPI
 * responderia ao recorte pelo motivo errado.
 */
const PESO_DE_CUSTO_DE_SAIDA = CELULAS.map(
  (c, k) =>
    (QUADRO_DEZEMBRO[k] ?? 0) *
    perfilDe(c.area).pesoDeDesligamento *
    (perfilDe(c.area).folhaReais / Math.max(1, perfilDe(c.area).headcount)),
);

function custoDeSaida(ehReposicao: boolean) {
  const total = CUSTO_DO_TURNOVER.filter(
    (p) => p.ehReposicao === ehReposicao,
  ).reduce((a, p) => a + p.milhoes, 0);
  return porMesECelula(
    repartir(Math.round(total * UM_MILHAO), DESLIGAMENTOS_MENSAL),
    PESO_DE_CUSTO_DE_SAIDA,
  );
}

/**
 * Participantes de treinamento por célula e mês.
 *
 * Fração do quadro daquele mês, pela série de participação do protótipo. Sai do
 * quadro e não das horas: uma trilha longa não faz mais gente participar.
 */
const PARTICIPANTES = MESES.map((_mes, m) =>
  (HEADCOUNT[m] ?? []).map((quadro) =>
    Math.round((quadro * (PARTICIPACAO_TREINAMENTO_MENSAL[m] ?? 0)) / 100),
  ),
);

const CUSTO_DE_REPOSICAO = custoDeSaida(true);
const CUSTO_DE_DESLIGAMENTO = custoDeSaida(false);

/* ------------------------------------------------------------------ *
 * vw_fato_rh_mes
 * ------------------------------------------------------------------ */

export type LinhaRhMes = {
  readonly mes: string;
  readonly entidade: string;
  readonly area: string;
  readonly modalidade: string;
  /** Estoque no fechamento do mês. Agrega por `last` no tempo. */
  readonly headcountFte: number;
  readonly admissoes: number;
  readonly desligamentos: number;
  /** Em reais. A soma das quatro parcelas abaixo, nunca uma coluna à parte. */
  readonly folhaReais: number;
  readonly salarios: number;
  readonly encargos: number;
  readonly beneficios: number;
  readonly variavel: number;
  /**
   * Quem pode responder à pesquisa de clima. Denominador de "Cobertura".
   *
   * Na fixture coincide com o quadro, porque ninguém está marcado como
   * inelegível. A coluna existe assim mesmo, e é o ponto: a fórmula nomeia
   * `elegiveis`, e no dia em que o dado real distinguir os dois — afastados,
   * admitidos há menos de 90 dias — nada na fórmula muda.
   */
  readonly elegiveis: number;
  /** Soma das idades. A média é `somaDeIdade / headcountFte`. */
  readonly somaDeIdade: number;
  /** Soma dos tempos de casa, em anos. */
  readonly somaDeTempoDeCasa: number;
  /** Soma do tempo de casa **de quem saiu**. Denominador: `desligamentos`. */
  readonly somaDeTempoAteASaida: number;
  /**
   * Quantas pessoas do quadro iniciaram ao menos uma trilha no mês.
   *
   * Mora aqui, e não em `vw_fato_treinamento`, porque é atributo do **quadro**.
   * Na view de treinamento a mesma pessoa apareceria uma vez por trilha e uma
   * vez por modalidade, e somar daria mais gente treinando do que gente — a
   * participação passava de 100%, medida em 108,9%.
   *
   * Continua sendo estoque no tempo: quem treinou em janeiro e em março é uma
   * pessoa, não duas. Por isso a participação se lê no último mês da janela.
   */
  readonly participantesDeTreinamento: number;
  /** Ramp-up e produtividade perdida, em reais. */
  readonly custoDeReposicao: number;
  /** Rescisão e recrutamento de reposição, em reais. */
  readonly custoDeDesligamento: number;
  /** Denominador do absenteísmo. */
  readonly horasPrevistas: number;
  /** Numerador do absenteísmo. */
  readonly horasAusentes: number;
  /** Denominador do eNPS e do engajamento. */
  readonly respondentes: number;
  readonly promotores: number;
  readonly neutros: number;
  readonly detratores: number;
  /** Soma dos pontos. A média é `pontosDeEngajamento / respondentes`. */
  readonly pontosDeEngajamento: number;
};

export const VW_FATO_RH_MES: readonly LinhaRhMes[] = MESES.flatMap((mes, m) =>
  CELULAS.map((c, k) => ({
    mes,
    entidade: c.entidade,
    area: c.area,
    modalidade: c.modalidade,
    headcountFte: HEADCOUNT[m]?.[k] ?? 0,
    admissoes: ADMISSOES[m]?.[k] ?? 0,
    desligamentos: DESLIGAMENTOS[m]?.[k] ?? 0,
    folhaReais: FOLHA[m]?.[k] ?? 0,
    salarios: COMPONENTES_DA_FOLHA[0]?.[m]?.[k] ?? 0,
    encargos: COMPONENTES_DA_FOLHA[1]?.[m]?.[k] ?? 0,
    beneficios: COMPONENTES_DA_FOLHA[2]?.[m]?.[k] ?? 0,
    variavel: COMPONENTES_DA_FOLHA[3]?.[m]?.[k] ?? 0,
    elegiveis: HEADCOUNT[m]?.[k] ?? 0,
    somaDeIdade: SOMA_DE_IDADE[m]?.[k] ?? 0,
    somaDeTempoDeCasa: SOMA_DE_TEMPO_DE_CASA[m]?.[k] ?? 0,
    somaDeTempoAteASaida: SOMA_DE_TEMPO_ATE_A_SAIDA[m]?.[k] ?? 0,
    participantesDeTreinamento: PARTICIPANTES[m]?.[k] ?? 0,
    custoDeReposicao: CUSTO_DE_REPOSICAO[m]?.[k] ?? 0,
    custoDeDesligamento: CUSTO_DE_DESLIGAMENTO[m]?.[k] ?? 0,
    horasPrevistas: HORAS_PREVISTAS[m]?.[k] ?? 0,
    horasAusentes: HORAS_AUSENTES[m]?.[k] ?? 0,
    respondentes: RESPONDENTES[m]?.[k] ?? 0,
    promotores: CLIMA[m]?.promotores[k] ?? 0,
    neutros: CLIMA[m]?.neutros[k] ?? 0,
    detratores: CLIMA[m]?.detratores[k] ?? 0,
    pontosDeEngajamento: ENGAJAMENTO[m]?.[k] ?? 0,
  })),
);

/* ------------------------------------------------------------------ *
 * vw_fato_vagas
 * ------------------------------------------------------------------ */

/** Reparte um total anual por mês e por área, com as duas margens exatas. */
function porMesEArea(
  totalPorMes: readonly number[],
  pesoPorArea: readonly number[],
): readonly (readonly number[])[] {
  const total = totalPorMes.reduce((a, b) => a + b, 0);
  return repartirMatriz(totalPorMes, repartir(total, pesoPorArea));
}

const PESO_DE_VAGA = PERFIL_POR_AREA.map((p) => p.vagas[2]);
const FECHADAS_MENSAL = repartir(
  PERFIL_POR_AREA.reduce((a, p) => a + p.vagas[2], 0),
  DIAS_PARA_FECHAR_MENSAL.map(() => 1),
);

const VAGAS_FECHADAS = porMesEArea(FECHADAS_MENSAL, PESO_DE_VAGA);
const VAGAS_ABERTAS = porMesEArea(
  repartir(
    PERFIL_POR_AREA.reduce((a, p) => a + p.vagas[0], 0),
    MESES.map(() => 1),
  ),
  PERFIL_POR_AREA.map((p) => p.vagas[0]),
);
const VAGAS_ANDAMENTO = porMesEArea(
  repartir(
    PERFIL_POR_AREA.reduce((a, p) => a + p.vagas[1], 0),
    MESES.map(() => 1),
  ),
  PERFIL_POR_AREA.map((p) => p.vagas[1]),
);
const VAGAS_CANCELADAS_MATRIZ = porMesEArea(
  repartir(
    VAGAS_CANCELADAS,
    MESES.map(() => 1),
  ),
  PESO_DE_VAGA,
);

/** As cinco etapas do funil, por mês e área, com o volume de cada uma. */
const FUNIL = FUNIL_ANUAL.map((etapa) =>
  porMesEArea(
    repartir(
      etapa.total,
      FECHADAS_MENSAL.map((f) => f),
    ),
    PESO_DE_VAGA,
  ),
);

export type LinhaVagas = {
  readonly mes: string;
  readonly area: string;
  readonly abertas: number;
  readonly emAndamento: number;
  readonly fechadas: number;
  readonly canceladas: number;
  /**
   * Custo de recrutamento do mês, em reais (T-143).
   *
   * O custo por contratação é `custoDeRecrutamento / contratados`. Varia por
   * área porque acompanha o tempo de fechamento: vaga que demora custa mais
   * anúncio, mais hora de entrevista e mais agência. Se fosse um múltiplo fixo
   * das contratações, o KPI daria os mesmos R$ 8,6 mil em todo recorte — que é
   * o defeito do achado 5 outra vez, com uma coluna a mais.
   */
  readonly custoDeRecrutamento: number;
  /**
   * Soma dos dias de todas as vagas fechadas no mês.
   *
   * O tempo médio é `diasSomados / fechadas`. Guardar a média já pronta faria
   * o recorte de uma área tirar média de médias — outro número.
   */
  readonly diasSomados: number;
  readonly candidaturas: number;
  readonly triagem: number;
  readonly entrevistas: number;
  readonly propostas: number;
  readonly contratados: number;
};

/**
 * O custo de recrutamento, com o total do ano exato.
 *
 * Peso: contratações da célula vezes os dias que a área leva para fechar. A
 * soma do ano é `8.600 x 96`, e a repartição por maior resto entrega isso
 * exato — o KPI dá R$ 8,6 mil no consolidado e outro número em Tecnologia.
 */
const CUSTO_DE_RECRUTAMENTO = (() => {
  const contratados = FUNIL[4] ?? [];
  const total = contratados.reduce(
    (t, linha) => t + linha.reduce((a, b) => a + b, 0),
    0,
  );
  const pesos = MESES.flatMap((_mes, m) =>
    AREAS_ARMAZENADAS.map(
      (area, i) => (contratados[m]?.[i] ?? 0) * perfilDe(area).diasParaFechar,
    ),
  );
  return repartir(CUSTO_POR_CONTRATACAO * total, pesos);
})();

export const VW_FATO_VAGAS: readonly LinhaVagas[] = MESES.flatMap((mes, m) =>
  AREAS_ARMAZENADAS.map((area, i) => {
    const fechadas = VAGAS_FECHADAS[m]?.[i] ?? 0;
    return {
      mes,
      area,
      abertas: VAGAS_ABERTAS[m]?.[i] ?? 0,
      emAndamento: VAGAS_ANDAMENTO[m]?.[i] ?? 0,
      fechadas,
      canceladas: VAGAS_CANCELADAS_MATRIZ[m]?.[i] ?? 0,
      custoDeRecrutamento:
        CUSTO_DE_RECRUTAMENTO[m * AREAS_ARMAZENADAS.length + i] ?? 0,
      // O dia médio do mês e o da área se combinam pela média dos dois, o que
      // preserva as duas leituras: o mês tem o perfil do mês, e Tecnologia
      // continua demorando mais que Logística em qualquer mês.
      diasSomados: Math.round(
        fechadas *
          (((DIAS_PARA_FECHAR_MENSAL[m] ?? 0) + perfilDe(area).diasParaFechar) /
            2),
      ),
      candidaturas: FUNIL[0]?.[m]?.[i] ?? 0,
      triagem: FUNIL[1]?.[m]?.[i] ?? 0,
      entrevistas: FUNIL[2]?.[m]?.[i] ?? 0,
      propostas: FUNIL[3]?.[m]?.[i] ?? 0,
      contratados: FUNIL[4]?.[m]?.[i] ?? 0,
    };
  }),
);

/* ------------------------------------------------------------------ *
 * vw_fato_vagas_fonte
 * ------------------------------------------------------------------ */

/**
 * De onde veio quem foi contratado — em tabela própria, e a razão importa.
 *
 * A seção 10.1 lista "fonte do candidato" entre as colunas de `vw_fato_vagas`.
 * Pôr a fonte no mesmo grão obrigaria a escolher entre duas coisas erradas:
 * repetir a contagem de vagas em cada fonte, ou inventar uma fonte para uma
 * vaga que ainda está **aberta** e que por definição não tem candidato
 * contratado. Contagem de vaga e origem de contratação são grãos diferentes.
 */
export type LinhaFonteDeCandidato = {
  readonly mes: string;
  readonly area: string;
  readonly fonte: string;
  readonly contratados: number;
};

export const VW_FATO_VAGAS_FONTE: readonly LinhaFonteDeCandidato[] = (() => {
  const contratadosPorMesArea = FUNIL[4] ?? [];
  return MESES.flatMap((mes, m) =>
    AREAS_ARMAZENADAS.flatMap((area, i) => {
      const total = contratadosPorMesArea[m]?.[i] ?? 0;
      const partes = repartir(
        total,
        FONTES_DE_CANDIDATO.map((f) => f.participacao),
      );
      return FONTES_DE_CANDIDATO.map((f, j) => ({
        mes,
        area,
        fonte: f.codigo,
        contratados: partes[j] ?? 0,
      }));
    }),
  );
})();

/* ------------------------------------------------------------------ *
 * vw_fato_treinamento
 * ------------------------------------------------------------------ */

/**
 * Horas por mês × área, com as duas margens exatas, e depois por modalidade.
 *
 * Três margens precisam fechar: o mês (painel `tre-horas`), a área
 * (`tre-area`) e a modalidade da trilha (`tre-modal`). `repartirMatriz` acerta
 * duas; `ajustarMargemDeColuna` fecha a terceira movendo horas entre
 * modalidades dentro do mesmo par mês-área, o que preserva as duas primeiras.
 */
const HORAS_MES_AREA = repartirMatriz(
  HORAS_TREINAMENTO_MENSAL,
  repartir(
    HORAS_TREINAMENTO_MENSAL.reduce((a, b) => a + b, 0),
    PERFIL_POR_AREA.map((p) => p.horasTreinamento),
  ),
);

const HORAS_POR_MODALIDADE = ajustarMargemDeColuna(
  HORAS_MES_AREA.flatMap((linha) =>
    linha.map((horas) =>
      repartir(
        horas,
        MODALIDADES_DE_TREINAMENTO.map((x) => x.horas),
      ),
    ),
  ),
  MODALIDADES_DE_TREINAMENTO.map((x) => x.horas),
);

export type LinhaTreinamento = {
  readonly mes: string;
  readonly area: string;
  readonly trilha: string;
  /** `online`, `presencial` ou `hibrido` — a modalidade **da trilha**. */
  readonly modalidadeDeTrilha: string;
  readonly horas: number;
  readonly investimentoReais: number;
  readonly trilhasIniciadas: number;
  readonly trilhasConcluidas: number;
  readonly participantes: number;
};

export const VW_FATO_TREINAMENTO: readonly LinhaTreinamento[] = MESES.flatMap(
  (mes, m) =>
    AREAS_ARMAZENADAS.flatMap((area, i) => {
      const porModalidade =
        HORAS_POR_MODALIDADE[m * AREAS_ARMAZENADAS.length + i] ?? [];
      return MODALIDADES_DE_TREINAMENTO.flatMap((modalidade, j) => {
        const horasDaCelula = porModalidade[j] ?? 0;
        const porTrilha = repartir(
          horasDaCelula,
          TRILHAS.map((t) => t.investimentoReais),
        );
        const participacao =
          (PARTICIPACAO_TREINAMENTO_MENSAL[m] ?? 0) / CEM_PORCENTO;
        return TRILHAS.map((trilha, t) => {
          const horas = porTrilha[t] ?? 0;
          const iniciadas = Math.round(horas * participacao);
          return {
            mes,
            area,
            trilha: trilha.codigo,
            modalidadeDeTrilha: modalidade.codigo,
            horas,
            // O investimento acompanha as horas dentro da trilha: a verba é
            // proporcional ao volume, e a trilha é quem tem preço por hora.
            investimentoReais: Math.round(
              horas *
                (trilha.investimentoReais /
                  Math.max(
                    1,
                    TRILHAS.reduce((a, x) => a + x.investimentoReais, 0),
                  )) *
                CEM_PORCENTO,
            ),
            trilhasIniciadas: iniciadas,
            trilhasConcluidas: Math.round(
              (iniciadas * modalidade.conclusao) / CEM_PORCENTO,
            ),
            participantes: iniciadas,
          };
        });
      });
    }),
);
