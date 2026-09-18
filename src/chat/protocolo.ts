/**
 * O que atravessa a rede entre o chat na tela e a rota `/api/chat`.
 *
 * Só tipos e dois limites. Este arquivo é importado pelo componente de cliente
 * e pela rota do servidor, e por isso não importa nada que leia dado: o que o
 * navegador recebe é o que a rota decide mandar, e o que a rota recebe é o que
 * este contrato descreve.
 *
 * ## A resposta chega em duas fases
 *
 * Os estágios 1 e 2 levam décimos de segundo sem gateway e poucos segundos com
 * ele; o estágio 3 leva de 15 a 30 segundos. A rota escreve uma linha de JSON
 * por fase (NDJSON): a **prévia** assim que o número existe — rótulo, valor e
 * as ações de tela —, e a **resposta** quando o texto passa pelo verificador.
 * O chat aplica o recorte e destaca o painel na prévia, e a pessoa vê o gráfico
 * enquanto o modelo ainda escreve (T-339, primeira metade).
 */

import type { TurnoAnterior } from "@/chat/interpretar";
import type { Resposta } from "@/chat/perguntar";
import type { Resolucao } from "@/chat/resolver";
import type { PanelResponse, Unidade } from "@/semantica/contrato";

/** Acima disto a rota recusa a pergunta: é limite de custo, não de conteúdo. */
export const TAMANHO_MAXIMO_DA_PERGUNTA = 500;

/** Quantos turnos anteriores viajam com a pergunta. */
export const TURNOS_LEMBRADOS = 6;

/** Quantas perguntas um convidado do QR pode fazer (D-CONVIDADO-cadastro). */
export const PERGUNTAS_POR_CONVIDADO = 5;

/** O cabeçalho que diz quantas perguntas restam, em toda resposta admitida. */
export const CABECALHO_DE_PERGUNTAS_RESTANTES = "x-perguntas-restantes";

/** Quantas restam, dado quantas já foram admitidas. Nunca negativo. */
export function perguntasRestantes(usadas: number): number {
  return Math.max(0, PERGUNTAS_POR_CONVIDADO - usadas);
}

/** O que o chat manda. */
export type PedidoDeChat = {
  readonly pergunta: string;
  /** A busca da URL da tela, como está: a rota a lê com o mesmo leitor da página. */
  readonly busca: string;
  /**
   * A tela aberta, como `modulo/tela`, ou `null` fora de uma tela.
   *
   * Com a busca, é o contexto da pergunta (D-CHAT-ferramentas): a rota valida
   * contra o inventário, e "o que esse gráfico mostra?" só existe porque a
   * tela e o painel em foco chegam junto.
   */
  readonly tela: string | null;
  readonly historico: readonly TurnoAnterior[];
};

/** O número resolvido, antes do texto (estágio 2 concluído). */
export type Previa = {
  readonly metrica: string;
  readonly rotulo: string;
  readonly valor: number | null;
  readonly unidade: Unidade;
  readonly acoes: Resolucao["acoes"];
  /**
   * O painel que a resposta destaca, para a conversa desenhá-lo antes do
   * texto (T-351). É o mesmo envelope que a tela desenha; a bolha do chat
   * não relê nada.
   */
  readonly painel: PanelResponse | null;
};

/**
 * Por que não houve resposta. Sem detalhe de erro: o que o navegador precisa
 * é escolher a frase da seção 6.4, e não ler a pilha de uma exceção.
 */
export type MotivoDeFalha =
  | "sem_permissao"
  | "erro_de_fonte"
  /** O limite de uso da apresentação segurou a pergunta (D-CONVITE). */
  | "limite_de_uso"
  /** O convite venceu no meio da conversa. */
  | "sessao_expirada"
  /** O convidado do QR já fez as suas perguntas (D-CONVIDADO-cadastro). */
  | "limite_de_perguntas"
  /** O convidado do QR ainda não disse quem é. */
  | "sem_cadastro";

/** O corpo de uma recusa por status, quando a conversa precisa distinguir. */
export type CorpoDeRecusa = {
  readonly erro: string;
  readonly motivo?: MotivoDeFalha | string;
};

/**
 * Uma linha do fluxo NDJSON, na ordem em que podem chegar.
 *
 * `andamento` é o que o laço de ferramentas conta enquanto lê (T-434): uma
 * frase determinística por leitura, sem número. Só existe com gateway; sem
 * ele as fases continuam sendo prévia e resposta.
 */
export type LinhaDoFluxo =
  | { readonly fase: "andamento"; readonly passo: string }
  | { readonly fase: "previa"; readonly previa: Previa }
  | { readonly fase: "resposta"; readonly resposta: Resposta }
  | { readonly fase: "falha"; readonly motivo: MotivoDeFalha };
