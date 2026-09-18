/**
 * O armazém de convidados em Postgres: o modo da nuvem, no banco da réplica.
 *
 * Uma linha por celular cadastrado, no esquema `amanna`, com a cota e o clique
 * na mesma linha. Segue o molde de `src/marca/armazens/postgres.ts`: o DDL é
 * aplicado uma vez por instância antes da primeira gravação — uma instalação
 * pode receber o primeiro convidado antes de a migração `011_convidados.sql`
 * rodar —, a leitura nunca cria nada, e o erro do driver chega à rota só com
 * o nome e o código.
 *
 * ## A cota é uma instrução só
 *
 * `UPDATE … SET perguntas = perguntas + 1 WHERE … AND perguntas < $3
 * RETURNING`: quem recebe uma linha foi admitido; quem recebe zero linhas ou
 * não tem cadastro ou não tem cota, e uma segunda leitura diz qual. É atômico
 * no banco, e por isso vale entre instâncias — o que a memória do processo não
 * consegue prometer.
 *
 * ## O e-mail nunca entra no texto da consulta
 *
 * Sempre por parâmetro. É dado pessoal, e o texto da consulta é o que um erro
 * de driver ecoa.
 */

import type { ClientePostgres } from "@/acesso/postgres/cliente";
import {
  FalhaNoCadastro,
  type AdmissaoDePergunta,
  type ArmazemDeConvidados,
  type Convidado,
} from "@/convidados/armazem";
import type { OrigemDoInteresse } from "@/convidados/interesse";

/** Onde os convidados moram. O mesmo nome da migração `011_convidados.sql`. */
export const TABELA_DE_CONVIDADOS = "amanna.convidado";

/** SQLSTATE de "a relação não existe": para quem lê, é "ninguém cadastrado". */
const TABELA_INEXISTENTE = "42P01";

/**
 * O DDL, idêntico ao da migração da carga. Exportado para um teste comparar
 * os dois textos.
 */
export function ddlDosConvidados(
  tabela: string = TABELA_DE_CONVIDADOS,
): string {
  const [esquema, local] = tabela.includes(".")
    ? tabela.split(".")
    : [null, tabela];
  return (
    (esquema === null || esquema === undefined
      ? ""
      : `CREATE SCHEMA IF NOT EXISTS ${esquema};\n`) +
    `CREATE TABLE IF NOT EXISTS ${tabela} (\n` +
    "  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n" +
    "  sala text NOT NULL,\n" +
    "  dispositivo text NOT NULL,\n" +
    "  nome text NOT NULL,\n" +
    "  email text NOT NULL,\n" +
    "  criado_em timestamptz NOT NULL DEFAULT now(),\n" +
    "  atualizado_em timestamptz NOT NULL DEFAULT now(),\n" +
    "  expira_em timestamptz NOT NULL,\n" +
    "  perguntas smallint NOT NULL DEFAULT 0,\n" +
    "  interesse_em timestamptz,\n" +
    "  interesse_origem text\n" +
    "    CHECK (interesse_origem IS NULL OR interesse_origem IN ('limite', 'expiracao')),\n" +
    "  cliques_de_interesse smallint NOT NULL DEFAULT 0,\n" +
    "  UNIQUE (sala, dispositivo)\n" +
    ");\n" +
    `CREATE INDEX IF NOT EXISTS ${local ?? tabela}_email ON ${tabela} (email);\n` +
    `ALTER TABLE ${tabela} ENABLE ROW LEVEL SECURITY;`
  );
}

function codigoDe(erro: unknown): string | null {
  if (typeof erro !== "object" || erro === null) return null;
  const codigo = (erro as { code?: unknown }).code;
  return typeof codigo === "string" ? codigo : null;
}

function motivoDe(erro: unknown): string {
  const codigo = codigoDe(erro);
  const nome = erro instanceof Error ? erro.name : "erro";
  return codigo === null ? nome : `${nome} (${codigo})`;
}

const NOME_DE_TABELA = /^[a-z_][a-z0-9_]*(\.[a-z_][a-z0-9_]*)?$/;

type Linha = {
  readonly id: string;
  readonly nome: string;
  readonly perguntas: number;
  readonly interesse_em: string | Date | null;
};

function convidadoDe(linha: Linha): Convidado {
  return {
    id: linha.id,
    nome: linha.nome,
    perguntas: Number(linha.perguntas),
    // O driver de produção entrega timestamptz como texto; outros clientes
    // (o PGlite dos testes) podem entregar Date. Sempre texto daqui em diante.
    interesseEm:
      linha.interesse_em === null
        ? null
        : linha.interesse_em instanceof Date
          ? linha.interesse_em.toISOString()
          : String(linha.interesse_em),
  };
}

const COLUNAS_DEVOLVIDAS = "id, nome, perguntas, interesse_em";

export function criarArmazemDeConvidadosEmPostgres(opcoes: {
  readonly cliente: ClientePostgres;
  /** Outra tabela, só para o teste isolar uma rodada da outra. */
  readonly tabela?: string;
}): ArmazemDeConvidados {
  const { cliente } = opcoes;
  const tabela = opcoes.tabela ?? TABELA_DE_CONVIDADOS;
  if (!NOME_DE_TABELA.test(tabela)) {
    throw new Error(`Nome de tabela fora da forma: '${tabela}'.`);
  }

  let preparada: Promise<void> | null = null;
  function preparar(): Promise<void> {
    if (preparada === null) {
      preparada = cliente.consultar(ddlDosConvidados(tabela)).then(
        () => undefined,
        (erro: unknown) => {
          preparada = null;
          throw erro;
        },
      );
    }
    return preparada;
  }

  async function ler(chave: {
    readonly sala: string;
    readonly dispositivo: string;
  }): Promise<Convidado | null> {
    try {
      const linhas = await cliente.consultar<Linha>(
        `SELECT ${COLUNAS_DEVOLVIDAS} FROM ${tabela} WHERE sala = $1 AND dispositivo = $2`,
        [chave.sala, chave.dispositivo],
      );
      const linha = linhas[0];
      return linha === undefined ? null : convidadoDe(linha);
    } catch (erro) {
      if (codigoDe(erro) === TABELA_INEXISTENTE) return null;
      throw new FalhaNoCadastro(motivoDe(erro));
    }
  }

  return {
    registrar: async (novo) => {
      try {
        await preparar();
        const linhas = await cliente.consultar<Linha>(
          `INSERT INTO ${tabela} (sala, dispositivo, nome, email, expira_em)\n` +
            "VALUES ($1, $2, $3, $4, $5::timestamptz)\n" +
            "ON CONFLICT (sala, dispositivo) DO UPDATE\n" +
            "SET nome = EXCLUDED.nome, email = EXCLUDED.email,\n" +
            "    expira_em = EXCLUDED.expira_em, atualizado_em = now()\n" +
            `RETURNING ${COLUNAS_DEVOLVIDAS}`,
          [novo.sala, novo.dispositivo, novo.nome, novo.email, novo.expiraEm],
        );
        const linha = linhas[0];
        if (linha === undefined) {
          throw new FalhaNoCadastro("a gravação não devolveu a linha");
        }
        return convidadoDe(linha);
      } catch (erro) {
        if (erro instanceof FalhaNoCadastro) throw erro;
        throw new FalhaNoCadastro(motivoDe(erro));
      }
    },

    ler,

    admitirPergunta: async (chave, limite): Promise<AdmissaoDePergunta> => {
      try {
        const linhas = await cliente.consultar<Linha>(
          `UPDATE ${tabela}\n` +
            "SET perguntas = perguntas + 1, atualizado_em = now()\n" +
            "WHERE sala = $1 AND dispositivo = $2 AND perguntas < $3\n" +
            `RETURNING ${COLUNAS_DEVOLVIDAS}`,
          [chave.sala, chave.dispositivo, limite],
        );
        const linha = linhas[0];
        if (linha !== undefined) {
          return { tipo: "admitida", convidado: convidadoDe(linha) };
        }
      } catch (erro) {
        if (codigoDe(erro) === TABELA_INEXISTENTE)
          return { tipo: "sem_cadastro" };
        throw new FalhaNoCadastro(motivoDe(erro));
      }
      const atual = await ler(chave);
      return atual === null
        ? { tipo: "sem_cadastro" }
        : { tipo: "esgotada", convidado: atual };
    },

    registrarInteresse: async (id, origem: OrigemDoInteresse) => {
      try {
        await cliente.consultar(
          `UPDATE ${tabela}\n` +
            "SET interesse_em = COALESCE(interesse_em, now()),\n" +
            "    interesse_origem = COALESCE(interesse_origem, $2),\n" +
            "    cliques_de_interesse = cliques_de_interesse + 1,\n" +
            "    atualizado_em = now()\n" +
            "WHERE id = $1::uuid",
          [id, origem],
        );
      } catch (erro) {
        if (codigoDe(erro) === TABELA_INEXISTENTE) return;
        throw new FalhaNoCadastro(motivoDe(erro));
      }
    },
  };
}
