/**
 * A qualidade do razão, `vw_fato_qualidade_mes` (perguntas de CFO, D5–D8).
 *
 * "Tem lançamento estranho neste mês?", "dá para confiar nesses números?",
 * "está por competência?", "tem movimentação com sócios?" — são perguntas
 * sobre o razão lançamento a lançamento, e o produto não expõe lançamento
 * nenhum: o grão mínimo é área × mês (seção 7.5). O que se expõe são os
 * **agregados** dos testes de exceção que rodariam sobre o razão: quantos
 * lançamentos fugiram do padrão da conta, quanto valem, quanto do movimento
 * está sem centro de custo, quanto passou por conta de sócio. É o que a
 * resposta cita; a lista de lançamentos fica no ERP.
 *
 * Fictício, sob D-H03. As taxas de anomalia variam por mês e por entidade de
 * propósito — uma taxa igual em todo recorte é o achado 5 do Anexo D em forma
 * de qualidade. Quando o banco real chegar, os testes de exceção correm no
 * warehouse e alimentam esta view.
 */

import { ENTIDADES_ARMAZENADAS, mesesDe } from "@/acesso/fixtures/eixos";
import { VW_FATO_FIN_MES } from "@/acesso/fixtures/fin";
import { ANO_DA_FIXTURE } from "@/acesso/fixtures/rh";

const MESES = mesesDe(ANO_DA_FIXTURE);
const POR_MIL = 1000;

/** O valor médio de um lançamento, em reais: dá o volume de lançamentos do mês. */
const VALOR_MEDIO_DO_LANCAMENTO = 45_000;

/** As taxas de exceção, em milésimos, com a variação por mês e entidade. */
const FORA_DO_PADRAO_POR_MIL = 8;
const VALOR_FORA_DO_PADRAO_POR_MIL = 15;
const CONTA_PARADA_POR_MIL = 2;
const ESTORNOS_POR_MIL = 3;
const VALOR_DE_ESTORNOS_POR_MIL = 6;
const COMPETENCIA_ANTERIOR_POR_MIL = 6;
const VALOR_DE_COMPETENCIA_POR_MIL = 9;
const DUPLICADOS_POR_MIL = 1;
const VALOR_DUPLICADO_POR_MIL = 4;
const SEM_CENTRO_DE_CUSTO_POR_MIL = 70;
const EM_CONTA_GENERICA_POR_MIL = 45;
const SEM_NATUREZA_POR_MIL = 120;
const CLASSIFICACAO_INCONSISTENTE_POR_MIL = 25;
const PARTES_RELACIONADAS_POR_MIL = 12;
/** Contas recorrentes que ficaram sem lançamento no mês. */
const CONTAS_RECORRENTES_SEM_LANCAMENTO = 1;
const CONTAS_COM_CLASSIFICACAO_INCONSISTENTE = 3;
/** A variação: o resto da divisão do mês por este número muda a taxa. */
const CICLO_DE_VARIACAO = 4;

export type LinhaQualidadeMes = {
  readonly mes: string;
  readonly entidade: string;
  /** Contagens de lançamentos. */
  readonly lancamentos: number;
  readonly lancamentosForaDoPadrao: number;
  readonly lancamentosEmContaParada: number;
  readonly paresDeEstorno: number;
  readonly lancamentosDeCompetenciaAnterior: number;
  readonly lancamentosDuplicados: number;
  readonly contasRecorrentesSemLancamento: number;
  readonly contasComClassificacaoInconsistente: number;
  /** Valores, em reais. `valorTotal` é o movimento do mês: entradas mais saídas. */
  readonly valorTotal: number;
  readonly valorForaDoPadrao: number;
  readonly valorDeEstornos: number;
  readonly valorDeCompetenciaAnterior: number;
  readonly valorDuplicado: number;
  readonly valorSemCentroDeCusto: number;
  readonly valorEmContaGenerica: number;
  readonly valorSemNatureza: number;
  readonly valorEmClassificacaoInconsistente: number;
  readonly movimentacaoComPartesRelacionadas: number;
};

/** Uma parte de um total, em milésimos, com a variação do mês e da entidade. */
function parte(total: number, porMil: number, variacao: number): number {
  return Math.round((total * (porMil + variacao)) / POR_MIL);
}

export const VW_FATO_QUALIDADE_MES: readonly LinhaQualidadeMes[] =
  MESES.flatMap((mes, m) =>
    ENTIDADES_ARMAZENADAS.flatMap((entidade, e) => {
      const dre = VW_FATO_FIN_MES.find(
        (l) => l.mes === mes && l.entidade === entidade,
      );
      if (dre === undefined) return [];
      const valorTotal = dre.entradasDeCaixa + dre.saidasDeCaixa;
      const lancamentos = Math.round(valorTotal / VALOR_MEDIO_DO_LANCAMENTO);
      const variacao = (m % CICLO_DE_VARIACAO) + e;
      return [
        {
          mes,
          entidade,
          lancamentos,
          lancamentosForaDoPadrao: parte(
            lancamentos,
            FORA_DO_PADRAO_POR_MIL,
            variacao,
          ),
          lancamentosEmContaParada: parte(lancamentos, CONTA_PARADA_POR_MIL, e),
          paresDeEstorno: parte(lancamentos, ESTORNOS_POR_MIL, variacao),
          lancamentosDeCompetenciaAnterior: parte(
            lancamentos,
            COMPETENCIA_ANTERIOR_POR_MIL,
            variacao,
          ),
          lancamentosDuplicados: parte(lancamentos, DUPLICADOS_POR_MIL, e),
          contasRecorrentesSemLancamento:
            CONTAS_RECORRENTES_SEM_LANCAMENTO + (m % CICLO_DE_VARIACAO),
          contasComClassificacaoInconsistente:
            CONTAS_COM_CLASSIFICACAO_INCONSISTENTE + e,
          valorTotal,
          valorForaDoPadrao: parte(
            valorTotal,
            VALOR_FORA_DO_PADRAO_POR_MIL,
            variacao,
          ),
          valorDeEstornos: parte(valorTotal, VALOR_DE_ESTORNOS_POR_MIL, e),
          valorDeCompetenciaAnterior: parte(
            valorTotal,
            VALOR_DE_COMPETENCIA_POR_MIL,
            variacao,
          ),
          valorDuplicado: parte(valorTotal, VALOR_DUPLICADO_POR_MIL, e),
          valorSemCentroDeCusto: parte(
            valorTotal,
            SEM_CENTRO_DE_CUSTO_POR_MIL,
            variacao,
          ),
          valorEmContaGenerica: parte(valorTotal, EM_CONTA_GENERICA_POR_MIL, e),
          valorSemNatureza: parte(valorTotal, SEM_NATUREZA_POR_MIL, variacao),
          valorEmClassificacaoInconsistente: parte(
            valorTotal,
            CLASSIFICACAO_INCONSISTENTE_POR_MIL,
            e,
          ),
          movimentacaoComPartesRelacionadas: parte(
            valorTotal,
            PARTES_RELACIONADAS_POR_MIL,
            variacao,
          ),
        },
      ];
    }),
  );
