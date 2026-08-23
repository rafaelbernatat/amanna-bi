/**
 * Escopo de acesso em execução (T-135, seção 11 do PRD).
 *
 * As provas de tipo estão em `tests/tipos/identidade.tipos.ts` — o que não
 * compila não chega aqui. O que se testa neste arquivo é o comportamento: a
 * consulta fora do perfil é **recusada**, e não silenciosamente trocada.
 *
 * É a distinção que decide se a seção 11 vale alguma coisa. Um sistema que
 * troca a entidade pedida pela primeira permitida mostra número de um recorte
 * com o cabeçalho de outro, e ninguém tem como perceber olhando a tela.
 */

import { describe, expect, it } from "vitest";

import type { Query } from "@/semantica/contrato";
import { ENTIDADES } from "@/semantica/contrato";
import {
  escopoDaSessao,
  exigirModulo,
  ForaDoEscopo,
  MODULOS_DO_PRODUTO,
  PERFIS,
  perfilVeModulo,
  restringir,
  type Session,
} from "@/seguranca/identidade";

const CONSULTA: Query = {
  periodo: "12-meses",
  ano: "2026",
  entidade: "consolidado",
  area: "financeiro",
  modalidade: "todas",
};

function sessao(p: Partial<Session> = {}): Session {
  return {
    sujeito: "u-1",
    perfil: "diretoria",
    entidades: [...ENTIDADES],
    areas: ["financeiro", "rh"],
    ...p,
  };
}

describe("os cinco perfis da seção 11", () => {
  it("são cinco, contados", () => {
    expect(PERFIS.length).toBe(5);
    expect([...PERFIS].sort()).toEqual([
      "area",
      "auditor",
      "controller",
      "diretoria",
      "rh",
    ]);
  });

  it("controller vê Financeiro e Integração, não RH", () => {
    expect(perfilVeModulo("controller", "fin")).toBe(true);
    expect(perfilVeModulo("controller", "int")).toBe(true);
    expect(perfilVeModulo("controller", "rh")).toBe(false);
  });

  it("rh vê RH e Integração, não Financeiro", () => {
    expect(perfilVeModulo("rh", "rh")).toBe(true);
    expect(perfilVeModulo("rh", "int")).toBe(true);
    expect(perfilVeModulo("rh", "fin")).toBe(false);
  });

  it("diretoria e auditor veem os três módulos", () => {
    for (const m of MODULOS_DO_PRODUTO) {
      expect(perfilVeModulo("diretoria", m)).toBe(true);
      expect(perfilVeModulo("auditor", m)).toBe(true);
    }
  });
});

describe("restringir recusa, não substitui", () => {
  it("aceita o que está no escopo", () => {
    const r = restringir(CONSULTA, escopoDaSessao(sessao()));
    // O valor volta intacto: restringir confere, não reescreve.
    expect(r).toEqual(CONSULTA);
  });

  it("recusa entidade fora do perfil", () => {
    const escopo = escopoDaSessao(sessao({ entidades: ["unidade-sp"] }));
    expect(() => restringir(CONSULTA, escopo)).toThrowError(ForaDoEscopo);
    try {
      restringir(CONSULTA, escopo);
    } catch (e) {
      expect((e as ForaDoEscopo).motivo).toBe("entidade_fora_do_perfil");
      // A mensagem nomeia o pedido e o concedido: sem isso, quem depura fica
      // sabendo que houve recusa e não por quê.
      expect((e as ForaDoEscopo).message).toContain("consolidado");
      expect((e as ForaDoEscopo).message).toContain("unidade-sp");
    }
  });

  it("recusa área fora do perfil", () => {
    const escopo = escopoDaSessao(sessao({ areas: ["rh"] }));
    expect(() => restringir(CONSULTA, escopo)).toThrowError(/area_fora/);
  });

  it("recusa sessão sem nenhuma concessão", () => {
    const escopo = escopoDaSessao(sessao({ entidades: [], areas: [] }));
    expect(() => restringir(CONSULTA, escopo)).toThrowError(
      /sessao_sem_acesso/,
    );
  });

  it("aceita 'Todas' em área — é pedido de amplitude, não de área concreta", () => {
    const escopo = escopoDaSessao(sessao({ areas: ["financeiro"] }));
    const r = restringir({ ...CONSULTA, area: "todas" }, escopo);
    expect(r.area).toBe("todas");
    // E o adaptador ainda sabe quais são de fato: o escopo carrega a lista.
    expect(escopo.areas).toEqual(["financeiro"]);
  });

  /**
   * A prova de que a recusa não vira substituição.
   *
   * O erro que este teste existe para pegar não quebra nada visivelmente: a
   * tela carrega, o número aparece, e é o número errado com o rótulo certo.
   */
  it("nunca devolve entidade diferente da pedida", () => {
    const escopo = escopoDaSessao(sessao({ entidades: ["unidade-sp"] }));
    let devolvido: unknown = null;
    try {
      devolvido = restringir(CONSULTA, escopo);
    } catch {
      devolvido = "recusou";
    }
    expect(devolvido).toBe("recusou");
  });
});

describe("exigirModulo", () => {
  it("deixa passar módulo do perfil", () => {
    expect(() =>
      exigirModulo(escopoDaSessao(sessao({ perfil: "controller" })), "fin"),
    ).not.toThrow();
  });

  it("recusa módulo fora do perfil, nomeando os dois", () => {
    const escopo = escopoDaSessao(sessao({ perfil: "controller" }));
    expect(() => exigirModulo(escopo, "rh")).toThrowError(/controller.*'rh'/);
  });

  it("recusa RH ao controller e Financeiro ao rh, os dois casos da tabela", () => {
    expect(() =>
      exigirModulo(escopoDaSessao(sessao({ perfil: "controller" })), "rh"),
    ).toThrow();
    expect(() =>
      exigirModulo(escopoDaSessao(sessao({ perfil: "rh" })), "fin"),
    ).toThrow();
  });
});
