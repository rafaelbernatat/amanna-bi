/**
 * A conexão com o Postgres: o único lugar do produto que importa o driver.
 *
 * É conexão, e não porta de leitura. A camada de acesso continua tendo as
 * quatro portas da seção 9.1 (mais o ranking de D-CHAT-ferramentas), e quem
 * fala com o banco — o adaptador de warehouse, a carga, o armazém da marca e o
 * registro de incidentes do chat — recebe um `ClientePostgres` e nunca vê o
 * `pg`. Um teste de arquitetura confere que `from "pg"` aparece neste arquivo
 * e em nenhum outro.
 *
 * ## Por que um pool por processo, guardado em `globalThis`
 *
 * Na Vercel cada instância de função atende muitas requisições antes de
 * morrer, e o servidor instancia o mesmo módulo mais de uma vez (a rota e a
 * página são bundles distintos — lição registrada em D-MARCA). Um pool em
 * variável de módulo viraria dois ou três pools por instância; em
 * `globalThis`, é um. `max` baixo porque o pooler do Supabase é quem
 * multiplexa: o produto faz poucas consultas grandes (as 17 views, uma vez por
 * instância e por versão de carga), não muitas pequenas.
 *
 * ## O que este módulo exige da URL
 *
 * `DATABASE_URL` é a do **pooler em modo transação** (Supavisor, porta 6543).
 * Nesse modo não há `SET`, não há `LISTEN`, e não há *prepared statement*
 * nomeado — por isso `consultar` nunca passa `name` ao driver. A carga, que
 * precisa de `COPY`, usa `DATABASE_URL_CARGA` (pooler em modo sessão) e passa
 * a URL explicitamente a `criarCliente`.
 *
 * TLS fica ligado com verificação da cadeia, sempre. Se a cadeia do pooler
 * for recusada num ambiente, a saída é entregar a autoridade certificadora em
 * `DATABASE_SSL_CA`, nunca desligar a verificação: uma conexão que aceita
 * qualquer certificado é uma conexão que aceita qualquer servidor.
 */

import { Pool, types, type PoolClient } from "pg";

/** O que o resto do produto vê. `pg.Pool` e `PoolClient` satisfazem os dois. */
export type ClientePostgres = {
  /** Uma consulta parametrizada. Devolve as linhas, já com números como números. */
  consultar<T>(
    sql: string,
    parametros?: readonly unknown[],
  ): Promise<readonly T[]>;
  /** Uma transação: tudo dentro de `f` compartilha a mesma conexão. */
  transacao<T>(f: (c: ClientePostgres) => Promise<T>): Promise<T>;
  /** Fecha as conexões. Só a carga e o teste chamam. */
  encerrar(): Promise<void>;
};

/*
 * O driver devolve `numeric` e `int8` como texto, porque o tipo do Postgres
 * cabe mais que um `double`. Aqui o dinheiro tem duas casas e cabe folgado, e
 * o motor de cálculo espera `number` — converter na borda é o que evita
 * `"1234.56" + "7"` virar concatenação em algum lugar do meio.
 *
 * Datas ficam como texto (`AAAA-MM-DD`) de propósito: construir `Date` a partir
 * de uma data sem hora depende do fuso da máquina, e é o defeito que o módulo
 * de formatação já documenta. Instantes com fuso também ficam como texto ISO.
 */
const OID_NUMERIC = 1700;
const OID_INT8 = 20;
const OID_DATE = 1082;
const OID_TIMESTAMPTZ = 1184;
const OID_TIMESTAMP = 1114;

types.setTypeParser(OID_NUMERIC, (texto: string) => Number.parseFloat(texto));
types.setTypeParser(OID_INT8, (texto: string) => Number.parseInt(texto, 10));
types.setTypeParser(OID_DATE, (texto: string) => texto);
types.setTypeParser(OID_TIMESTAMPTZ, (texto: string) => texto);
types.setTypeParser(OID_TIMESTAMP, (texto: string) => texto);

const MAXIMO_DE_CONEXOES = 3;
const OCIOSA_MS = 10_000;

/**
 * Quanto uma consulta espera por uma conexão livre da piscina.
 *
 * Não é o tempo de rede: é o tempo de **fila**. A leitura fria da base dispara
 * dezoito `SELECT` ao mesmo tempo (`src/acesso/warehouse/leitor.ts`) sobre três
 * conexões, então a última espera cinco ou seis rodadas antes de começar.
 *
 * Com cinco segundos isso não cabia, e o sintoma enganava: o erro era
 * "timeout exceeded when trying to connect", que se lê como banco inalcançável
 * quando o banco estava respondendo bem. Medido contra o Supabase em
 * `us-west-2` a partir do Brasil: 211 ms por ida quente, 1,6 s na primeira
 * conexão, e de 0,2 a 1,8 s por view. A fila inteira fica na casa dos seis
 * segundos, e acontece **uma vez por instância** — depois a base vive em
 * memória, com o TTL de cinco minutos do cache.
 *
 * Vinte segundos é folga para essa fila sem virar espera indefinida. Se passar
 * disso, o problema é outro, e um teto maior só esconderia.
 */
const LIMITE_PARA_CONECTAR_MS = 20_000;

export type OpcoesDoCliente = {
  readonly max?: number;
  /** A autoridade certificadora em PEM, quando a cadeia do servidor exigir. */
  readonly ca?: string;
};

/** A URL pede TLS? Só localhost e `sslmode=disable` dispensam. */
function precisaDeTls(url: string): boolean {
  let analisada: URL;
  try {
    analisada = new URL(url);
  } catch {
    return true;
  }
  if (analisada.searchParams.get("sslmode") === "disable") return false;
  return !["localhost", "127.0.0.1", "::1"].includes(analisada.hostname);
}

function envolver(
  executar: (
    sql: string,
    parametros?: readonly unknown[],
  ) => Promise<{ rows: unknown[] }>,
  transacao: <T>(f: (c: ClientePostgres) => Promise<T>) => Promise<T>,
  encerrar: () => Promise<void>,
): ClientePostgres {
  return {
    async consultar<T>(sql: string, parametros?: readonly unknown[]) {
      const resultado = await executar(sql, parametros);
      return resultado.rows as readonly T[];
    },
    transacao,
    encerrar,
  };
}

/** O cliente de uma conexão já tomada do pool: base da transação. */
function clienteDaConexao(conexao: PoolClient): ClientePostgres {
  return envolver(
    (sql, parametros) =>
      conexao.query(sql, parametros as unknown[] | undefined),
    async (f) => f(clienteDaConexao(conexao)),
    async () => {
      // Quem encerra é o pool, não a transação.
    },
  );
}

/**
 * A autoridade certificadora do ambiente, com as quebras de linha de volta.
 *
 * Um PEM tem quebras de linha, e quase nenhum painel de nuvem lida bem com
 * isso: o CLI da Vercel recusa `--value` com valor de várias linhas
 * ("option requires argument"), e caixas de texto de painel costumam comer a
 * formatação. O costume da indústria é guardar o certificado numa linha só,
 * com `
` escrito literalmente, e desescapar na leitura — é o que se faz com
 * chave de serviço em toda plataforma que só aceita valor de uma linha.
 *
 * Os dois formatos são aceitos: quem puder gravar o PEM com quebras de
 * verdade (um `.env.local`, um cofre decente) não precisa escapar nada.
 */
export function caDoAmbiente(
  ambiente: Record<string, string | undefined> = process.env,
): string | undefined {
  const bruta = ambiente["DATABASE_SSL_CA"];
  if (bruta === undefined || bruta.trim() === "") return undefined;
  return bruta.includes("\\n") ? bruta.replace(/\\n/g, "\n") : bruta;
}

/** Um cliente sobre uma URL. A carga e o teste usam; o produto usa o do processo. */
export function criarCliente(
  url: string,
  opcoes: OpcoesDoCliente = {},
): ClientePostgres {
  const pool = new Pool({
    connectionString: url,
    max: opcoes.max ?? MAXIMO_DE_CONEXOES,
    idleTimeoutMillis: OCIOSA_MS,
    connectionTimeoutMillis: LIMITE_PARA_CONECTAR_MS,
    ssl: precisaDeTls(url)
      ? {
          rejectUnauthorized: true,
          ...(opcoes.ca === undefined ? {} : { ca: opcoes.ca }),
        }
      : false,
  });

  return envolver(
    (sql, parametros) => pool.query(sql, parametros as unknown[] | undefined),
    async (f) => {
      const conexao = await pool.connect();
      try {
        await conexao.query("BEGIN");
        const saida = await f(clienteDaConexao(conexao));
        await conexao.query("COMMIT");
        return saida;
      } catch (erro) {
        try {
          await conexao.query("ROLLBACK");
        } catch {
          // A conexão pode já ter caído; o erro original é o que importa.
        }
        throw erro;
      } finally {
        conexao.release();
      }
    },
    async () => {
      await pool.end();
    },
  );
}

/* ------------------------------------------------------------------ *
 * O cliente do processo
 * ------------------------------------------------------------------ */

const CHAVE = Symbol.for("amanna-bi.postgres.cliente");

type Guardado = { readonly url: string; readonly cliente: ClientePostgres };

function guardado(): Guardado | null {
  const g = globalThis as unknown as Record<symbol, Guardado | undefined>;
  return g[CHAVE] ?? null;
}

function guardar(valor: Guardado | null): void {
  const g = globalThis as unknown as Record<symbol, Guardado | undefined>;
  g[CHAVE] = valor ?? undefined;
}

export class BancoNaoConfigurado extends Error {
  constructor() {
    super(
      "DATABASE_URL ausente. A validação de boot deveria ter parado antes daqui: " +
        "DATA_SOURCE=warehouse e MARCA_ARMAZEM=postgres a exigem.",
    );
    this.name = "BancoNaoConfigurado";
  }
}

/**
 * O cliente compartilhado do processo, um por URL.
 *
 * Trocar a URL (só acontece em teste) descarta o anterior sem fechá-lo — o
 * teste que troca é responsável por `encerrarClienteDoProcesso()` antes.
 */
export function clienteDoProcesso(
  ambiente: Record<string, string | undefined> = process.env,
): ClientePostgres {
  const url = ambiente["DATABASE_URL"];
  if (url === undefined || url.trim() === "") throw new BancoNaoConfigurado();

  const atual = guardado();
  if (atual !== null && atual.url === url) return atual.cliente;

  const ca = caDoAmbiente(ambiente);
  const cliente = criarCliente(url, ca === undefined ? {} : { ca });
  guardar({ url, cliente });
  return cliente;
}

/** Fecha e esquece o cliente do processo. Só carga e teste. */
export async function encerrarClienteDoProcesso(): Promise<void> {
  const atual = guardado();
  guardar(null);
  if (atual !== null) await atual.cliente.encerrar();
}
