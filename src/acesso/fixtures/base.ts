/**
 * A `Base` das fixtures: as views sintéticas e os cadastros de referência,
 * na forma que o motor de cálculo recebe (D-DADOS).
 *
 * É um dos dois produtores de `Base`; o outro é `src/acesso/warehouse/`, que
 * monta a mesma forma a partir do Postgres. Nada aqui calcula — as constantes
 * já existiam; este módulo só as põe no lugar onde o motor as procura.
 *
 * ## Os cadastros deixam de ser importados pelo motor
 *
 * Centros de custo, faixas, naturezas e contrapartes nomeadas eram constantes
 * que o painel importava direto. Com dado real elas vêm do banco (31 centros
 * de custo, dez segmentos), então o painel não pode carregá-las escritas: a
 * lista é dado. Aqui a lista é a mesma de antes, só que entregue.
 */

import type { Base, Cadastros, ItemDeCadastro } from "@/acesso/calculo/base";
import type { NomeDeQuebra } from "@/acesso/calculo/linhas";
import { VW_FATO_BALANCO_MES } from "@/acesso/fixtures/balanco";
import { VW_FATO_CAIXA_DIARIO } from "@/acesso/fixtures/caixa-diario";
import {
  CLIENTES_A_RECEBER,
  FORNECEDORES_A_PAGAR,
  NATUREZAS_DE_SAIDA,
} from "@/acesso/fixtures/contraparte";
import { VW_FATO_RH_DESLIGAMENTO } from "@/acesso/fixtures/desligamento";
import {
  VW_DIM_CARGO,
  VW_DIM_FAIXA_SALARIAL,
  VW_DIM_UF,
} from "@/acesso/fixtures/dim";
import { VW_FATO_DIVIDA_MES } from "@/acesso/fixtures/divida";
import {
  VW_FATO_CONTAS,
  VW_FATO_FATURAMENTO_CLIENTE,
  VW_FATO_FIN_MES,
  VW_FATO_ORCAMENTO,
  VW_FATO_SAIDA_CATEGORIA,
} from "@/acesso/fixtures/fin";
import { VW_FATO_NATUREZA_MES } from "@/acesso/fixtures/natureza";
import { VW_FATO_RH_PERFIL } from "@/acesso/fixtures/perfil";
import { VW_FATO_QUALIDADE_MES } from "@/acesso/fixtures/qualidade";
import {
  CENTROS_DE_CUSTO,
  FAIXAS_DE_AGING,
} from "@/acesso/fixtures/referencia-fin";
import {
  CUSTO_DO_TURNOVER,
  FAIXAS_DE_RATING,
  QUEBRAS_DO_QUADRO,
  SEGMENTOS_DE_CLIENTE,
  TOP_CLIENTES,
} from "@/acesso/fixtures/referencia-perfil";
import {
  VW_FATO_RH_MES,
  VW_FATO_TREINAMENTO,
  VW_FATO_VAGAS,
  VW_FATO_VAGAS_FONTE,
} from "@/acesso/fixtures/rh";
import { VW_FATO_TURNOVER_CUSTO } from "@/acesso/fixtures/turnover-custo";

/** Os códigos de uma quebra do quadro, na ordem declarada na referência. */
function codigosDaQuebra(nome: NomeDeQuebra): readonly string[] {
  return QUEBRAS_DO_QUADRO[nome].map((v) => v.codigo);
}

/** Só o que o cadastro precisa: código e rótulo. Sem rótulo, o código serve. */
function item(c: {
  readonly codigo: string;
  readonly rotulo?: string;
}): ItemDeCadastro {
  return { codigo: c.codigo, rotulo: c.rotulo ?? c.codigo };
}

const CADASTROS: Cadastros = {
  centrosDeCusto: CENTROS_DE_CUSTO.map(item),
  faixasDeAging: FAIXAS_DE_AGING.map(item),
  faixasDeRating: FAIXAS_DE_RATING,
  segmentosDeCliente: SEGMENTOS_DE_CLIENTE,
  quebrasDoQuadro: {
    faixa_etaria: codigosDaQuebra("faixa_etaria"),
    tempo_de_casa: codigosDaQuebra("tempo_de_casa"),
    escolaridade: codigosDaQuebra("escolaridade"),
    uf: codigosDaQuebra("uf"),
    faixa_salarial: codigosDaQuebra("faixa_salarial"),
    genero: codigosDaQuebra("genero"),
  },
  // "Demais clientes" e "demais fornecedores" carregam o resto da carteira na
  // fixture e não são nomeados no painel — o painel mostra quem tem nome.
  clientesAReceber: CLIENTES_A_RECEBER.filter(
    (c) => c.codigo !== "outros-clientes",
  ).map(item),
  fornecedoresAPagar: FORNECEDORES_A_PAGAR.filter(
    (c) => c.codigo !== "outros-fornecedores",
  ).map(item),
  naturezasDeSaida: NATUREZAS_DE_SAIDA.map(item),
  topClientes: TOP_CLIENTES.map(item),
  componentesDeReposicao: CUSTO_DO_TURNOVER.filter((c) => c.ehReposicao).map(
    (c) => c.codigo,
  ),
  faixaSalarial: VW_DIM_FAIXA_SALARIAL,
  cargo: VW_DIM_CARGO,
  uf: VW_DIM_UF.map((u) => u.codigo),
};

/** A base inteira das fixtures. Construída uma vez, no import. */
export const BASE_DE_FIXTURES: Base = {
  views: {
    vw_fato_rh_mes: VW_FATO_RH_MES,
    vw_fato_rh_perfil: VW_FATO_RH_PERFIL,
    vw_fato_vagas: VW_FATO_VAGAS,
    vw_fato_vagas_fonte: VW_FATO_VAGAS_FONTE,
    vw_fato_treinamento: VW_FATO_TREINAMENTO,
    vw_fato_fin_mes: VW_FATO_FIN_MES,
    vw_fato_caixa_diario: VW_FATO_CAIXA_DIARIO,
    vw_fato_orcamento: VW_FATO_ORCAMENTO,
    vw_fato_contas: VW_FATO_CONTAS,
    vw_fato_faturamento_cliente: VW_FATO_FATURAMENTO_CLIENTE,
    vw_fato_turnover_custo: VW_FATO_TURNOVER_CUSTO,
    vw_fato_rh_desligamento: VW_FATO_RH_DESLIGAMENTO,
    vw_fato_saida_categoria: VW_FATO_SAIDA_CATEGORIA,
    vw_fato_balanco_mes: VW_FATO_BALANCO_MES,
    vw_fato_divida_mes: VW_FATO_DIVIDA_MES,
    vw_fato_natureza_mes: VW_FATO_NATUREZA_MES,
    vw_fato_qualidade_mes: VW_FATO_QUALIDADE_MES,
    /*
     * O razão por conta não existe na fixture: ela não tem razão. A view
     * nasce vazia, e o ranking por conta responde "esta métrica não abre por
     * conta nesta fonte" — que é honesto. Fabricar lançamentos só para o
     * ranking ter o que mostrar seria inventar dado.
     */
    vw_fato_dre_conta_mes: [],
  },
  cadastros: CADASTROS,
};
