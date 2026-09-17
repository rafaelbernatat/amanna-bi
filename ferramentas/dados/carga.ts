/**
 * A carga da base Amanna (D-DADOS, T-267).
 *
 * Biblioteca, sem linha de comando: `carregar.mts` e `conferir.mts` a chamam,
 * e o ensaio em PGlite também. Tudo recebe um `ClientePostgres` — o mesmo
 * contrato que o produto usa —, então o que roda no Supabase roda idêntico no
 * Postgres em processo do teste.
 *
 * ## Idempotência
 *
 * A migração é `IF NOT EXISTS` e `OR REPLACE` do começo ao fim. Cada tabela é
 * carregada dentro de uma transação: `TRUNCATE` e depois os `INSERT`s em lote.
 * Falha no meio devolve a tabela ao estado anterior e a versão não é
 * registrada — a réplica anterior continua valendo (RF-22). Rodar duas vezes
 * produz as mesmas contagens.
 *
 * ## Por que INSERT em lote, e não COPY
 *
 * `COPY FROM STDIN` precisa de uma conexão de sessão e de um driver que a
 * exponha; o pooler do Supabase em modo transação não o atravessa, e o PGlite
 * do ensaio não o fala. Lotes de algumas centenas de linhas parametrizadas
 * chegam a algumas dezenas de segundos para os 82 MB, e é o mesmo caminho nos
 * dois lugares. O que se ganha em portabilidade paga o que se perde em
 * velocidade, e a carga roda uma vez.
 */

import { createReadStream, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

import { parse } from "csv-parse";

import type { ClientePostgres } from "../../src/acesso/postgres/cliente.ts";

/** Uma tabela a carregar: o arquivo, o destino e, se houver, a coluna de origem. */
export type ItemDoPlano = {
  readonly arquivo: string;
  readonly tabela: string;
  /** A tabela é truncada antes deste arquivo? Falso para o segundo razão. */
  readonly truncar: boolean;
  /** Coluna preenchida com o nome do arquivo depois da carga, quando existe. */
  readonly colunaDeOrigem?: string;
};

/**
 * O plano: um item por CSV, na ordem de carga.
 *
 * Os dois razões caem na mesma tabela; o segundo não trunca. Os oito `vw_*`
 * viram tabelas de gabarito (003), nunca fonte.
 */
export const PLANO: readonly ItemDoPlano[] = [
  { arquivo: "dim_calendario.csv", tabela: "dim_calendario", truncar: true },
  { arquivo: "dim_entidade.csv", tabela: "dim_entidade", truncar: true },
  {
    arquivo: "dim_centro_custo.csv",
    tabela: "dim_centro_custo",
    truncar: true,
  },
  {
    arquivo: "dim_conta_contabil.csv",
    tabela: "dim_conta_contabil",
    truncar: true,
  },
  { arquivo: "dim_cliente.csv", tabela: "dim_cliente", truncar: true },
  { arquivo: "dim_fornecedor.csv", tabela: "dim_fornecedor", truncar: true },
  { arquivo: "dim_cargo.csv", tabela: "dim_cargo", truncar: true },
  {
    arquivo: "dim_produto_servico.csv",
    tabela: "dim_produto_servico",
    truncar: true,
  },
  { arquivo: "colaboradores.csv", tabela: "colaboradores", truncar: true },
  {
    arquivo: "movimentacao_pessoal.csv",
    tabela: "movimentacao_pessoal",
    truncar: true,
  },
  { arquivo: "folha_pagamento.csv", tabela: "folha_pagamento", truncar: true },
  { arquivo: "ponto_ausencias.csv", tabela: "ponto_ausencias", truncar: true },
  {
    arquivo: "vagas_recrutamento.csv",
    tabela: "vagas_recrutamento",
    truncar: true,
  },
  { arquivo: "candidaturas.csv", tabela: "candidaturas", truncar: true },
  {
    arquivo: "treinamento_turmas.csv",
    tabela: "treinamento_turmas",
    truncar: true,
  },
  {
    arquivo: "treinamento_participacoes.csv",
    tabela: "treinamento_participacoes",
    truncar: true,
  },
  {
    arquivo: "pesquisa_engajamento.csv",
    tabela: "pesquisa_engajamento",
    truncar: true,
  },
  {
    arquivo: "apontamento_horas.csv",
    tabela: "apontamento_horas",
    truncar: true,
  },
  {
    arquivo: "notas_fiscais_saida.csv",
    tabela: "notas_fiscais_saida",
    truncar: true,
  },
  {
    arquivo: "itens_nota_saida.csv",
    tabela: "itens_nota_saida",
    truncar: true,
  },
  {
    arquivo: "notas_fiscais_entrada.csv",
    tabela: "notas_fiscais_entrada",
    truncar: true,
  },
  { arquivo: "contas_receber.csv", tabela: "contas_receber", truncar: true },
  { arquivo: "contas_pagar.csv", tabela: "contas_pagar", truncar: true },
  {
    arquivo: "razao_contabil_2025.csv",
    tabela: "razao_contabil",
    truncar: true,
    colunaDeOrigem: "arquivo_origem",
  },
  {
    arquivo: "razao_contabil_2026.csv",
    tabela: "razao_contabil",
    truncar: false,
    colunaDeOrigem: "arquivo_origem",
  },
  { arquivo: "movimento_caixa.csv", tabela: "movimento_caixa", truncar: true },
  { arquivo: "orcamento.csv", tabela: "orcamento", truncar: true },
  { arquivo: "projetos.csv", tabela: "projetos", truncar: true },
  { arquivo: "emprestimos.csv", tabela: "emprestimos", truncar: true },
  { arquivo: "metas.csv", tabela: "metas", truncar: true },
  { arquivo: "vw_fato_rh_mes.csv", tabela: "gabarito_rh_mes", truncar: true },
  {
    arquivo: "vw_fato_recrutamento_mes.csv",
    tabela: "gabarito_recrutamento_mes",
    truncar: true,
  },
  { arquivo: "vw_dre_mes.csv", tabela: "gabarito_dre_mes", truncar: true },
  { arquivo: "vw_fato_fin_mes.csv", tabela: "gabarito_fin_mes", truncar: true },
  {
    arquivo: "vw_fato_faturamento_mes.csv",
    tabela: "gabarito_faturamento_mes",
    truncar: true,
  },
  {
    arquivo: "vw_fato_contas_mes.csv",
    tabela: "gabarito_contas_mes",
    truncar: true,
  },
  {
    arquivo: "vw_fato_caixa_mes.csv",
    tabela: "gabarito_caixa_mes",
    truncar: true,
  },
  { arquivo: "vw_fato_int_mes.csv", tabela: "gabarito_int_mes", truncar: true },
];

/** As 18 views do produto, para o registro de carga e a conferência. */
export const VIEWS_DO_PRODUTO: readonly string[] = [
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

const LINHAS_POR_LOTE = 400;

/* ------------------------------------------------------------------ *
 * Migração
 * ------------------------------------------------------------------ */

/** Aplica os arquivos SQL da pasta, em ordem alfabética, cada um numa transação. */
export async function aplicarMigracoes(
  cliente: ClientePostgres,
  pasta: string,
  registrar: (mensagem: string) => void = () => {},
): Promise<readonly string[]> {
  const arquivos = readdirSync(pasta)
    .filter((n) => n.endsWith(".sql"))
    .sort();
  for (const nome of arquivos) {
    const sql = readFileSync(join(pasta, nome), "utf8");
    await cliente.transacao(async (t) => {
      await t.consultar(sql);
    });
    registrar(`migração ${nome} aplicada`);
  }
  return arquivos;
}

/* ------------------------------------------------------------------ *
 * A carga de um CSV
 * ------------------------------------------------------------------ */

/** Vazio no CSV é NULL no banco — é como `data_desligamento` diz "ativo". */
function valorOuNulo(texto: string): string | null {
  return texto === "" ? null : texto;
}

/**
 * Lê um CSV em lotes de linhas, chamando `aoLote` a cada lote.
 *
 * O cabeçalho vira a lista de colunas do INSERT: a tabela precisa ter essas
 * colunas, com esses nomes, e é isso que faz a carga reprovar cedo quando um
 * CSV muda de forma.
 */
async function lerEmLotes(
  caminho: string,
  aoLote: (
    colunas: readonly string[],
    linhas: readonly (string | null)[][],
  ) => Promise<void>,
): Promise<number> {
  const leitor = createReadStream(caminho).pipe(
    parse({
      delimiter: ";",
      bom: true,
      columns: false,
      relax_column_count: false,
    }),
  );
  let colunas: readonly string[] | null = null;
  let lote: (string | null)[][] = [];
  let total = 0;

  for await (const registro of leitor as AsyncIterable<string[]>) {
    if (colunas === null) {
      colunas = registro.map((c) => c.trim());
      continue;
    }
    lote.push(registro.map(valorOuNulo));
    if (lote.length >= LINHAS_POR_LOTE) {
      await aoLote(colunas, lote);
      total += lote.length;
      lote = [];
    }
  }
  if (colunas !== null && lote.length > 0) {
    await aoLote(colunas, lote);
    total += lote.length;
  }
  return total;
}

/** Um INSERT parametrizado de várias linhas. */
function montarInsert(
  tabela: string,
  colunas: readonly string[],
  quantasLinhas: number,
): string {
  const largura = colunas.length;
  const valores = Array.from({ length: quantasLinhas }, (_, i) => {
    const marcadores = Array.from(
      { length: largura },
      (_, j) => `$${String(i * largura + j + 1)}`,
    );
    return `(${marcadores.join(", ")})`;
  });
  return `INSERT INTO amanna.${tabela} (${colunas.join(", ")}) VALUES ${valores.join(", ")}`;
}

/**
 * Carrega um item do plano, dentro de uma transação.
 *
 * Devolve quantas linhas entraram. A tabela é truncada antes quando o plano
 * manda; o segundo arquivo do razão não trunca.
 */
export async function carregarItem(
  cliente: ClientePostgres,
  pastaDosCsvs: string,
  item: ItemDoPlano,
  registrar: (mensagem: string) => void = () => {},
): Promise<number> {
  const caminho = join(pastaDosCsvs, item.arquivo);
  return cliente.transacao(async (t) => {
    if (item.truncar) await t.consultar(`TRUNCATE TABLE amanna.${item.tabela}`);
    const linhas = await lerEmLotes(caminho, async (colunas, lote) => {
      await t.consultar(
        montarInsert(item.tabela, colunas, lote.length),
        lote.flat(),
      );
    });
    if (item.colunaDeOrigem !== undefined) {
      await t.consultar(
        `UPDATE amanna.${item.tabela} SET ${item.colunaDeOrigem} = $1 WHERE ${item.colunaDeOrigem} IS NULL`,
        [basename(item.arquivo)],
      );
    }
    registrar(
      `${item.arquivo} → amanna.${item.tabela}: ${String(linhas)} linhas`,
    );
    return linhas;
  });
}

/* ------------------------------------------------------------------ *
 * O registro da carga
 * ------------------------------------------------------------------ */

/** Registra uma tabela ou view carregada, na versão desta rodada. */
export async function registrarCarga(
  cliente: ClientePostgres,
  versao: string,
  alvo: string,
  linhas: number,
  iniciadaEm: string,
  asOf: string | null,
  arquivo: string | null,
): Promise<void> {
  await cliente.consultar(
    `INSERT INTO amanna.carga (versao, alvo, linhas, iniciada_em, concluida_em, as_of, arquivo)
     VALUES ($1, $2, $3, $4, now(), $5, $6)
     ON CONFLICT (versao, alvo) DO UPDATE
       SET linhas = EXCLUDED.linhas, concluida_em = now(), as_of = EXCLUDED.as_of, arquivo = EXCLUDED.arquivo`,
    [versao, alvo, linhas, iniciadaEm, asOf, arquivo],
  );
}

/** Registra as 18 views: quantas linhas cada uma produz e até que mês vão. */
export async function registrarViews(
  cliente: ClientePostgres,
  versao: string,
  iniciadaEm: string,
  registrar: (mensagem: string) => void = () => {},
): Promise<void> {
  for (const view of VIEWS_DO_PRODUTO) {
    const [linha] = await cliente.consultar<{
      linhas: number;
      ultimo: string | null;
    }>(
      `SELECT COUNT(*)::int AS linhas, MAX(mes)::text AS ultimo FROM amanna.${view}`,
    );
    const ultimo = linha?.ultimo ?? null;
    const asOf = ultimo === null ? null : ultimoDiaDoMes(ultimo);
    await registrarCarga(
      cliente,
      versao,
      view,
      linha?.linhas ?? 0,
      iniciadaEm,
      asOf,
      null,
    );
    registrar(
      `${view}: ${String(linha?.linhas ?? 0)} linhas até ${ultimo ?? "—"}`,
    );
  }
}

/** O último dia de um mês `AAAA-MM`, em ISO. */
export function ultimoDiaDoMes(mes: string): string {
  const [ano, numero] = mes.trim().split("-");
  const data = new Date(Date.UTC(Number(ano), Number(numero), 0));
  return data.toISOString().slice(0, "0000-00-00".length);
}

/** A versão de uma rodada: o instante, legível e ordenável. */
export function versaoDaRodada(agora: Date = new Date()): string {
  return agora.toISOString().replace(/[:.]/g, "-");
}

/* ------------------------------------------------------------------ *
 * A carga inteira
 * ------------------------------------------------------------------ */

export type OpcoesDeCarga = {
  readonly pastaDosCsvs: string;
  readonly pastaDoSql: string;
  readonly versao?: string;
  /** Só estes itens do plano (por tabela). Vazio é tudo. */
  readonly somente?: readonly string[];
  readonly soMigrar?: boolean;
  readonly registrar?: (mensagem: string) => void;
};

export async function carregarBase(
  cliente: ClientePostgres,
  opcoes: OpcoesDeCarga,
): Promise<{ versao: string; tabelas: number; linhas: number }> {
  const registrar = opcoes.registrar ?? (() => {});
  const versao = opcoes.versao ?? versaoDaRodada();
  const iniciadaEm = new Date().toISOString();

  await aplicarMigracoes(cliente, opcoes.pastaDoSql, registrar);
  if (opcoes.soMigrar === true) return { versao, tabelas: 0, linhas: 0 };

  const somente = new Set(opcoes.somente ?? []);
  const itens = PLANO.filter(
    (i) => somente.size === 0 || somente.has(i.tabela),
  );

  let tabelas = 0;
  let linhas = 0;
  for (const item of itens) {
    const n = await carregarItem(cliente, opcoes.pastaDosCsvs, item, registrar);
    await registrarCarga(
      cliente,
      versao,
      item.tabela,
      n,
      iniciadaEm,
      null,
      item.arquivo,
    );
    tabelas += 1;
    linhas += n;
  }
  await registrarViews(cliente, versao, iniciadaEm, registrar);
  return { versao, tabelas, linhas };
}
