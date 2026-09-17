/**
 * O armazém em Postgres: o modo da nuvem, no mesmo banco da réplica.
 *
 * A primeira versão de D-MARCA declarou um modo `blob` que nunca existiu. Com
 * D-DADOS, a instalação já tem um Postgres — o do Supabase, onde a base Amanna
 * mora —, e a marca vai para lá: uma tabela de uma linha, no esquema
 * `amanna`, com o documento inteiro em `jsonb`.
 *
 * ## Uma linha, um documento
 *
 * `id = 1` com `CHECK (id = 1)`: a tabela não tem como ter duas marcas. A
 * gravação é `INSERT … ON CONFLICT (id) DO UPDATE`, que faz o papel do
 * renomeio atômico do armazém de arquivo — nunca existe um instante em que o
 * documento está pela metade, porque a linha inteira troca de uma vez.
 *
 * ## A tabela existe antes da primeira gravação?
 *
 * Normalmente sim: a migração `009_marca.sql` da carga a cria. Mas uma
 * instalação pode ligar `MARCA_ARMAZEM=postgres` antes de rodar a carga — o
 * banco existe, a marca é a primeira coisa que alguém quer configurar —, e por
 * isso o DDL é aplicado **uma vez por instância**, antes da primeira gravação.
 * `IF NOT EXISTS` deixa isso idempotente. `ler()` **não** cria nada: leitura
 * não tem por que alterar o banco, e uma tabela ausente é só "sem marca".
 *
 * ## RLS ligada, sem política
 *
 * O documento carrega o logo em base64 e o sujeito de quem aplicou. Pela
 * conexão de servidor (a dona do esquema), a linha de segurança não se aplica;
 * pela Data API do Supabase, que serve `anon` e `authenticated`, a tabela
 * responde vazia. Não é a defesa principal — o esquema `amanna` nem é exposto
 * pela API —, é a segunda camada, para o dia em que alguém expuser o esquema
 * sem lembrar desta tabela.
 *
 * ## O que este módulo não faz
 *
 * Não importa `pg`. Recebe um `ClientePostgres` e usa só `consultar`: é o
 * mesmo contrato que o adaptador de warehouse usa, e o mesmo que o PGlite
 * implementa para os testes. O erro do driver nunca chega à tela: vira
 * `FalhaAoGravarMarca` com o código SQLSTATE, sem a mensagem — a mensagem do
 * driver pode carregar o texto da consulta, e o texto da consulta carrega o
 * documento.
 */

import type { ClientePostgres } from "@/acesso/postgres/cliente";
import { FalhaAoGravarMarca, type ArmazemDaMarca } from "@/marca/armazem";
import { ESTADO_VAZIO, lerEstado, type EstadoDaMarca } from "@/marca/documento";

/** Onde a marca mora. O mesmo nome da migração `009_marca.sql`. */
export const TABELA_DA_MARCA = "amanna.marca_da_instalacao";

/** SQLSTATE de "a relação não existe". Em `limpar`, é sucesso. */
const TABELA_INEXISTENTE = "42P01";

/**
 * O DDL, idêntico ao da migração da carga.
 *
 * Fica exportado para a migração e este módulo não divergirem: um teste
 * compara os dois textos.
 */
export function ddlDaMarca(tabela: string = TABELA_DA_MARCA): string {
  const esquema = tabela.includes(".") ? tabela.split(".")[0] : null;
  return (
    (esquema === null || esquema === undefined
      ? ""
      : `CREATE SCHEMA IF NOT EXISTS ${esquema};\n`) +
    `CREATE TABLE IF NOT EXISTS ${tabela} (\n` +
    "  id smallint PRIMARY KEY CHECK (id = 1),\n" +
    "  documento jsonb NOT NULL,\n" +
    "  atualizada_em timestamptz NOT NULL DEFAULT now()\n" +
    ");\n" +
    `ALTER TABLE ${tabela} ENABLE ROW LEVEL SECURITY;`
  );
}

/** O código SQLSTATE de um erro do driver, quando ele traz um. */
function codigoDe(erro: unknown): string | null {
  if (typeof erro !== "object" || erro === null) return null;
  const codigo = (erro as { code?: unknown }).code;
  return typeof codigo === "string" ? codigo : null;
}

/** O que a tela pode saber de um erro do banco: o código e a classe. */
function motivoDe(erro: unknown): string {
  const codigo = codigoDe(erro);
  const nome = erro instanceof Error ? erro.name : "erro";
  return codigo === null ? nome : `${nome} (${codigo})`;
}

/**
 * Só nomes que uma migração escreveria: `esquema.tabela`, letras minúsculas,
 * dígitos e sublinhado. O nome entra no texto da consulta, e por isso não
 * pode vir de fora sem esta conferência.
 */
const NOME_DE_TABELA = /^[a-z_][a-z0-9_]*(\.[a-z_][a-z0-9_]*)?$/;

export function criarArmazemEmPostgres(opcoes: {
  readonly cliente: ClientePostgres;
  /** Outra tabela, só para o teste isolar uma rodada da outra. */
  readonly tabela?: string;
}): ArmazemDaMarca {
  const { cliente } = opcoes;
  const tabela = opcoes.tabela ?? TABELA_DA_MARCA;
  if (!NOME_DE_TABELA.test(tabela)) {
    throw new Error(`Nome de tabela fora da forma: '${tabela}'.`);
  }

  /*
   * O DDL, memorizado por instância.
   *
   * Uma promessa, e não uma flag: duas gravações concorrentes na primeira
   * vez esperam a **mesma** aplicação do DDL, em vez de dispararem duas. Se a
   * aplicação falhar, a promessa é descartada e a próxima gravação tenta de
   * novo — falha transitória do banco não pode deixar a instância sem marca
   * para sempre.
   */
  let preparada: Promise<void> | null = null;
  function preparar(): Promise<void> {
    if (preparada === null) {
      preparada = cliente.consultar(ddlDaMarca(tabela)).then(
        () => undefined,
        (erro: unknown) => {
          preparada = null;
          throw erro;
        },
      );
    }
    return preparada;
  }

  return {
    ler: async () => {
      try {
        const linhas = await cliente.consultar<{ documento: unknown }>(
          `SELECT documento FROM ${tabela} WHERE id = 1`,
        );
        const documento = linhas[0]?.documento;
        // `jsonb` chega já como objeto pelo driver; um texto, se algum
        // adaptador o entregar assim, passa pelo mesmo leitor defensivo.
        if (typeof documento === "string") {
          try {
            return lerEstado(JSON.parse(documento));
          } catch {
            return ESTADO_VAZIO;
          }
        }
        return lerEstado(documento);
      } catch {
        // Tabela ausente, banco fora, permissão negada: para quem lê, tudo
        // isso é "não há marca", e a tela abre no tema padrão.
        return ESTADO_VAZIO;
      }
    },

    gravar: async (estado: EstadoDaMarca) => {
      try {
        await preparar();
        await cliente.consultar(
          `INSERT INTO ${tabela} (id, documento, atualizada_em)\n` +
            "VALUES (1, $1::jsonb, now())\n" +
            "ON CONFLICT (id) DO UPDATE\n" +
            "SET documento = EXCLUDED.documento, atualizada_em = now()",
          [JSON.stringify(estado)],
        );
      } catch (erro) {
        throw new FalhaAoGravarMarca(motivoDe(erro));
      }
    },

    limpar: async () => {
      try {
        await cliente.consultar(`DELETE FROM ${tabela} WHERE id = 1`);
      } catch (erro) {
        // Apagar o que já não existe é sucesso: o estado desejado é o estado.
        if (codigoDe(erro) === TABELA_INEXISTENTE) return;
        throw new FalhaAoGravarMarca(motivoDe(erro));
      }
    },
  };
}
