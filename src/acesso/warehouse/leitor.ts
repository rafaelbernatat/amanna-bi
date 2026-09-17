/**
 * O leitor: das views do Postgres para a `Base` que o motor recebe (D-DADOS).
 *
 * Dezoito `SELECT *`, um por view, em paralelo. Cada linha passa pela forma
 * declarada em `forma.ts`: coluna que falta, número que não é número ou nulo
 * onde o tipo não admite **lançam**, com o nome da view e da coluna. Recusar
 * na leitura é o que impede um `NaN` de atravessar o motor e virar "R$ NaN mi"
 * na tela — ou, pior, zero.
 *
 * Os cadastros vêm do banco também: são 31 centros de custo, e não 8; dez
 * segmentos, e não cinco. O painel enumera o que a base tem.
 */

import type { Base, Cadastros, Views } from "@/acesso/calculo/base";
import type { ClientePostgres } from "@/acesso/postgres/cliente";
import {
  COMPONENTES_DE_REPOSICAO,
  FAIXA_SALARIAL,
  FAIXAS_DE_AGING,
  QUEBRAS_FIXAS,
} from "@/acesso/warehouse/cadastros";
import {
  colunaDe,
  FORMA_DAS_VIEWS,
  type TipoDeCampo,
} from "@/acesso/warehouse/forma";

export class ViewForaDaForma extends Error {
  constructor(view: string, coluna: string, motivo: string) {
    super(
      `A view amanna.${view} não tem a forma que o motor espera: coluna '${coluna}' ${motivo}. ` +
        "A leitura para aqui de propósito — uma coluna errada viraria número errado na tela.",
    );
    this.name = "ViewForaDaForma";
  }
}

export class BaseSemCarga extends Error {
  constructor() {
    super(
      "Nenhuma carga registrada em amanna.carga. Rode `npm run dados:carregar` " +
        "antes de servir com DATA_SOURCE=warehouse: sem carga não há de onde " +
        "tirar o frescor, e servir sem frescor esconderia dado velho.",
    );
    this.name = "BaseSemCarga";
  }
}

/* ------------------------------------------------------------------ *
 * Coerção por tipo declarado
 * ------------------------------------------------------------------ */

function comoNumero(view: string, coluna: string, valor: unknown): number {
  const numero = typeof valor === "number" ? valor : Number(valor);
  if (valor === null || valor === undefined || Number.isNaN(numero)) {
    throw new ViewForaDaForma(
      view,
      coluna,
      `deveria ser número e veio '${String(valor)}'`,
    );
  }
  return numero;
}

function coagir(
  view: string,
  coluna: string,
  tipo: TipoDeCampo,
  valor: unknown,
): unknown {
  switch (tipo) {
    case "texto":
      if (valor === null || valor === undefined) {
        throw new ViewForaDaForma(
          view,
          coluna,
          "deveria ser texto e veio nulo",
        );
      }
      return String(valor);
    case "numero":
      return comoNumero(view, coluna, valor);
    case "numero-ou-nulo":
      return valor === null || valor === undefined
        ? null
        : comoNumero(view, coluna, valor);
    case "booleano":
      return valor === true || valor === "t" || valor === "true";
  }
}

/** Uma linha do banco na forma do tipo `Linha*`, ou um erro que nomeia a coluna. */
function converterLinha<N extends keyof Views>(
  view: N,
  bruta: Record<string, unknown>,
): Views[N][number] {
  const forma = FORMA_DAS_VIEWS[view] as Record<string, TipoDeCampo>;
  const saida: Record<string, unknown> = {};
  for (const [campo, tipo] of Object.entries(forma)) {
    const coluna = colunaDe(campo);
    if (!(coluna in bruta)) {
      throw new ViewForaDaForma(view, coluna, "não existe");
    }
    saida[campo] = coagir(view, coluna, tipo, bruta[coluna]);
  }
  return saida as Views[N][number];
}

/* ------------------------------------------------------------------ *
 * As views
 * ------------------------------------------------------------------ */

async function lerView<N extends keyof Views>(
  cliente: ClientePostgres,
  view: N,
): Promise<Views[N]> {
  const brutas = await cliente.consultar<Record<string, unknown>>(
    `SELECT * FROM amanna.${view}`,
  );
  return brutas.map((b) => converterLinha(view, b)) as unknown as Views[N];
}

/** As dezoito views, lidas em paralelo. */
export async function lerViews(cliente: ClientePostgres): Promise<Views> {
  const nomes = Object.keys(FORMA_DAS_VIEWS) as (keyof Views)[];
  const lidas = await Promise.all(nomes.map((n) => lerView(cliente, n)));
  const saida: Partial<Record<keyof Views, unknown>> = {};
  nomes.forEach((n, i) => {
    saida[n] = lidas[i];
  });
  return saida as Views;
}

/* ------------------------------------------------------------------ *
 * Os cadastros
 * ------------------------------------------------------------------ */

type Item = { readonly codigo: string; readonly rotulo: string };
type Faixa = Item & { readonly de: number; readonly ate: number | null };

/** Quantas contrapartes nomeadas o painel de vencidos mostra. */
const CONTRAPARTES_NOMEADAS = 6;

export async function lerCadastros(
  cliente: ClientePostgres,
): Promise<CadastrosSemNomes> {
  const [
    centros,
    rating,
    segmentos,
    escolaridade,
    genero,
    ufs,
    clientes,
    fornecedores,
    naturezas,
    top,
    cargos,
  ] = await Promise.all([
    cliente.consultar<Item>(
      `SELECT id_centro_custo AS codigo, centro_custo AS rotulo
         FROM amanna.dim_centro_custo ORDER BY id_centro_custo`,
    ),
    cliente.consultar<{ codigo: string }>(
      `SELECT codigo FROM amanna.map_codigo WHERE dominio = 'rating' GROUP BY codigo ORDER BY MIN(ordem)`,
    ),
    cliente.consultar<{ codigo: string }>(
      `SELECT codigo FROM amanna.map_codigo WHERE dominio = 'segmento' GROUP BY codigo ORDER BY MIN(ordem)`,
    ),
    cliente.consultar<{ codigo: string }>(
      `SELECT codigo FROM amanna.map_codigo WHERE dominio = 'escolaridade' GROUP BY codigo ORDER BY MIN(ordem)`,
    ),
    cliente.consultar<{ codigo: string }>(
      `SELECT codigo FROM amanna.map_codigo WHERE dominio = 'genero' GROUP BY codigo ORDER BY MIN(ordem)`,
    ),
    cliente.consultar<{ codigo: string }>(
      `SELECT uf AS codigo FROM amanna.colaboradores WHERE uf IS NOT NULL
         GROUP BY uf ORDER BY COUNT(*) DESC, uf`,
    ),
    cliente.consultar<Item>(
      `SELECT v.contraparte AS codigo, c.cliente AS rotulo
         FROM amanna.vw_fato_contas v JOIN amanna.dim_cliente c ON c.id_cliente = v.contraparte
         WHERE v.mes = (SELECT MAX(mes) FROM amanna.vw_fato_contas) AND v.faixa_de_aging <> 'a-vencer'
         GROUP BY 1, 2 ORDER BY SUM(v.a_receber) DESC, 1 LIMIT ${String(CONTRAPARTES_NOMEADAS)}`,
    ),
    cliente.consultar<Item>(
      `SELECT v.contraparte AS codigo, f.fornecedor AS rotulo
         FROM amanna.vw_fato_contas v JOIN amanna.dim_fornecedor f ON f.id_fornecedor = v.contraparte
         WHERE v.mes = (SELECT MAX(mes) FROM amanna.vw_fato_contas)
         GROUP BY 1, 2 ORDER BY SUM(v.a_pagar) DESC, 1 LIMIT ${String(CONTRAPARTES_NOMEADAS)}`,
    ),
    cliente.consultar<Item>(
      `SELECT codigo, MIN(rotulo) AS rotulo FROM amanna.map_codigo
         WHERE dominio = 'natureza_de_saida' GROUP BY codigo ORDER BY MIN(ordem), codigo`,
    ),
    cliente.consultar<Item>(
      `SELECT v.cliente AS codigo, c.cliente AS rotulo
         FROM amanna.vw_fato_faturamento_cliente v JOIN amanna.dim_cliente c ON c.id_cliente = v.cliente
         WHERE v.principal GROUP BY 1, 2 ORDER BY SUM(v.receita) DESC`,
    ),
    cliente.consultar<{
      codigo: string;
      rotulo: string;
      de: unknown;
      ate: unknown;
    }>(
      `SELECT id_cargo AS codigo, cargo AS rotulo, salario_min AS de, salario_max AS ate
         FROM amanna.dim_cargo ORDER BY id_cargo`,
    ),
  ]);

  const cargo: Faixa[] = cargos.map((c) => ({
    codigo: c.codigo,
    rotulo: c.rotulo,
    de: Number(c.de),
    ate: c.ate === null ? null : Number(c.ate),
  }));

  return {
    centrosDeCusto: centros,
    faixasDeAging: FAIXAS_DE_AGING,
    faixasDeRating: rating.map((r) => r.codigo),
    segmentosDeCliente: segmentos.map((s) => s.codigo),
    quebrasDoQuadro: {
      ...QUEBRAS_FIXAS,
      escolaridade: escolaridade.map((e) => e.codigo),
      genero: genero.map((g) => g.codigo),
      uf: ufs.map((u) => u.codigo),
    },
    clientesAReceber: clientes,
    fornecedoresAPagar: fornecedores,
    naturezasDeSaida: naturezas,
    topClientes: top,
    componentesDeReposicao: COMPONENTES_DE_REPOSICAO,
    faixaSalarial: FAIXA_SALARIAL,
    cargo,
    uf: ufs.map((u) => u.codigo),
  };
}

/** Os cadastros sem os nomes de cliente, fornecedor e conta, que vêm à parte. */
type CadastrosSemNomes = Omit<
  Cadastros,
  "clientes" | "fornecedores" | "contas"
>;

/**
 * Os nomes que o ranking usa para rotular: a carteira inteira de clientes e
 * fornecedores, e o plano de contas. Só código e nome — nenhuma coluna de
 * pessoa física atravessa.
 */
export async function lerNomes(
  cliente: ClientePostgres,
): Promise<Pick<Cadastros, "clientes" | "fornecedores" | "contas">> {
  const [clientes, fornecedores, contas] = await Promise.all([
    cliente.consultar<Item>(
      `SELECT id_cliente AS codigo, cliente AS rotulo FROM amanna.dim_cliente ORDER BY id_cliente`,
    ),
    cliente.consultar<Item>(
      `SELECT id_fornecedor AS codigo, fornecedor AS rotulo FROM amanna.dim_fornecedor ORDER BY id_fornecedor`,
    ),
    cliente.consultar<Item>(
      `SELECT conta AS codigo, conta_descricao AS rotulo FROM amanna.dim_conta_contabil ORDER BY conta`,
    ),
  ]);
  return { clientes, fornecedores, contas };
}

/* ------------------------------------------------------------------ *
 * A carga
 * ------------------------------------------------------------------ */

export type CargaRegistrada = {
  readonly versao: string;
  /** Instante do sync, ISO em UTC. */
  readonly concluidaEm: string;
  /** Último fechamento carregado, `AAAA-MM-DD`. */
  readonly asOf: string | null;
};

/** A última carga bem-sucedida, ou `BaseSemCarga`. */
export async function lerCarga(
  cliente: ClientePostgres,
): Promise<CargaRegistrada> {
  const linhas = await cliente.consultar<{
    versao: string;
    concluida_em: string;
    as_of: string | null;
  }>(
    `SELECT versao,
            to_char(MAX(concluida_em) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS concluida_em,
            MAX(as_of)::text AS as_of
     FROM amanna.carga
     WHERE concluida_em IS NOT NULL
     GROUP BY versao ORDER BY versao DESC LIMIT 1`,
  );
  const ultima = linhas[0];
  if (ultima === undefined) throw new BaseSemCarga();
  return {
    versao: ultima.versao,
    concluidaEm: ultima.concluida_em,
    asOf: ultima.as_of,
  };
}

/** A versão da última carga, para o cache decidir se relê. */
export async function versaoDaCarga(cliente: ClientePostgres): Promise<string> {
  return (await lerCarga(cliente)).versao;
}

/** A base inteira: views e cadastros, lidos do banco. */
export async function lerBase(cliente: ClientePostgres): Promise<Base> {
  const [views, cadastros, nomes] = await Promise.all([
    lerViews(cliente),
    lerCadastros(cliente),
    lerNomes(cliente),
  ]);
  return { views, cadastros: { ...cadastros, ...nomes } };
}
