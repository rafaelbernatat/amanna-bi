/**
 * O que a pessoa informa antes de conversar: nome e e-mail
 * (D-CONVIDADO-cadastro, T-425).
 *
 * Puro, sem importar nada: é lido pela rota, pelo formulário e pelo chat, e
 * os testes o exercitam sem servidor. A validação é a mínima que faz sentido
 * — a lista serve para contato, não para autenticar ninguém.
 */

/** O nome tem de caber numa saudação e não pode ser vazio. */
export const MINIMO_DO_NOME_DO_CONVIDADO = 2;
export const TETO_DO_NOME_DO_CONVIDADO = 80;
export const TETO_DO_EMAIL_DO_CONVIDADO = 120;

/** Por que o cadastro voltou, quando voltou. Vai na URL como `erro=`. */
export const ERROS_DE_CADASTRO = ["nome", "email", "gravacao"] as const;
export type ErroDeCadastro = (typeof ERROS_DE_CADASTRO)[number];

/** O parâmetro da URL que leva o erro de volta ao formulário. */
export const PARAMETRO_DE_ERRO = "erro";

export function erroValido(candidato: string): candidato is ErroDeCadastro {
  return (ERROS_DE_CADASTRO as readonly string[]).includes(candidato);
}

export type Cadastro = {
  readonly nome: string;
  readonly email: string;
};

const CARACTERE_DE_CONTROLE = /\p{Cc}/u;

/** Algo antes do `@`, algo depois, um ponto e ao menos dois caracteres. */
const FORMA_DO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Lê nome e e-mail do que veio no formulário.
 *
 * O nome perde espaços das pontas e repetidos; o e-mail vai para minúsculas,
 * porque é assim que a lista será consultada. Um campo fora da forma diz
 * **qual**, para o formulário marcar o certo.
 */
export function lerCadastro(bruto: {
  readonly nome: unknown;
  readonly email: unknown;
}):
  | { readonly ok: true; readonly cadastro: Cadastro }
  | { readonly ok: false; readonly erro: "nome" | "email" } {
  const nome =
    typeof bruto.nome === "string"
      ? bruto.nome.trim().replace(/\s+/g, " ")
      : "";
  if (
    nome.length < MINIMO_DO_NOME_DO_CONVIDADO ||
    nome.length > TETO_DO_NOME_DO_CONVIDADO ||
    CARACTERE_DE_CONTROLE.test(nome)
  ) {
    return { ok: false, erro: "nome" };
  }

  const email =
    typeof bruto.email === "string" ? bruto.email.trim().toLowerCase() : "";
  if (
    email.length > TETO_DO_EMAIL_DO_CONVIDADO ||
    !FORMA_DO_EMAIL.test(email)
  ) {
    return { ok: false, erro: "email" };
  }

  return { ok: true, cadastro: { nome, email } };
}

/** A primeira palavra do nome: é o que a saudação e o modelo usam. */
export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}
