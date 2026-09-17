/**
 * Os limites de uso do chat numa apresentação (D-CONVITE-apresentacao,
 * mínimo de T-344).
 *
 * Cinquenta pessoas com o celular na mão e um botão que chama um modelo por
 * pergunta é uma conta que cresce sozinha. Três limites, todos por instância:
 *
 * 1. **Por dispositivo, por minuto.** Uma janela deslizante — o celular que
 *    perguntou seis vezes no último minuto espera. É o que impede uma pessoa
 *    sozinha de ocupar a fila da sala.
 *
 *    Só vale para quem entrou pelo QR. O sujeito de um convite **é** um
 *    celular: um por pessoa, sorteado no servidor. Nos outros modos o sujeito
 *    é uma pessoa da empresa (`oidc`) ou um perfil escolhido por variável de
 *    ambiente (`fixtures`, em que todo mundo compartilha o mesmo sujeito — e
 *    onde uma janela por sujeito mediria a suíte de testes, não a pessoa). O
 *    limite por usuário identificado é outra decisão, e continua em T-344.
 * 2. **Concorrência por instância.** Um semáforo: acima dele, a pergunta é
 *    recusada com "muita gente perguntando ao mesmo tempo" em vez de entrar
 *    numa fila que estoura o tempo limite da função.
 * 3. **Tokens por sala, por dia.** O teto de custo da apresentação inteira.
 *
 * ## Por instância, e isso está declarado
 *
 * Na Vercel, cinquenta pessoas cabem em uma a três instâncias; cada uma conta
 * o seu. O limite efetivo é, portanto, o triplo do escrito no pior caso. A
 * alternativa — contar no Postgres — acrescenta uma escrita por pergunta ao
 * caminho mais quente, e o que se está protegendo é custo de modelo, não
 * correção de número. Uma tabela `amanna.chat_uso` fica registrada como opção
 * (T-363) para quando o limite precisar ser exato.
 *
 * Puro: recebe o instante, não lê relógio. É o que permite ao teste cobrir a
 * virada do minuto e a do dia sem esperar.
 */

import { ehDispositivoDeApresentacao } from "@/seguranca/convite";

/** Quantas perguntas por dispositivo, por minuto. */
export const PERGUNTAS_POR_MINUTO = 6;

/** Quantas perguntas ao mesmo tempo, por instância. */
export const CONCORRENCIA_MAXIMA = 32;

/** Quantos tokens uma sala gasta por dia civil. */
export const TETO_DE_TOKENS_POR_DIA = 1_500_000;

/** A janela do limite por dispositivo. */
const JANELA_MS = 60_000;

/** Por que uma pergunta não entrou. */
export const MOTIVOS_DE_LIMITE = [
  "por_minuto",
  "concorrencia",
  "tokens",
] as const;
export type MotivoDeLimite = (typeof MOTIVOS_DE_LIMITE)[number];

export type Admissao =
  | { readonly ok: true; readonly liberar: () => void }
  | {
      readonly ok: false;
      readonly motivo: MotivoDeLimite;
      /** Quantos segundos até valer a pena tentar de novo. */
      readonly tentarEmSegundos: number;
    };

export type Limites = {
  readonly porMinuto: number;
  readonly concorrencia: number;
  readonly tokensPorDia: number;
};

/** Os limites do ambiente, com os padrões quando ele não diz. */
export function limitesDoAmbiente(
  ambiente: Record<string, string | undefined> = process.env,
): Limites {
  const numero = (nome: string, padrao: number): number => {
    const bruto = ambiente[nome];
    if (bruto === undefined || bruto.trim() === "") return padrao;
    const lido = Number(bruto);
    return Number.isFinite(lido) && lido > 0 ? Math.floor(lido) : padrao;
  };
  return {
    porMinuto: numero("CHAT_LIMITE_POR_MINUTO", PERGUNTAS_POR_MINUTO),
    concorrencia: numero("CHAT_CONCORRENCIA_MAXIMA", CONCORRENCIA_MAXIMA),
    tokensPorDia: numero("CHAT_TETO_DE_TOKENS_POR_DIA", TETO_DE_TOKENS_POR_DIA),
  };
}

/** O dia civil de um instante, em UTC. Sala e teto viram por aqui. */
function diaDe(agoraMs: number): string {
  return new Date(agoraMs).toISOString().slice(0, 10);
}

export type ControleDeUso = {
  /** Deixa a pergunta entrar, ou diz por que não. */
  admitir(sujeito: string, sala: string, agoraMs: number): Admissao;
  /** Soma os tokens que a pergunta consumiu, para o teto da sala. */
  registrarTokens(sala: string, tokens: number, agoraMs: number): void;
  /** Só para teste e para o painel interno: quanto a sala já gastou hoje. */
  tokensDaSala(sala: string, agoraMs: number): number;
};

export function criarControleDeUso(
  limites: Limites = limitesDoAmbiente(),
): ControleDeUso {
  const janelas = new Map<string, number[]>();
  const tokens = new Map<string, number>();
  let emVoo = 0;

  return {
    admitir(sujeito, sala, agoraMs) {
      const gasto = tokens.get(`${sala}|${diaDe(agoraMs)}`) ?? 0;
      if (gasto >= limites.tokensPorDia) {
        // O dia vira: dizer "amanhã" é honesto, e o número em segundos é o
        // que o cabeçalho de repetição precisa.
        const amanha = Date.UTC(
          new Date(agoraMs).getUTCFullYear(),
          new Date(agoraMs).getUTCMonth(),
          new Date(agoraMs).getUTCDate() + 1,
        );
        return {
          ok: false,
          motivo: "tokens",
          tentarEmSegundos: Math.ceil((amanha - agoraMs) / 1000),
        };
      }

      /*
       * A janela por minuto só conta para celular de apresentação: ver o
       * cabeçalho. Para os demais sujeitos, o que segura é a concorrência.
       */
      const porDispositivo = ehDispositivoDeApresentacao(sujeito);
      const recentes = (janelas.get(sujeito) ?? []).filter(
        (quando) => agoraMs - quando < JANELA_MS,
      );
      if (porDispositivo && recentes.length >= limites.porMinuto) {
        const maisAntiga = recentes[0] ?? agoraMs;
        return {
          ok: false,
          motivo: "por_minuto",
          tentarEmSegundos: Math.max(
            1,
            Math.ceil((JANELA_MS - (agoraMs - maisAntiga)) / 1000),
          ),
        };
      }

      if (emVoo >= limites.concorrencia) {
        return { ok: false, motivo: "concorrencia", tentarEmSegundos: 5 };
      }

      if (porDispositivo) {
        recentes.push(agoraMs);
        janelas.set(sujeito, recentes);
      }
      emVoo += 1;
      let liberado = false;
      return {
        ok: true,
        liberar: () => {
          // Idempotente: um `finally` que rode duas vezes não pode abrir vaga
          // que não existe.
          if (liberado) return;
          liberado = true;
          emVoo -= 1;
        },
      };
    },

    registrarTokens(sala, quantos, agoraMs) {
      const chave = `${sala}|${diaDe(agoraMs)}`;
      tokens.set(chave, (tokens.get(chave) ?? 0) + Math.max(0, quantos));
    },

    tokensDaSala(sala, agoraMs) {
      return tokens.get(`${sala}|${diaDe(agoraMs)}`) ?? 0;
    },
  };
}

/**
 * O controle do processo.
 *
 * No escopo global, como o cliente do banco e a conversa em memória: o
 * servidor empacota cada rota à parte, e uma variável de módulo daria um
 * controle por pedaço — isto é, limite nenhum.
 */
const CHAVE = Symbol.for("amanna-bi.chat.uso");
type Portador = { [CHAVE]?: ControleDeUso };

export function controleDoProcesso(): ControleDeUso {
  const portador = globalThis as unknown as Portador;
  portador[CHAVE] ??= criarControleDeUso();
  return portador[CHAVE];
}

/** Só para teste: devolve o processo ao estado limpo. */
export function esquecerControleDoProcesso(): void {
  delete (globalThis as unknown as Portador)[CHAVE];
}
