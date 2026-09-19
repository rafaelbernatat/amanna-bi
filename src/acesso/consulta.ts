/**
 * A porta da consulta livre: sessão, escopo e módulo antes do banco (T-450).
 *
 * É a única coisa que `src/chat/` importa desta capacidade, e existe pela
 * mesma razão que `leitura.ts` existe: a cadeia se monta **aqui**, no
 * servidor, antes de qualquer coisa tocar a fonte. O chat não conhece
 * `DATABASE_URL_CHAT`, não conhece o papel e não monta escopo.
 *
 * ```
 * pergunta  →  getSession        quem está perguntando
 *           →  escopoDaSessao    o que essa pessoa pode ver
 *           →  consultarLivre    GUC de escopo + embrulho + papel restrito
 * ```
 *
 * ## Por que o escopo vai como GUC, e não como filtro no resultado
 *
 * A consulta do modelo agrega, e a coluna de recorte pode nem estar na saída:
 * `SELECT SUM(custo_total_empresa) FROM folha` não tem onde receber um
 * "só a área tecnologia". O filtro tem de acontecer **na fonte**, e é isso que
 * as views de `amanna_chat` fazem, chamando `no_escopo` com o que as GUCs
 * dizem. Fail-closed: GUC ausente, nenhuma linha.
 */

import {
  consultarLivre,
  ConsultaRecusada,
  type ResultadoDaConsulta,
} from "@/acesso/postgres/consulta-livre";
import {
  clienteDoChat,
  consultaLivreConfigurada,
} from "@/acesso/postgres/cliente-chat";
import { getSession } from "@/acesso/sessao";
import { escopoDaSessao } from "@/seguranca/identidade";

export { ConsultaRecusada } from "@/acesso/postgres/consulta-livre";
export type { ResultadoDaConsulta } from "@/acesso/postgres/consulta-livre";
export {
  TETO_DE_LINHAS,
  TETO_DE_COLUNAS,
} from "@/acesso/postgres/consulta-livre";

/**
 * A capacidade está disponível nesta instalação?
 *
 * Exige o warehouse **e** a conexão do chat. Em `fixtures` não há motor de SQL
 * e não deve haver: um motor falso faria "funciona com fixtures" significar
 * outra coisa, que é exatamente o que `fabrica.ts` existe para impedir.
 */
export function consultaDisponivel(
  ambiente: Record<string, string | undefined> = process.env,
): boolean {
  return (
    ambiente["DATA_SOURCE"] === "warehouse" &&
    consultaLivreConfigurada(ambiente)
  );
}

/** Uma coluna, como o dicionário de `amanna_chat` a declara. */
export type ColunaDoDicionario = {
  readonly objeto: string;
  readonly coluna: string;
  readonly ordem: number;
  readonly unidade: string | null;
  readonly descricao: string | null;
};

const DICIONARIO = Symbol.for("amanna-bi.chat.dicionario");
type PortadorDoDicionario = {
  [DICIONARIO]?: readonly ColunaDoDicionario[];
};

/**
 * O dicionário do esquema, uma vez por processo.
 *
 * Serve a duas coisas: dizer ao modelo o que existe para consultar, e dizer ao
 * nosso código a **unidade** de cada coluna, que é como um `4329.15` vira
 * `R$ 4.329,15` sem o modelo escrever o símbolo.
 *
 * É tabela semeada, e não `information_schema`: a seção 7.4 exige prefixo de
 * prompt byte-estável, e a ordem do catálogo do Postgres muda sem avisar — o
 * cache cairia em silêncio, que é o defeito que a seção nomeia.
 */
export async function dicionarioDoChat(): Promise<
  readonly ColunaDoDicionario[]
> {
  const portador = globalThis as unknown as PortadorDoDicionario;
  const guardado = portador[DICIONARIO];
  if (guardado !== undefined) return guardado;
  if (!consultaDisponivel()) return [];

  /*
   * Vazio quando o esquema não existe, e **não** exceção.
   *
   * A migração 012 não viaja com o deploy: o código sobe pela Vercel, a view
   * sobe pelo banco, e entre um e outro há uma janela em que `amanna_chat`
   * não existe. Sem este `catch`, essa janela derrubava toda pergunta
   * composta — o laço nem saía, e a rota respondia "erro de fonte".
   *
   * Dicionário vazio desliga a ferramenta (`consultaLigada`), e o chat
   * responde pelas oito fechadas, que é exatamente o que ele fazia antes
   * desta capacidade existir.
   */
  const linhas = await clienteDoChat()
    .consultar<ColunaDoDicionario>(
      `SELECT objeto, coluna, ordem, unidade, descricao
       FROM amanna_chat.dicionario ORDER BY objeto, ordem, coluna`,
    )
    .catch(() => []);
  portador[DICIONARIO] = linhas;
  return linhas;
}

/**
 * A consulta está ligada **de verdade** nesta instalação?
 *
 * `consultaDisponivel` diz que há banco; isto diz que o banco tem o esquema.
 * É o que separa "configurado" de "funcionando", e é por isto que a
 * ferramenta só é oferecida ao modelo depois de o dicionário responder.
 */
export async function consultaLigada(): Promise<boolean> {
  return (await dicionarioDoChat()).length > 0;
}

/** Só para teste: esquece o dicionário guardado. */
export function esquecerDicionario(): void {
  delete (globalThis as unknown as PortadorDoDicionario)[DICIONARIO];
}

/** Lê o que a consulta pede, pelo escopo de quem perguntou. */
export async function consultar(sql: string): Promise<ResultadoDaConsulta> {
  if (!consultaDisponivel()) {
    throw new ConsultaRecusada(
      "consulta livre indisponível nesta instalação; use as ferramentas do catálogo",
    );
  }
  const sessao = await getSession();
  return consultarLivre(sql, escopoDaSessao(sessao));
}
