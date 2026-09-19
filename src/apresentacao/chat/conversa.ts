/**
 * O estado da conversa, sem React (T-340 em parte).
 *
 * O componente de chat guarda uma `Conversa` e a desenha. As regras sobre ela —
 * o que vira histórico para o servidor, o que sobrevive a um recarregamento,
 * para onde a tela vai depois de uma resposta — são funções puras aqui, e é
 * aqui que os testes as exercitam sem navegador.
 *
 * ## Por que a conversa mora no navegador, e o recorte na URL
 *
 * A seção 6.6 promete que **filtros, tela e painel destacado** vivem na URL,
 * e é isso que o chat escreve nela quando responde. A conversa em si não vai
 * para a URL: uma conversa de dez turnos não cabe num link legível, e o que a
 * pessoa compartilha é a tela que a resposta abriu — que reproduz o número
 * para quem tem o mesmo perfil, sem precisar do texto. A conversa fica em
 * `sessionStorage`: sobrevive a recarregar e a navegar entre telas, e morre
 * com a aba, que é o tempo de vida que uma conversa de análise tem.
 */

import type { TurnoAnterior } from "@/chat/interpretar";
import { mesDoRotulo } from "@/chat/mes";
import type { Resposta } from "@/chat/perguntar";
import type { Resolucao } from "@/chat/resolver";
import type { MotivoDeFalha, Previa } from "@/chat/protocolo";
import { TURNOS_LEMBRADOS } from "@/chat/protocolo";
import type { Query } from "@/semantica/contrato";
import { rotaCom } from "@/semantica/url";

/**
 * Uma pergunta e o que veio dela.
 *
 * Os quatro estados são os da resposta em duas fases: `consultando` até o
 * número existir, `redigindo` com o número na mão e o texto a caminho,
 * `pronta` com o texto conferido, `falhou` quando a rota disse por quê.
 */
export type Turno = {
  readonly id: string;
  readonly pergunta: string;
  /** A URL (caminho e busca) em que a pergunta foi feita: é para onde "desfazer" volta. */
  readonly origem: string;
  readonly estado: "consultando" | "redigindo" | "pronta" | "falhou";
  readonly previa: Previa | null;
  readonly resposta: Resposta | null;
  /** `rede` é do navegador: a rota não respondeu. Os outros vêm dela. */
  readonly falha: MotivoDeFalha | "rede" | null;
  /** O que o laço está lendo agora, enquanto a resposta não chega (T-434). */
  readonly passo?: string | undefined;
};

export type Conversa = {
  readonly aberto: boolean;
  readonly turnos: readonly Turno[];
};

export const CONVERSA_VAZIA: Conversa = { aberto: false, turnos: [] };

/** A chave em `sessionStorage`. A versão muda quando a forma muda. */
export const CHAVE_DE_ARMAZENAMENTO = "amanna-bi.chat.v1";

/* ------------------------------------------------------------------ *
 * O que vai para o servidor
 * ------------------------------------------------------------------ */

/**
 * Os turnos anteriores, como o estágio 1 os vê: pergunta e métrica.
 *
 * Só turnos com resposta. Uma recusa entra como `metrica: null` — o modelo
 * precisa saber que aquela pergunta não teve métrica, senão "e em dezembro?"
 * depois de uma recusa herdaria a resposta de antes dela.
 */
/** Quantos rótulos de linha bastam para dizer de que a resposta falou. */
const ROTULOS_NO_ASSUNTO = 3;

/**
 * De que a resposta falou, para o próximo turno herdar o fio (T-454).
 *
 * Só rótulos: as colunas da consulta e os primeiros nomes de linha. **Nunca
 * número** — o histórico não leva valor, porque cada um renasce e é conferido
 * de novo a cada turno (RF-15). `null` quando a resposta tem métrica, que é o
 * caso em que a métrica já diz o assunto.
 */
function assuntoDe(resolucao: Resolucao): string | null {
  if (resolucao.metrica !== "") return null;
  for (const { leitura } of resolucao.leituras) {
    if (leitura.tipo !== "consulta") continue;
    const colunas = leitura.colunas.map((c) => c.nome).join(", ");
    const rotulos = leitura.linhas
      .slice(0, ROTULOS_NO_ASSUNTO)
      .map((l) => l.rotulo)
      .filter((r) => r !== "");
    const exemplos = rotulos.length === 0 ? "" : ` (${rotulos.join(", ")}…)`;
    return `consulta ao banco: ${colunas}${exemplos}`;
  }
  return null;
}

export function historicoDe(
  turnos: readonly Turno[],
): readonly TurnoAnterior[] {
  return turnos
    .filter((t) => t.resposta !== null)
    .map((t) => {
      const resolucao =
        t.resposta?.tipo === "resposta" ? t.resposta.resolucao : null;
      // O contexto que a resposta carregava, para a próxima pergunta herdar
      // (T-443). Turno guardado antes disto não tem ponto pedido: `undefined`.
      const rotuloDoPonto = resolucao?.pontoPedido?.rotulo;
      const mes =
        rotuloDoPonto === undefined ? null : mesDoRotulo(rotuloDoPonto);
      const assunto = resolucao === null ? null : assuntoDe(resolucao);
      return {
        pergunta: t.pergunta,
        // Resolução sem métrica (T-454) vem de consulta: `metrica` é "".
        metrica:
          resolucao === null || resolucao.metrica === ""
            ? null
            : resolucao.metrica,
        ...(mes === null ? {} : { mes }),
        ...(resolucao === null ? {} : { filtros: resolucao.acoes.filtros }),
        // Só quando há: uma resposta do catálogo já diz o assunto na métrica.
        ...(assunto === null ? {} : { assunto }),
      };
    })
    .slice(-TURNOS_LEMBRADOS);
}

/* ------------------------------------------------------------------ *
 * Para onde a tela vai
 * ------------------------------------------------------------------ */

/**
 * A URL que uma resposta pede (RF-13): a tela citada, o recorte da resposta
 * e o painel a destacar. Sem tela citada, a tela atual com o recorte novo.
 */
export function destinoDe(acoes: Previa["acoes"], rotaAtual: string): string {
  return rotaCom(
    acoes.tela ?? rotaAtual,
    acoes.filtros,
    acoes.painel ?? undefined,
  );
}

/** Os filtros da resposta que diferem do padrão, para os chips de "ações aplicadas". */
export function filtrosAplicados(
  filtros: Query,
  padrao: Query,
): readonly (keyof Query)[] {
  return (Object.keys(padrao) as (keyof Query)[]).filter(
    (campo) => filtros[campo] !== padrao[campo],
  );
}

/* ------------------------------------------------------------------ *
 * O fluxo NDJSON
 * ------------------------------------------------------------------ */

/**
 * Separa as linhas completas do que ainda está chegando.
 *
 * Um pedaço da rede pode terminar no meio de um JSON; a última linha só é
 * inteira quando termina em quebra. O resto volta para o chamador juntar ao
 * próximo pedaço.
 */
export function separarLinhas(buffer: string): {
  readonly completas: readonly string[];
  readonly resto: string;
} {
  const partes = buffer.split("\n");
  const resto = partes.pop() ?? "";
  return { completas: partes.filter((l) => l.trim() !== ""), resto };
}

/* ------------------------------------------------------------------ *
 * Sobreviver ao recarregamento
 * ------------------------------------------------------------------ */

const VERSAO = 1;

export function serializar(conversa: Conversa): string {
  return JSON.stringify({ versao: VERSAO, ...conversa });
}

const ESTADOS_TERMINAIS: ReadonlySet<Turno["estado"]> = new Set([
  "pronta",
  "falhou",
]);

/**
 * Lê uma conversa guardada. `null` para qualquer coisa que não seja uma.
 *
 * Turno que ficou a meio — a aba fechou com o modelo escrevendo — não volta:
 * não há como retomar a chamada, e um "consultando…" eterno seria pior que a
 * ausência. A pergunta continua no histórico das outras.
 */
export function desserializar(texto: string | null): Conversa | null {
  if (texto === null || texto === "") return null;
  try {
    const bruto: unknown = JSON.parse(texto);
    if (typeof bruto !== "object" || bruto === null) return null;
    const objeto = bruto as Record<string, unknown>;
    if (objeto["versao"] !== VERSAO || !Array.isArray(objeto["turnos"])) {
      return null;
    }
    const turnos = (objeto["turnos"] as unknown[]).filter(
      (t): t is Turno =>
        typeof t === "object" &&
        t !== null &&
        typeof (t as Turno).id === "string" &&
        typeof (t as Turno).pergunta === "string" &&
        ESTADOS_TERMINAIS.has((t as Turno).estado),
    );
    return { aberto: objeto["aberto"] === true, turnos };
  } catch {
    return null;
  }
}
