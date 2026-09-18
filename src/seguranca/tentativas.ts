/**
 * O limite de tentativas da porta por senha (D-CONVITE-apresentacao).
 *
 * Uma senha compartilhada sem limite de tentativas é uma senha que se chuta.
 * Este controle é o que transforma "oito caracteres" em algo defensável: o
 * atacante não tem milhões de tentativas por minuto, tem seis.
 *
 * ## Por endereço, e o que isso não cobre
 *
 * A janela conta por endereço de origem. Não impede um adversário com muitos
 * endereços, e não pretende: contra isso o que vale é o tamanho da senha e o
 * prazo curto da apresentação. Impede o caso comum, que é alguém com o
 * endereço do painel numa aba e um dicionário.
 *
 * ## Por instância, como os limites do chat
 *
 * O estado vive na memória do processo. Na Vercel, cinquenta pessoas cabem em
 * uma a três instâncias, e cada uma conta a sua — o limite efetivo é até o
 * triplo do escrito. Contar no Postgres acrescentaria uma escrita a cada
 * tentativa, inclusive às falhas, e é exatamente o caminho que um atacante
 * controla. Fica por instância de propósito; a mesma decisão de
 * `src/chat/limite.ts`.
 */

/** Quantas tentativas por endereço, por janela. */
export const TENTATIVAS_POR_JANELA = 6;

/** O tamanho da janela deslizante. */
export const JANELA_MS = 60_000;

export type ControleDeTentativas = {
  /** Registra uma tentativa. `false` quando o endereço já passou do limite. */
  admitir(origem: string, agoraMs: number): boolean;
  /** Apaga o histórico de um endereço: chamado quando a senha acerta. */
  esquecer(origem: string): void;
};

export function criarControleDeTentativas(
  opcoes: {
    readonly porJanela?: number;
    readonly janelaMs?: number;
  } = {},
): ControleDeTentativas {
  const porJanela = opcoes.porJanela ?? TENTATIVAS_POR_JANELA;
  const janelaMs = opcoes.janelaMs ?? JANELA_MS;
  const janelas = new Map<string, number[]>();

  return {
    admitir(origem, agoraMs) {
      const recentes = (janelas.get(origem) ?? []).filter(
        (quando) => agoraMs - quando < janelaMs,
      );
      if (recentes.length >= porJanela) {
        janelas.set(origem, recentes);
        return false;
      }
      recentes.push(agoraMs);
      janelas.set(origem, recentes);
      return true;
    },
    esquecer(origem) {
      janelas.delete(origem);
    },
  };
}

/*
 * O controle do processo.
 *
 * Um por instância, guardado num símbolo global para sobreviver ao recarregar
 * de módulo do desenvolvimento — sem isso, cada edição zeraria a contagem e o
 * limite não existiria onde ele é testado à mão.
 */
const CHAVE = Symbol.for("amanna-bi.tentativas-de-senha");

type Deposito = { [CHAVE]?: ControleDeTentativas };

export function controleDeTentativasDoProcesso(): ControleDeTentativas {
  const deposito = globalThis as Deposito;
  deposito[CHAVE] ??= criarControleDeTentativas();
  return deposito[CHAVE];
}

/** Só teste: devolve o processo ao estado limpo. */
export function esquecerControleDeTentativas(): void {
  delete (globalThis as Deposito)[CHAVE];
}
