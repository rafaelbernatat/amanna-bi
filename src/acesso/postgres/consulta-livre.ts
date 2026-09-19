/**
 * A consulta do modelo, executada com as travas postas (T-450).
 *
 * O SQL chega aqui já conferido pelo lint (`sql-guarda.ts`) e sai embrulhado:
 *
 * ```sql
 * SELECT * FROM (
 * <sql do modelo>
 * ) AS resultado LIMIT $1
 * ```
 *
 * Duas propriedades caem desse embrulho, e valem mais que qualquer regex:
 *
 * 1. **Um comando só.** O parâmetro `$1` obriga o protocolo estendido, em que
 *    o Postgres recusa mais de um comando por instrução. E, mesmo no protocolo
 *    simples, `;`, `SET`, `COPY` e todo DDL são erro de sintaxe dentro de uma
 *    subconsulta.
 * 2. **Um teto de linhas**, que é o que entra no prompt e na bolha.
 *
 * A quebra de linha antes do `)` é deliberada: sem ela, um `-- comentário` no
 * fim do SQL do modelo comentaria o fecho do embrulho.
 *
 * `LIMIT` limita **o envelope, não o trabalho**: uma auto-junção de 128 mil
 * linhas queima CPU até o `statement_timeout`, que é o único teto de verdade.
 * Quem for "otimizar" o tempo depois, leia isto antes.
 */

import { clienteDoChat } from "@/acesso/postgres/cliente-chat";
import { conferirConsulta } from "@/acesso/postgres/sql-guarda";
import type { AccessScope } from "@/seguranca/identidade";

/** Quantas linhas voltam para o prompt e para a bolha. */
export const TETO_DE_LINHAS = 25;
/** Quantas colunas, para a linha caber na bolha e no prompt. */
export const TETO_DE_COLUNAS = 6;
/** Quanto tempo o banco tem. O papel também o impõe; isto é a segunda linha. */
export const TEMPO_MAXIMO_MS = 5_000;

export class ConsultaRecusada extends Error {
  constructor(readonly motivo: string) {
    super(motivo);
    this.name = "ConsultaRecusada";
  }
}

export type ResultadoDaConsulta = {
  readonly colunas: readonly string[];
  /** As linhas como vieram do banco: números ainda são números. */
  readonly linhas: readonly Readonly<Record<string, unknown>>[];
  /** Veio mais do que o teto, e a lista foi cortada. */
  readonly truncado: boolean;
};

/**
 * O escopo como três listas de códigos.
 *
 * É a única interpolação de texto de toda a porta, e ela é de três enums
 * fechados. A conferência acontece aqui, imediatamente antes: um código com
 * vírgula ou aspa não existe no vocabulário, e se um dia existir, esta função
 * recusa em vez de montar SQL com ele.
 */
function codigos(valores: readonly string[]): string {
  for (const v of valores) {
    if (!/^[a-z0-9-]+$/.test(v)) {
      throw new ConsultaRecusada(`código de escopo inesperado: '${v}'`);
    }
  }
  return valores.join(",");
}

/**
 * Executa a consulta do modelo pela conexão do chat.
 *
 * Lança `ConsultaRecusada` no que o lint barra e no que o banco recusa — as
 * duas viram `{ "erro": … }` para o modelo, que tenta de novo dentro do laço.
 */
export async function consultarLivre(
  sql: string,
  escopo: AccessScope,
): Promise<ResultadoDaConsulta> {
  const recusa = conferirConsulta(sql);
  if (recusa !== null) throw new ConsultaRecusada(recusa.motivo);

  const entidades = codigos(escopo.entidades);
  const areas = codigos(escopo.areas);
  const modulos = codigos(escopo.modulos);

  const linhas = await clienteDoChat().transacao(async (t) => {
    // Primeiro a transação somente-leitura: depois dela, nada escreve.
    await t.consultar("SET TRANSACTION READ ONLY");
    /*
     * O `search_path`, e não é detalhe: é a linha que faz a consulta funcionar.
     *
     * A instrução manda o modelo escrever `FROM lancamento`, sem o nome do
     * esquema. Isso dependia do `ALTER ROLE amanna_chat_ro SET search_path`,
     * que só vale quando a conexão entra por aquele papel. Quando
     * `DATABASE_URL_CHAT` virou opcional (protótipo, base fictícia), a conexão
     * passou a ser a de sempre — `search_path = public` —, e **toda** consulta
     * do modelo passou a morrer com "relation does not exist". O laço tentava
     * de novo, queimava as rodadas e degradava sem texto: era este o "não pôde
     * ser respondida" dos prints de Produto.
     *
     * Posto aqui, vale para as duas conexões, e o papel deixa de ser a única
     * coisa que sustenta a sintaxe que o prompt ensina.
     */
    await t.consultar("SET LOCAL search_path = amanna_chat, pg_catalog");
    await t.consultar(
      `SET LOCAL statement_timeout = ${String(TEMPO_MAXIMO_MS)}`,
    );
    await t.consultar(
      `SET LOCAL idle_in_transaction_session_timeout = ${String(TEMPO_MAXIMO_MS * 2)}`,
    );
    /*
     * O escopo do perfil, como GUC. `SET` é o comando, e não `set_config`: a
     * função está revogada na migração 012, e o comando é erro de sintaxe
     * dentro do embrulho — o modelo não tem como tocá-lo.
     */
    await t.consultar(`SET LOCAL amanna.escopo_entidades = '${entidades}'`);
    await t.consultar(`SET LOCAL amanna.escopo_areas = '${areas}'`);
    await t.consultar(`SET LOCAL amanna.escopo_modulos = '${modulos}'`);

    return t.consultar<Record<string, unknown>>(
      `SELECT * FROM (\n${sql}\n) AS resultado LIMIT $1`,
      [TETO_DE_LINHAS + 1],
    );
  });

  const truncado = linhas.length > TETO_DE_LINHAS;
  const cortadas = truncado ? linhas.slice(0, TETO_DE_LINHAS) : linhas;
  const colunas = Object.keys(cortadas[0] ?? {});
  if (colunas.length > TETO_DE_COLUNAS) {
    throw new ConsultaRecusada(
      `a consulta devolveu ${String(colunas.length)} colunas; escolha até ${String(TETO_DE_COLUNAS)} no SELECT`,
    );
  }
  return { colunas, linhas: cortadas, truncado };
}
