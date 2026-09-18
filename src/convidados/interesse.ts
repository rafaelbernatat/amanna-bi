/**
 * O convite da Dreamy e o registro de quem clicou (D-CONVIDADO-cadastro,
 * T-426, T-427).
 *
 * Puro: o chat (cliente) e a rota (servidor) leem daqui o mesmo endereço, o
 * mesmo texto e a mesma forma de id.
 */

/** Para onde o convite leva. */
export const SITE_DA_DREAMY = "https://www.dreamy.app.br";

/** O que o diálogo diz, nas palavras que Produto pediu. */
export const PERGUNTA_DO_CONVITE = "Gostou desta solução?";
export const CHAMADA_DO_CONVITE =
  "Clique aqui e saiba como aplicar na sua empresa";

/** O que abriu o convite: a sexta pergunta, ou o relógio. */
export const ORIGENS_DE_INTERESSE = ["limite", "expiracao"] as const;
export type OrigemDoInteresse = (typeof ORIGENS_DE_INTERESSE)[number];

export function origemValida(
  candidata: string,
): candidata is OrigemDoInteresse {
  return (ORIGENS_DE_INTERESSE as readonly string[]).includes(candidata);
}

/** A rota que grava o clique. Pública: o clique após vencer não tem sessão. */
export const ROTA_DO_INTERESSE = "/api/interesse";

/**
 * A forma do id do cadastro: um uuid, sorteado pelo banco ou pela memória.
 *
 * Conferida antes de virar `$1::uuid`, para um id inventado nunca chegar ao
 * driver como erro de tipo.
 */
export const FORMA_DO_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
