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
 * Denominador zero devolve vazio com motivo, e não `Infinity`, `NaN` nem 0.
 * A seção 13 do PRD é explícita: nunca há divisão por zero visível.
 */
export function dividir(
  numerador: number,
  denominador: number,
  motivo: MotivoDeVazio = "sem_dado_no_recorte",
): Talvez<number> {
  if (denominador === 0 || !Number.isFinite(denominador)) {
    return vazio(motivo);
  }
  if (!Number.isFinite(numerador)) return vazio(motivo);
  return comValor(numerador / denominador);
}
