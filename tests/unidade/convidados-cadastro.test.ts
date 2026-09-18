import { describe, expect, it } from "vitest";

import {
  erroValido,
  lerCadastro,
  MINIMO_DO_NOME_DO_CONVIDADO,
  primeiroNome,
  TETO_DO_EMAIL_DO_CONVIDADO,
  TETO_DO_NOME_DO_CONVIDADO,
} from "@/convidados/cadastro";

/**
 * O que a pessoa informa antes de conversar (D-CONVIDADO-cadastro, T-425).
 *
 * A validação é a mínima que faz sentido para uma lista de contato: nome
 * que cabe numa saudação, e-mail com a forma de e-mail. O que se prova é que
 * o formulário diz **qual** campo não passou, e que o que passa sai limpo.
 */
describe("lerCadastro", () => {
  it("aceita nome e e-mail, limpando espaços e caixa", () => {
    expect(
      lerCadastro({ nome: "  Ana   Souza ", email: " Ana@Exemplo.COM.br " }),
    ).toEqual({
      ok: true,
      cadastro: { nome: "Ana Souza", email: "ana@exemplo.com.br" },
    });
  });

  it.each([
    ["vazio", ""],
    ["uma letra", "A"],
    ["só espaços", "   "],
    ["com caractere de controle", "Ana"],
    ["acima do teto", "a".repeat(TETO_DO_NOME_DO_CONVIDADO + 1)],
    ["que não é texto", 42],
  ])("recusa o nome %s e nomeia o campo", (_, nome) => {
    expect(lerCadastro({ nome, email: "ana@exemplo.com" })).toEqual({
      ok: false,
      erro: "nome",
    });
  });

  it.each([
    ["sem arroba", "ana.exemplo.com"],
    ["sem ponto depois do arroba", "ana@dreamy"],
    ["com espaço", "ana souza@exemplo.com"],
    ["acima do teto", `${"a".repeat(TETO_DO_EMAIL_DO_CONVIDADO)}@x.co`],
    ["vazio", ""],
    ["que não é texto", null],
  ])("recusa o e-mail %s e nomeia o campo", (_, email) => {
    expect(lerCadastro({ nome: "Ana Souza", email })).toEqual({
      ok: false,
      erro: "email",
    });
  });

  it("o nome mínimo tem duas letras", () => {
    expect(MINIMO_DO_NOME_DO_CONVIDADO).toBe(2);
    expect(lerCadastro({ nome: "Jo", email: "jo@exemplo.com" }).ok).toBe(true);
  });
});

describe("primeiroNome e os erros", () => {
  it("é a primeira palavra do nome", () => {
    expect(primeiroNome("Ana Souza")).toBe("Ana");
    expect(primeiroNome("  Bruno  ")).toBe("Bruno");
    expect(primeiroNome("Maria da Silva")).toBe("Maria");
  });

  it("só os três erros conhecidos passam pela URL", () => {
    expect(erroValido("nome")).toBe(true);
    expect(erroValido("email")).toBe(true);
    expect(erroValido("gravacao")).toBe(true);
    expect(erroValido("outro")).toBe(false);
  });
});
