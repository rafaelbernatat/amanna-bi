/**
 * A forma de cada view no banco, campo a campo (D-DADOS).
 *
 * Para cada view, um mapa `campo → tipo` que o compilador confere contra o
 * tipo `Linha*` correspondente: nem campo a menos, nem a mais. É a mesma
 * disciplina do registro de painéis — a forma vive num lugar só, e é o
 * compilador quem diz quando ela e o tipo divergem.
 *
 * O nome da coluna no banco é o campo em snake_case (`headcountFte` →
 * `headcount_fte`), derivado por função e não escrito duas vezes.
 *
 * ## Por que o tipo de cada campo está escrito
 *
 * O driver devolve `numeric` como texto em alguns caminhos (o PGlite do ensaio
 * é um deles), e o motor espera `number`. Coerção às cegas — `Number(x)` em
 * tudo — transformaria um `'2026-01'` em `NaN` sem ninguém perceber. Com o
 * tipo declarado, o leitor converte o que é número, deixa o que é texto, e
 * recusa nulo onde o tipo não o admite.
 */

import type { Views } from "@/acesso/calculo/base";
import type {
  LinhaBalancoMes,
  LinhaCaixaDiario,
  LinhaContas,
  LinhaDesligamento,
  LinhaDividaMes,
  LinhaDreConta,
  LinhaFaturamentoCliente,
  LinhaFinMes,
  LinhaFonteDeCandidato,
  LinhaNaturezaMes,
  LinhaOrcamento,
  LinhaPerfil,
  LinhaQualidadeMes,
  LinhaRhMes,
  LinhaSaidaCategoria,
  LinhaTreinamento,
  LinhaTurnoverCusto,
  LinhaVagas,
} from "@/acesso/calculo/linhas";

/** O que o leitor faz com a coluna. */
export type TipoDeCampo = "texto" | "numero" | "numero-ou-nulo" | "booleano";

type Forma<T> = { readonly [K in keyof T]-?: TipoDeCampo };

const RH_MES: Forma<LinhaRhMes> = {
  mes: "texto",
  entidade: "texto",
  area: "texto",
  modalidade: "texto",
  headcountFte: "numero",
  admissoes: "numero",
  desligamentos: "numero",
  folhaReais: "numero",
  salarios: "numero",
  encargos: "numero",
  beneficios: "numero",
  variavel: "numero",
  elegiveis: "numero",
  somaDeIdade: "numero",
  somaDeTempoDeCasa: "numero",
  somaDeTempoAteASaida: "numero",
  participantesDeTreinamento: "numero",
  custoDeReposicao: "numero-ou-nulo",
  custoDeDesligamento: "numero-ou-nulo",
  horasPrevistas: "numero",
  horasAusentes: "numero",
  respondentes: "numero",
  promotores: "numero",
  neutros: "numero",
  detratores: "numero",
  pontosDeEngajamento: "numero",
};

const RH_PERFIL: Forma<LinhaPerfil> = {
  mes: "texto",
  entidade: "texto",
  area: "texto",
  modalidade: "texto",
  dimensao: "texto",
  valor: "texto",
  headcountFte: "numero",
};

const VAGAS: Forma<LinhaVagas> = {
  mes: "texto",
  area: "texto",
  abertas: "numero",
  emAndamento: "numero",
  fechadas: "numero",
  canceladas: "numero",
  custoDeRecrutamento: "numero",
  diasSomados: "numero",
  candidaturas: "numero",
  triagem: "numero",
  entrevistas: "numero",
  propostas: "numero",
  contratados: "numero",
};

const VAGAS_FONTE: Forma<LinhaFonteDeCandidato> = {
  mes: "texto",
  area: "texto",
  fonte: "texto",
  contratados: "numero",
};

const TREINAMENTO: Forma<LinhaTreinamento> = {
  mes: "texto",
  area: "texto",
  trilha: "texto",
  modalidadeDeTrilha: "texto",
  horas: "numero",
  investimentoReais: "numero",
  trilhasIniciadas: "numero",
  trilhasConcluidas: "numero",
  participantes: "numero",
};

const FIN_MES: Forma<LinhaFinMes> = {
  mes: "texto",
  entidade: "texto",
  receitaBruta: "numero",
  deducoes: "numero",
  receitaLiquida: "numero",
  cmv: "numero",
  despesasOperacionais: "numero",
  depreciacaoEAmortizacao: "numero",
  resultadoFinanceiro: "numero",
  naoOperacional: "numero",
  fco: "numero",
  capex: "numero",
  financiamento: "numero",
  entradasDeCaixa: "numero",
  saidasDeCaixa: "numero",
  estoque: "numero-ou-nulo",
  receitaLiquidaAnoAnterior: "numero-ou-nulo",
  notasEmitidas: "numero",
  saldoDeCaixa: "numero",
};

const CAIXA_DIARIO: Forma<LinhaCaixaDiario> = {
  dia: "texto",
  mes: "texto",
  entidade: "texto",
  entradas: "numero",
  saidas: "numero",
};

const ORCAMENTO: Forma<LinhaOrcamento> = {
  mes: "texto",
  entidade: "texto",
  centroDeCusto: "texto",
  orcado: "numero",
  realizado: "numero",
};

const CONTAS: Forma<LinhaContas> = {
  mes: "texto",
  entidade: "texto",
  faixaDeAging: "texto",
  contraparte: "texto",
  aReceber: "numero",
  aPagar: "numero",
};

const FATURAMENTO_CLIENTE: Forma<LinhaFaturamentoCliente> = {
  mes: "texto",
  entidade: "texto",
  cliente: "texto",
  rating: "texto",
  segmento: "texto",
  principal: "booleano",
  receita: "numero",
  margemBase: "numero",
};

const TURNOVER_CUSTO: Forma<LinhaTurnoverCusto> = {
  mes: "texto",
  entidade: "texto",
  area: "texto",
  componente: "texto",
  valor: "numero-ou-nulo",
};

const RH_DESLIGAMENTO: Forma<LinhaDesligamento> = {
  mes: "texto",
  entidade: "texto",
  area: "texto",
  modalidade: "texto",
  dimensao: "texto",
  valor: "texto",
  desligamentos: "numero",
};

const SAIDA_CATEGORIA: Forma<LinhaSaidaCategoria> = {
  mes: "texto",
  entidade: "texto",
  categoria: "texto",
  valor: "numero",
};

const BALANCO_MES: Forma<LinhaBalancoMes> = {
  mes: "texto",
  entidade: "texto",
  patrimonioLiquido: "numero-ou-nulo",
  ativoTotal: "numero-ou-nulo",
  ativoCirculante: "numero-ou-nulo",
  passivoCirculante: "numero-ou-nulo",
  imobilizado: "numero-ou-nulo",
  aplicacoesFinanceiras: "numero-ou-nulo",
  dividaCurtoPrazo: "numero-ou-nulo",
  dividaLongoPrazo: "numero-ou-nulo",
  estoqueSemGiro: "numero-ou-nulo",
  aReceberVencido: "numero-ou-nulo",
  aPagarVencido: "numero-ou-nulo",
  mutuoComSocios: "numero-ou-nulo",
  jurosPagos: "numero-ou-nulo",
  impostosSobreLucro: "numero-ou-nulo",
  amortizacaoDeDivida: "numero-ou-nulo",
  captacao: "numero-ou-nulo",
  distribuicaoASocios: "numero-ou-nulo",
};

const DIVIDA_MES: Forma<LinhaDividaMes> = {
  mes: "texto",
  entidade: "texto",
  linha: "texto",
  prazo: "texto",
  saldo: "numero-ou-nulo",
  jurosPagos: "numero-ou-nulo",
};

const NATUREZA_MES: Forma<LinhaNaturezaMes> = {
  mes: "texto",
  entidade: "texto",
  custosVariaveis: "numero-ou-nulo",
  custosFixos: "numero-ou-nulo",
};

const QUALIDADE_MES: Forma<LinhaQualidadeMes> = {
  mes: "texto",
  entidade: "texto",
  lancamentos: "numero",
  lancamentosForaDoPadrao: "numero",
  lancamentosEmContaParada: "numero",
  paresDeEstorno: "numero",
  lancamentosDeCompetenciaAnterior: "numero",
  lancamentosDuplicados: "numero",
  contasRecorrentesSemLancamento: "numero",
  contasComClassificacaoInconsistente: "numero",
  valorTotal: "numero",
  valorForaDoPadrao: "numero",
  valorDeEstornos: "numero",
  valorDeCompetenciaAnterior: "numero",
  valorDuplicado: "numero",
  valorSemCentroDeCusto: "numero",
  valorEmContaGenerica: "numero-ou-nulo",
  valorSemNatureza: "numero",
  valorEmClassificacaoInconsistente: "numero",
  movimentacaoComPartesRelacionadas: "numero",
};

const DRE_CONTA: Forma<LinhaDreConta> = {
  mes: "texto",
  entidade: "texto",
  area: "texto",
  centroDeCusto: "texto",
  conta: "texto",
  contaDescricao: "texto",
  linhaDre: "texto",
  valor: "numero",
};

/** A forma de cada view, pelo nome que o motor usa. */
export const FORMA_DAS_VIEWS: {
  readonly [N in keyof Views]: Forma<Views[N][number]>;
} = {
  vw_fato_rh_mes: RH_MES,
  vw_fato_rh_perfil: RH_PERFIL,
  vw_fato_vagas: VAGAS,
  vw_fato_vagas_fonte: VAGAS_FONTE,
  vw_fato_treinamento: TREINAMENTO,
  vw_fato_fin_mes: FIN_MES,
  vw_fato_caixa_diario: CAIXA_DIARIO,
  vw_fato_orcamento: ORCAMENTO,
  vw_fato_contas: CONTAS,
  vw_fato_faturamento_cliente: FATURAMENTO_CLIENTE,
  vw_fato_turnover_custo: TURNOVER_CUSTO,
  vw_fato_rh_desligamento: RH_DESLIGAMENTO,
  vw_fato_saida_categoria: SAIDA_CATEGORIA,
  vw_fato_balanco_mes: BALANCO_MES,
  vw_fato_divida_mes: DIVIDA_MES,
  vw_fato_natureza_mes: NATUREZA_MES,
  vw_fato_qualidade_mes: QUALIDADE_MES,
  vw_fato_dre_conta_mes: DRE_CONTA,
};

/** `headcountFte` → `headcount_fte`. A única convenção entre campo e coluna. */
export function colunaDe(campo: string): string {
  return campo.replace(/[A-Z]/g, (letra) => `_${letra.toLowerCase()}`);
}
