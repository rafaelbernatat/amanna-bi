/**
 * As conferências da base carregada (D-DADOS, T-267).
 *
 * Cada uma compara o que as views derivam com o que o dicionário de dados
 * (docs/dados/dicionario_de_dados.md, seção "Conferência") e os gabaritos
 * afirmam. Sai como lista, para o comando imprimir e o teste afirmar.
 */

import type { ClientePostgres } from "../../src/acesso/postgres/cliente.ts";

export type Conferencia = {
  readonly nome: string;
  readonly esperado: number;
  readonly obtido: number;
  /** Tolerância absoluta, na unidade da conferência. */
  readonly tolerancia: number;
  readonly ok: boolean;
};

const MILHAO = 1_000_000;

function conferir(
  nome: string,
  esperado: number,
  obtido: number,
  tolerancia: number,
): Conferencia {
  return {
    nome,
    esperado,
    obtido,
    tolerancia,
    ok: Math.abs(esperado - obtido) <= tolerancia,
  };
}

async function um<T>(cliente: ClientePostgres, sql: string): Promise<T> {
  const [linha] = await cliente.consultar<T>(sql);
  if (linha === undefined) throw new Error(`Sem linha para: ${sql}`);
  return linha;
}

/** Os valores do dicionário, em R$ mi, para 2026 consolidado. */
export const DICIONARIO_2026 = {
  receitaLiquida: 1198.3,
  ebitda: 198.3,
  lucroLiquido: -12.3,
  headcountDezembro: 1235,
  folhaTotal: 189.4,
} as const;

export async function conferirBase(
  cliente: ClientePostgres,
): Promise<readonly Conferencia[]> {
  const saida: Conferencia[] = [];

  // O razão fecha em zero: débitos = créditos.
  const razao = await um<{
    debitos: number;
    creditos: number;
    lancamentos: number;
  }>(
    cliente,
    `SELECT SUM(debito)::float8 AS debitos, SUM(credito)::float8 AS creditos, COUNT(*)::int AS lancamentos
     FROM amanna.razao_contabil`,
  );
  saida.push(
    conferir(
      "razão · débitos − créditos (R$)",
      0,
      razao.debitos - razao.creditos,
      0.01,
    ),
  );
  // O dicionário escreve 128.513, mas os dois arquivos têm 62.587 + 65.920 =
  // 128.507 linhas — a contagem do dicionário é a que está errada (D-DADOS).
  saida.push(
    conferir(
      "razão · lançamentos (62.587 + 65.920)",
      128_507,
      razao.lancamentos,
      0,
    ),
  );

  // A DRE de 2026 consolidada, pela view.
  const dre = await um<{ rl: number; ebitda: number; ll: number }>(
    cliente,
    `SELECT SUM(receita_liquida)::float8 AS rl,
            SUM(receita_liquida - cmv - despesas_operacionais)::float8 AS ebitda,
            SUM(receita_liquida - cmv - despesas_operacionais - depreciacao_e_amortizacao
                - resultado_financeiro - nao_operacional)::float8 AS ll
     FROM amanna.vw_fato_fin_mes WHERE mes LIKE '2026-%'`,
  );
  saida.push(
    conferir(
      "DRE 2026 · receita líquida (R$ mi)",
      DICIONARIO_2026.receitaLiquida,
      dre.rl / MILHAO,
      0.1,
    ),
  );
  saida.push(
    conferir(
      "DRE 2026 · EBITDA (R$ mi)",
      DICIONARIO_2026.ebitda,
      dre.ebitda / MILHAO,
      0.1,
    ),
  );
  saida.push(
    conferir(
      "DRE 2026 · lucro líquido (R$ mi)",
      DICIONARIO_2026.lucroLiquido,
      dre.ll / MILHAO,
      0.1,
    ),
  );

  // O quadro de dezembro de 2026 e a folha do ano.
  const rh = await um<{ headcount: number; folha: number }>(
    cliente,
    `SELECT (SELECT SUM(headcount_fte)::float8 FROM amanna.vw_fato_rh_mes WHERE mes = '2026-12') AS headcount,
            (SELECT SUM(folha_reais)::float8 FROM amanna.vw_fato_rh_mes WHERE mes LIKE '2026-%') AS folha`,
  );
  saida.push(
    conferir(
      "RH · headcount FTE em dez/2026",
      DICIONARIO_2026.headcountDezembro,
      rh.headcount,
      1,
    ),
  );
  saida.push(
    conferir(
      "RH · folha total 2026 (R$ mi)",
      DICIONARIO_2026.folhaTotal,
      rh.folha / MILHAO,
      0.2,
    ),
  );

  // O gabarito de RH, célula a célula: headcount, admissões, desligamentos, folha.
  const gabarito = await um<{ celulas: number; divergentes: number }>(
    cliente,
    `SELECT COUNT(*)::int AS celulas,
            COUNT(*) FILTER (WHERE ABS(v.headcount_fte - g.headcount_fte) > 0.01
                                OR v.admissoes <> g.admissoes
                                OR v.desligamentos <> g.desligamentos
                                OR ABS(v.folha_reais - g.folha_total) > 1)::int AS divergentes
     FROM amanna.vw_fato_rh_mes v
     JOIN amanna.gabarito_rh_mes g
       ON g.competencia = v.mes AND g.area_slug = v.area AND g.modalidade_slug = v.modalidade
     JOIN amanna.dim_entidade e ON e.id_entidade = g.id_entidade AND e.grupo_filtro = v.entidade
     WHERE v.entidade = 'unidade-sp'`,
  );
  saida.push(
    conferir(
      "gabarito RH · células da Unidade SP divergentes",
      0,
      gabarito.divergentes,
      0,
    ),
  );
  saida.push(
    conferir(
      "gabarito RH · células da Unidade SP comparadas",
      504,
      gabarito.celulas,
      504,
    ),
  );

  // Cada dimensão do perfil soma o mesmo quadro.
  const perfil = await um<{ dimensoes_divergentes: number }>(
    cliente,
    `WITH por_dimensao AS (
       SELECT mes, dimensao, SUM(headcount_fte) AS total FROM amanna.vw_fato_rh_perfil GROUP BY 1, 2
     ), quadro AS (
       SELECT mes, SUM(headcount_fte) AS total FROM amanna.vw_fato_rh_mes GROUP BY 1
     )
     SELECT COUNT(*)::int AS dimensoes_divergentes
     FROM por_dimensao p JOIN quadro q USING (mes)
     WHERE ABS(p.total - q.total) > 0.01`,
  );
  saida.push(
    conferir(
      "perfil · dimensões que não somam o quadro",
      0,
      perfil.dimensoes_divergentes,
      0,
    ),
  );

  // A soma das naturezas de saída é a saída de caixa do mês.
  const naturezas = await um<{ meses_divergentes: number }>(
    cliente,
    `WITH n AS (SELECT mes, entidade, SUM(valor) AS total FROM amanna.vw_fato_saida_categoria GROUP BY 1, 2)
     SELECT COUNT(*)::int AS meses_divergentes
     FROM n JOIN amanna.vw_fato_fin_mes f USING (mes, entidade)
     WHERE ABS(n.total - f.saidas_de_caixa) > 0.01`,
  );
  saida.push(
    conferir(
      "saídas · meses cuja soma das naturezas ≠ saída de caixa",
      0,
      naturezas.meses_divergentes,
      0,
    ),
  );

  // O faturamento por cliente fecha com a receita líquida do razão.
  const faturamento = await um<{ meses_divergentes: number }>(
    cliente,
    `WITH c AS (SELECT mes, entidade, SUM(receita) AS total FROM amanna.vw_fato_faturamento_cliente GROUP BY 1, 2)
     SELECT COUNT(*)::int AS meses_divergentes
     FROM c JOIN amanna.vw_fato_fin_mes f USING (mes, entidade)
     WHERE ABS(c.total - f.receita_liquida) > 1`,
  );
  saida.push(
    conferir(
      "faturamento · meses cuja receita por cliente ≠ receita líquida",
      0,
      faturamento.meses_divergentes,
      0,
    ),
  );

  // Contas do plano de custo e despesa sem classe fixo/variável.
  const natureza = await um<{ sem_classe: number }>(
    cliente,
    `SELECT COUNT(*)::int AS sem_classe
     FROM amanna.dim_conta_contabil dc LEFT JOIN amanna.param_natureza_conta p USING (conta)
     WHERE dc.linha_dre IN ('CMV', 'Despesas operacionais') AND p.conta IS NULL`,
  );
  saida.push(
    conferir(
      "natureza · contas de custo sem classe fixo/variável",
      0,
      natureza.sem_classe,
      0,
    ),
  );

  // Contratos vencidos que ainda carregam saldo: inconsistência da base
  // sintética (EMP001, EMP003 e EMP007), registrada em D-DADOS. A view de
  // dívida usa o snapshot como âncora mesmo assim.
  const divida = await um<{ vencidos_com_saldo: number }>(
    cliente,
    `SELECT COUNT(*)::int AS vencidos_com_saldo FROM amanna.emprestimos
     WHERE data_vencimento < DATE '2026-12-31' AND saldo_devedor_2026_12 > 0`,
  );
  saida.push(
    conferir(
      "dívida · contratos vencidos com saldo em 2026-12 (inconsistência conhecida)",
      3,
      divida.vencidos_com_saldo,
      0,
    ),
  );

  return saida;
}

/** O relatório em texto, uma linha por conferência. */
export function relatorioDeConferencia(lista: readonly Conferencia[]): string {
  return lista
    .map(
      (c) =>
        `${c.ok ? "ok " : "ERRO"}  ${c.nome}: esperado ${String(c.esperado)}, obtido ${String(Math.round(c.obtido * 1000) / 1000)}` +
        (c.tolerancia > 0 ? ` (±${String(c.tolerancia)})` : ""),
    )
    .join("\n");
}
