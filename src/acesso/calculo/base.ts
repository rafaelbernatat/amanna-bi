/**
 * A `Base`: tudo que o motor de cálculo lê (D-DADOS).
 *
 * O motor recebia as views por importação direta das fixtures, e isso o
 * acoplava a um produtor só. Agora ele recebe uma `Base` por parâmetro —
 * dentro do `Recorte` que toda função já carrega — e dois produtores a montam:
 * `src/acesso/fixtures/base.ts`, das constantes sintéticas, e
 * `src/acesso/warehouse/`, das views do Postgres. As telas não sabem qual.
 *
 * ## Por que parâmetro, e não um registro global
 *
 * Dois adaptadores convivem no mesmo processo — a suíte de contrato roda as
 * fixtures e o adaptador de mutação lado a lado, e a suíte em modo warehouse
 * instancia o banco sem descarregar as fixtures. Um global preenchido pelo
 * adaptador faria um sobrescrever o outro, e um `AsyncLocalStorage` exigiria
 * `run()` em todo ponto de entrada; o `run()` esquecido leria a base errada
 * **sem erro**. Parâmetro é o único desenho em que ler a base errada não
 * compila.
 *
 * ## Views e cadastros
 *
 * `views` são as 18 views de fato, na forma de `linhas.ts`. `cadastros` são as
 * listas que os painéis enumeram — centros de custo, faixas, naturezas,
 * contrapartes nomeadas — e que na fixture eram constantes de referência.
 * Com dado real elas vêm do banco (31 centros de custo, e não 8), e é por isso
 * que o painel não pode carregá-las escritas: a lista é dado.
 */

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
  NomeDeQuebra,
} from "@/acesso/calculo/linhas";

export type Views = {
  readonly vw_fato_rh_mes: readonly LinhaRhMes[];
  readonly vw_fato_rh_perfil: readonly LinhaPerfil[];
  readonly vw_fato_vagas: readonly LinhaVagas[];
  readonly vw_fato_vagas_fonte: readonly LinhaFonteDeCandidato[];
  readonly vw_fato_treinamento: readonly LinhaTreinamento[];
  readonly vw_fato_fin_mes: readonly LinhaFinMes[];
  readonly vw_fato_caixa_diario: readonly LinhaCaixaDiario[];
  readonly vw_fato_orcamento: readonly LinhaOrcamento[];
  readonly vw_fato_contas: readonly LinhaContas[];
  readonly vw_fato_faturamento_cliente: readonly LinhaFaturamentoCliente[];
  readonly vw_fato_turnover_custo: readonly LinhaTurnoverCusto[];
  readonly vw_fato_rh_desligamento: readonly LinhaDesligamento[];
  readonly vw_fato_saida_categoria: readonly LinhaSaidaCategoria[];
  readonly vw_fato_balanco_mes: readonly LinhaBalancoMes[];
  readonly vw_fato_divida_mes: readonly LinhaDividaMes[];
  readonly vw_fato_natureza_mes: readonly LinhaNaturezaMes[];
  readonly vw_fato_qualidade_mes: readonly LinhaQualidadeMes[];
  /** O razão no grão área × mês, para o ranking por conta (D-CHAT-ferramentas). */
  readonly vw_fato_dre_conta_mes: readonly LinhaDreConta[];
};

export type NomeDeView = keyof Views;

/** Os nomes das views, na ordem do tipo. Serve à conferência de cobertura. */
export const NOMES_DE_VIEW: readonly NomeDeView[] = [
  "vw_fato_rh_mes",
  "vw_fato_rh_perfil",
  "vw_fato_vagas",
  "vw_fato_vagas_fonte",
  "vw_fato_treinamento",
  "vw_fato_fin_mes",
  "vw_fato_caixa_diario",
  "vw_fato_orcamento",
  "vw_fato_contas",
  "vw_fato_faturamento_cliente",
  "vw_fato_turnover_custo",
  "vw_fato_rh_desligamento",
  "vw_fato_saida_categoria",
  "vw_fato_balanco_mes",
  "vw_fato_divida_mes",
  "vw_fato_natureza_mes",
  "vw_fato_qualidade_mes",
  "vw_fato_dre_conta_mes",
];

/** Um item de lista enumerada pelo painel: o código no dado e o rótulo na tela. */
export type ItemDeCadastro = {
  readonly codigo: string;
  readonly rotulo: string;
};

/** Uma faixa: o item mais os limites. `ate: null` é "sem teto". */
export type FaixaDeCadastro = ItemDeCadastro & {
  readonly de: number;
  readonly ate: number | null;
};

export type Cadastros = {
  /** Os centros de custo do orçamento, na ordem de exibição. */
  readonly centrosDeCusto: readonly ItemDeCadastro[];
  /** As faixas de aging, na ordem do vencimento. */
  readonly faixasDeAging: readonly ItemDeCadastro[];
  /** As faixas de rating, da melhor para a pior. */
  readonly faixasDeRating: readonly string[];
  /** Os segmentos de cliente, em código. */
  readonly segmentosDeCliente: readonly string[];
  /** Os valores de cada quebra do quadro, em código e na ordem de exibição. */
  readonly quebrasDoQuadro: Readonly<Record<NomeDeQuebra, readonly string[]>>;
  /** Clientes com saldo a receber vencido, nomeados; sem a linha de "demais". */
  readonly clientesAReceber: readonly ItemDeCadastro[];
  /** Fornecedores com saldo a pagar, nomeados; sem a linha de "demais". */
  readonly fornecedoresAPagar: readonly ItemDeCadastro[];
  /** As naturezas de saída de caixa, na ordem do painel. */
  readonly naturezasDeSaida: readonly ItemDeCadastro[];
  /** Os clientes que a dispersão de margem desenha. */
  readonly topClientes: readonly ItemDeCadastro[];
  /** Os componentes do custo do turnover que contam como reposição. */
  readonly componentesDeReposicao: readonly string[];
  /** As faixas salariais, para a mediana interpolada. */
  readonly faixaSalarial: readonly FaixaDeCadastro[];
  /** A política de cargos: banda de cada um. */
  readonly cargo: readonly FaixaDeCadastro[];
  /** As UFs do cadastro, em código. */
  readonly uf: readonly string[];
};

export type Base = {
  readonly views: Views;
  readonly cadastros: Cadastros;
};
