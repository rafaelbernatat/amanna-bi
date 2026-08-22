/**
 * Vazio explícito: recorte sem dado é estado, não zero (T-105).
 *
 * Princípio **PR-4** e regra 3 da seção 9.2 do PRD. É o princípio mais fácil de
 * violar sem perceber, porque zero é o valor que sai de graça — de uma soma de
 * lista vazia, de um `?? 0`, de uma média sem denominador. E zero mente: "a
 * área não teve desligamentos" e "não temos dado dessa área" viram o mesmo
 * número na tela, e ninguém consegue distinguir.
 *
 * Aqui o vazio carrega **motivo**, de enum fechado. A tela decide o que dizer a
 * partir dele (seção 6.4), e o motivo `fora_do_perfil` nunca vem acompanhado de
 * valor — nem agregado (seção 11).
 */

/** Por que não há valor. Enum fechado: acrescentar motivo é decisão, não acaso. */
export const MOTIVOS_DE_VAZIO = [
  "sem_dado_no_recorte",
  "grupo_pequeno",
  "fora_do_perfil",
  "fonte_indisponivel",
  "denominador_zero",
] as const;

export type MotivoDeVazio = (typeof MOTIVOS_DE_VAZIO)[number];

/** Um valor que existe. */
export type ComValor<T> = { readonly vazio: false; readonly valor: T };

/** Um valor que não existe, e a razão disso. */
export type Vazio = {
  readonly vazio: true;
  readonly motivo: MotivoDeVazio;
  /** Recorte mais amplo que teria dado, quando existe um (seção 6.4). */
  readonly ampliarPara?: string;
};

/**
 * O retorno de qualquer leitura da camada de dados.
 *
 * União discriminada de propósito: quem consome **precisa** olhar `vazio` antes
 * de chegar no valor. Um `number | null` deixaria `?? 0` compilar em silêncio,
 * que é exatamente o caminho pelo qual o zero volta.
 */
export type Talvez<T> = ComValor<T> | Vazio;

export function comValor<T>(valor: T): ComValor<T> {
  return { vazio: false, valor };
}

export function vazio(motivo: MotivoDeVazio, ampliarPara?: string): Vazio {
  return {
    vazio: true,
    motivo,
    ...(ampliarPara === undefined ? {} : { ampliarPara }),
  };
}

export function temValor<T>(t: Talvez<T>): t is ComValor<T> {
  return !t.vazio;
}

/**
 * O valor, ou lança.
 *
 * Existe para teste e para caminhos onde o vazio já foi tratado. Nunca use no
 * caminho de exibição: lá o vazio é estado a mostrar, não erro a engolir.
 */
export function exigirValor<T>(t: Talvez<T>): T {
  if (t.vazio) {
    throw new Error(
      `Esperava valor e veio vazio (${t.motivo}). Recorte vazio é estado, não exceção (PR-4).`,
    );
  }
  return t.valor;
}

/**
 * Divisão que não inventa número.
 *
 * Denominador zero devolve vazio com motivo **próprio**, e não `Infinity`,
 * `NaN` nem 0. A seção 13 do PRD é explícita: nunca há divisão por zero
 * visível.
 *
 * O motivo é `denominador_zero` e não `sem_dado_no_recorte` porque as duas
 * situações são diferentes na tela e diferentes para quem lê (T-182):
 *
 * - **sem dado no recorte** — a consulta é válida e não veio linha nenhuma.
 *   A leitura útil é "amplie o recorte".
 * - **denominador zero** — veio dado, e o divisor é zero. "Turnover da área
 *   com zero pessoas no quadro" tem numerador legítimo e nenhuma base sobre a
 *   qual dividir. Ampliar o recorte não resolve; o que a tela precisa dizer é
 *   *qual* divisor faltou.
 *
 * Colapsar os dois num motivo só faria a tela sugerir uma ação que não
 * funciona — e o pior tipo de mensagem de erro é a que manda tentar de novo o
 * que não vai dar certo.
 */
export function dividir(
  numerador: number,
  denominador: number,
  motivo: MotivoDeVazio = "denominador_zero",
): Talvez<number> {
  if (denominador === 0 || !Number.isFinite(denominador)) {
    return vazio(motivo);
  }
  // Numerador não finito não é divisão por zero: é dado corrompido chegando
  // do adaptador, e merece o motivo da fonte, não o do divisor.
  if (!Number.isFinite(numerador)) return vazio("fonte_indisponivel");
  return comValor(numerador / denominador);
}
