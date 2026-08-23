/**
 * Provedor de sessão (T-136) e interceptador de escopo (T-137).
 *
 * As duas peças fecham o caminho que a seção 11 descreve: quem pergunta é
 * identificado por um provedor trocável, e o que ele pode ver é aplicado no
 * servidor, entre a chamada e o adaptador.
 *
 * A regra de arquitetura — que não existe caminho contornando a fronteira —
 * está em `fronteira-obrigatoria.test.ts`. Aqui fica o comportamento.
 */

import { describe, expect, it } from "vitest";

import { applyScope, criarFronteira, type Fronteira } from "@/acesso/fronteira";
import {
  getSession,
  lerProvedor,
  limparProvedores,
  PROVEDORES,
  ProvedorInvalido,
  provedoresRegistrados,
  registrarProvedor,
  sessaoDeFixtures,
} from "@/acesso/sessao";
import type { DataSource, Meta, Query } from "@/semantica/contrato";
import { AREAS, ENTIDADES, MODALIDADES, PERIODOS } from "@/semantica/contrato";
import { escopoDaSessao, PERFIS, type Session } from "@/seguranca/identidade";

/* ------------------------------------------------------------------ *
 * T-136 · o provedor
 * ------------------------------------------------------------------ */

describe("AUTH_PROVIDER", () => {
  it("aceita exatamente dois modos", () => {
    expect([...PROVEDORES]).toEqual(["fixtures", "oidc"]);
  });

  it("aborta quando ausente, nomeando os aceitos", () => {
    expect(() => lerProvedor({})).toThrowError(ProvedorInvalido);
    expect(() => lerProvedor({})).toThrowError(/fixtures, oidc/);
  });

  it("aborta em valor inventado", () => {
    for (const v of ["ldap", "FIXTURES", "none", ""]) {
      expect(() => lerProvedor({ AUTH_PROVIDER: v })).toThrowError(
        ProvedorInvalido,
      );
    }
  });

  /**
   * A trava que mais importa deste arquivo.
   *
   * `fixtures` em produção não é configuração ruim — é ausência de
   * autenticação com aparência de autenticação. E a forma de acontecer é
   * sempre a mesma: alguém copia o `docker-compose` da demonstração.
   */
  it("recusa fixtures em produção", () => {
    expect(() =>
      lerProvedor({ AUTH_PROVIDER: "fixtures", NODE_ENV: "production" }),
    ).toThrowError(/autenticação que não autentica/);
  });

  it("mas aceita fixtures fora de produção, e oidc em qualquer lugar", () => {
    expect(
      lerProvedor({ AUTH_PROVIDER: "fixtures", NODE_ENV: "development" }),
    ).toBe("fixtures");
    expect(lerProvedor({ AUTH_PROVIDER: "fixtures" })).toBe("fixtures");
    expect(lerProvedor({ AUTH_PROVIDER: "oidc", NODE_ENV: "production" })).toBe(
      "oidc",
    );
  });
});

describe("o modo fixtures", () => {
  it("dá uma sessão de diretoria por padrão", () => {
    const s = sessaoDeFixtures({});
    expect(s.perfil).toBe("diretoria");
    expect(s.sujeito).toBe("fixtures:diretoria");
  });

  it("permite escolher qualquer um dos cinco perfis sem IdP", () => {
    // É o teste que a seção 11 pede e que ninguém faz quando ver o produto
    // como `controller` exige cadastrar um usuário num provedor de identidade.
    for (const perfil of PERFIS) {
      expect(sessaoDeFixtures({ AUTH_PROFILE: perfil }).perfil).toBe(perfil);
    }
  });

  it("o perfil `area` vem restrito, senão não exercita a restrição", () => {
    const s = sessaoDeFixtures({ AUTH_PROFILE: "area" });
    expect(s.areas).toEqual(["tecnologia"]);
    expect(s.entidades).toEqual(["consolidado"]);
  });

  it("perfil mal digitado cai no padrão, sem derrubar o processo", () => {
    // Em desenvolvimento, abortar por um typo atrapalha mais do que ajuda.
    // Em produção este caminho não existe: `lerProvedor` já abortou.
    expect(sessaoDeFixtures({ AUTH_PROFILE: "diretor" }).perfil).toBe(
      "diretoria",
    );
  });

  it("está registrado sem que ninguém precise registrá-lo", () => {
    expect(provedoresRegistrados()).toContain("fixtures");
  });
});

describe("getSession", () => {
  it("devolve a sessão do modo escolhido", async () => {
    const s = await getSession({ AUTH_PROVIDER: "fixtures" });
    expect(s.perfil).toBe("diretoria");
  });

  it("modo válido sem implementação registrada aborta", async () => {
    await expect(getSession({ AUTH_PROVIDER: "oidc" })).rejects.toThrowError(
      /sem implementação registrada/,
    );
  });

  it("um provedor registrado passa a ser usado, sem tela mudar", async () => {
    // A prova de RF-20: trocar a implementação troca a sessão e mais nada.
    registrarProvedor("oidc", async () => ({
      sujeito: "oidc:u-9",
      perfil: "controller",
      entidades: ["consolidado"],
      areas: ["financeiro"],
    }));
    try {
      const s = await getSession({ AUTH_PROVIDER: "oidc" });
      expect(s.perfil).toBe("controller");
      expect(s.sujeito).toBe("oidc:u-9");
    } finally {
      limparProvedores();
      registrarProvedor("fixtures", async () => sessaoDeFixtures({}));
    }
  });
});

/* ------------------------------------------------------------------ *
 * T-137 · o interceptador
 * ------------------------------------------------------------------ */

const CONSULTA: Query = {
  periodo: "12-meses",
  ano: "2026",
  entidade: "consolidado",
  area: "financeiro",
  modalidade: "todas",
};

const DIMENSOES = {
  periodo: [...PERIODOS],
  ano: ["2025", "2026"],
  entidade: [...ENTIDADES],
  area: [...AREAS],
  modalidade: [...MODALIDADES],
};

const META: Meta = {
  dimensoes: DIMENSOES,
  metricas: ["turnover_12m"],
  frescor: {
    asOf: "2026-12-31",
    sincronizadoEm: "2027-01-02T03:00:00Z",
    defasado: false,
  },
};

function fonteSimples(): DataSource {
  return {
    getMeta: async () => META,
    getKpis: async () => [],
    getPanel: async () => ({}) as never,
    getMetric: async () => ({}) as never,
  };
}

function fronteiraDe(sessao: Session): Fronteira {
  return criarFronteira(fonteSimples(), escopoDaSessao(sessao), DIMENSOES);
}

const DIRETORIA: Session = {
  sujeito: "u-1",
  perfil: "diretoria",
  entidades: [...ENTIDADES],
  areas: [...AREAS],
};

const CONTROLLER_SP: Session = {
  sujeito: "u-2",
  perfil: "controller",
  entidades: ["unidade-sp"],
  areas: ["financeiro"],
};

describe("applyScope devolve a recusa como valor", () => {
  /**
   * Por que valor e não exceção.
   *
   * A seção 6.6 diz que colar a URL de um recorte para alguém de perfil menor
   * abre a tela "sem permissão", e não uma página de erro. A tela precisa
   * conseguir desenhar a recusa, e para isso precisa recebê-la.
   */
  it("permite o que está no escopo", () => {
    const f = fronteiraDe(DIRETORIA);
    const r = applyScope(f, CONSULTA);
    expect(r.permitido).toBe(true);
    if (r.permitido) expect(r.consulta).toEqual(CONSULTA);
  });

  it("nega entidade fora do perfil, com motivo utilizável", () => {
    const r = applyScope(fronteiraDe(CONTROLLER_SP), CONSULTA);
    expect(r.permitido).toBe(false);
    if (!r.permitido) {
      expect(r.motivo).toBe("entidade_fora_do_perfil");
      expect(r.detalhe).toContain("consolidado");
    }
  });

  it("nega grão individual pelo mesmo caminho", () => {
    const r = applyScope(fronteiraDe(DIRETORIA), CONSULTA, "cpf");
    expect(r.permitido).toBe(false);
    if (!r.permitido) expect(r.motivo).toBe("pedido_de_linha_individual");
  });

  it("mas deixa subir bug de quem chamou", () => {
    // Query fora do vocabulário da seção 6.2 não é recusa de acesso: é código
    // errado, e transformá-lo em "sem permissão" esconderia o defeito atrás de
    // uma tela plausível.
    expect(() =>
      applyScope(fronteiraDe(DIRETORIA), {
        ...CONSULTA,
        periodo: "18 meses" as never,
      }),
    ).toThrow();
  });

  it("recusa fronteira construída à mão", () => {
    const falsa = {
      lerMeta: async () => META,
      lerPainel: async () => ({}) as never,
      lerKpis: async () => [],
      lerMetrica: async () => ({}) as never,
    };
    expect(() => applyScope(falsa, CONSULTA)).toThrowError(
      /não registrada|criarFronteira/,
    );
  });
});

describe("getMeta também passa pelo escopo", () => {
  /**
   * O vazamento silencioso que este teste fecha.
   *
   * `getMeta` não recebe `Query`, então é fácil concluir que não precisa de
   * escopo. Mas o que ela devolve é a lista de entidades e áreas — e oferecer
   * "Unidade SP" no filtro a quem não pode vê-la já conta que ela existe.
   */
  it("a diretoria vê as três entidades", async () => {
    const meta = await fronteiraDe(DIRETORIA).lerMeta();
    expect(meta.dimensoes.entidade).toEqual([...ENTIDADES]);
  });

  it("o controller de SP só vê a dele", async () => {
    const meta = await fronteiraDe(CONTROLLER_SP).lerMeta();
    expect(meta.dimensoes.entidade).toEqual(["unidade-sp"]);
    expect(meta.dimensoes.entidade).not.toContain("consolidado");
  });

  it("as áreas também são filtradas, menos 'Todas'", () => {
    // 'Todas' não é uma área concedível: é o pedido de "todas as que eu
    // puder". Removê-la tiraria da pessoa o recorte mais amplo que ela tem
    // direito de ver.
    return fronteiraDe(CONTROLLER_SP)
      .lerMeta()
      .then((meta) => {
        expect(meta.dimensoes.area).toEqual(["todas", "financeiro"]);
      });
  });

  it("o resto da meta atravessa intacto", async () => {
    const meta = await fronteiraDe(CONTROLLER_SP).lerMeta();
    expect(meta.frescor).toEqual(META.frescor);
    expect(meta.metricas).toEqual(META.metricas);
    expect(meta.dimensoes.periodo).toEqual([...PERIODOS]);
  });
});
