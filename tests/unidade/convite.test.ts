import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { middleware } from "../../middleware";
import {
  assinarConvite,
  assinarSessao,
  CAMINHOS_PUBLICOS,
  decidirAcesso,
  decidirEntrada,
  destinoSeguro,
  gerarDispositivo,
  NOME_DO_COOKIE,
  PERFIL_DO_PUBLICO,
  PERFIS_QUE_APRESENTAM,
  podeApresentar,
  salaValida,
  sujeitoDe,
  TAMANHO_MINIMO_DO_SEGREDO,
  verificarConvite,
  verificarSessao,
  VERSAO_DO_ENVELOPE,
  type Convite,
  type SessaoDeConvite,
} from "@/seguranca/convite";
import { PERFIS } from "@/seguranca/identidade";
import { conferirAmbiente } from "@/seguranca/configuracao";
import { lerProvedor, ProvedorInvalido } from "@/acesso/sessao";
import { podeConfigurarMarca } from "@/marca/permissao";

/**
 * O convite assinado que abre a apresentação (D-CONVITE-apresentacao).
 *
 * Três blocos: o envelope (assinar, verificar, e tudo que precisa falhar), as
 * duas decisões do middleware, e o boot. O que se prova é que só um envelope
 * **nosso**, íntegro, do tipo certo e no prazo abre qualquer coisa.
 */

const SEGREDO = "um-segredo-de-teste-com-mais-de-32-caracteres";
const OUTRO = "outro-segredo-de-teste-com-mais-de-32-carac";
const AGORA = 1_800_000_000;
const DEPOIS = AGORA + 3600;

function convite(parcial: Partial<Convite> = {}): Convite {
  return {
    v: VERSAO_DO_ENVELOPE,
    tipo: "convite",
    sala: "demo",
    perfil: PERFIL_DO_PUBLICO,
    expira: DEPOIS,
    ...parcial,
  };
}

function sessao(parcial: Partial<SessaoDeConvite> = {}): SessaoDeConvite {
  return {
    v: VERSAO_DO_ENVELOPE,
    tipo: "sessao",
    sala: "demo",
    perfil: PERFIL_DO_PUBLICO,
    dispositivo: "abcdefghijklmnop",
    expira: DEPOIS,
    ...parcial,
  };
}

const CONVITE_LIGADO = {
  AUTH_PROVIDER: "convite",
  CONVITE_SEGREDO: SEGREDO,
};

afterEach(() => {
  vi.unstubAllEnvs();
});

/* ------------------------------------------------------------------ *
 * O envelope
 * ------------------------------------------------------------------ */

describe("assinar e verificar", () => {
  it("o que se assina é o que se verifica", async () => {
    const token = await assinarConvite(convite(), SEGREDO);
    expect(await verificarConvite(token, SEGREDO, AGORA)).toEqual(convite());

    const cookie = await assinarSessao(sessao(), SEGREDO);
    expect(await verificarSessao(cookie, SEGREDO, AGORA)).toEqual(sessao());
  });

  it("o mesmo envelope assinado duas vezes dá o mesmo texto", async () => {
    const um = await assinarConvite(convite(), SEGREDO);
    const dois = await assinarConvite(convite(), SEGREDO);
    expect(um).toBe(dois);
  });

  it("outro segredo não abre", async () => {
    const token = await assinarConvite(convite(), SEGREDO);
    expect(await verificarConvite(token, OUTRO, AGORA)).toBeNull();
  });

  it("assinatura adulterada não abre", async () => {
    const token = await assinarConvite(convite(), SEGREDO);
    const [corpo = "", assinatura = ""] = token.split(".");
    const trocada = `${assinatura.slice(0, -1)}${assinatura.endsWith("A") ? "B" : "A"}`;
    expect(
      await verificarConvite(`${corpo}.${trocada}`, SEGREDO, AGORA),
    ).toBeNull();
  });

  /**
   * O ataque óbvio: trocar o perfil dentro do envelope.
   *
   * Sem assinatura, isso daria `diretoria` a quem escaneou o QR da plateia.
   * Com ela, o corpo novo não casa com a assinatura antiga.
   */
  it("corpo adulterado não abre, mesmo com a assinatura original", async () => {
    const token = await assinarConvite(convite(), SEGREDO);
    const [, assinatura = ""] = token.split(".");
    const forjado = btoa(JSON.stringify(convite({ perfil: "diretoria" })))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(
      await verificarConvite(`${forjado}.${assinatura}`, SEGREDO, AGORA),
    ).toBeNull();
  });

  it("vencido não abre", async () => {
    const token = await assinarConvite(convite({ expira: AGORA - 1 }), SEGREDO);
    expect(await verificarConvite(token, SEGREDO, AGORA)).toBeNull();
  });

  /**
   * O `tipo` existe para isto: o token do QR não serve de cookie.
   *
   * Sem a distinção, colar o token do QR no cookie daria uma sessão sem
   * dispositivo — e toda a plateia compartilharia a mesma conversa.
   */
  it("convite não vale como sessão, e sessão não vale como convite", async () => {
    const token = await assinarConvite(convite(), SEGREDO);
    expect(await verificarSessao(token, SEGREDO, AGORA)).toBeNull();
    const cookie = await assinarSessao(sessao(), SEGREDO);
    expect(await verificarConvite(cookie, SEGREDO, AGORA)).toBeNull();
  });

  it.each([
    ["vazio", ""],
    ["sem ponto", "abcdef"],
    ["base64 malformado", "!!!.???"],
    ["só o ponto", "."],
    ["corpo que não é JSON", "aGVsbG8.YWJj"],
  ])("recusa %s", async (_, bruto) => {
    expect(await verificarConvite(bruto, SEGREDO, AGORA)).toBeNull();
  });

  it("sessão sem dispositivo não abre", async () => {
    const { dispositivo: _ignorado, ...semDispositivo } = sessao();
    const corpo = btoa(JSON.stringify(semDispositivo))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    // Assinado de verdade, mas incompleto: a forma também é conferida.
    const token = await assinarSessao(sessao(), SEGREDO);
    const [, assinatura = ""] = token.split(".");
    expect(
      await verificarSessao(`${corpo}.${assinatura}`, SEGREDO, AGORA),
    ).toBeNull();
  });

  it("dois dispositivos dão dois sujeitos", () => {
    const um = gerarDispositivo();
    const dois = gerarDispositivo();
    expect(um).not.toBe(dois);
    expect(sujeitoDe(sessao({ dispositivo: um }))).not.toBe(
      sujeitoDe(sessao({ dispositivo: dois })),
    );
    expect(sujeitoDe(sessao({ dispositivo: um }))).toBe(`convite:demo:${um}`);
  });

  it("a sala tem forma, e o que não tem forma não abre", async () => {
    expect(salaValida("demo")).toBe(true);
    expect(salaValida("reuniao-de-setembro")).toBe(true);
    expect(salaValida("Demo")).toBe(false);
    expect(salaValida("sala com espaço")).toBe(false);
    expect(salaValida("")).toBe(false);
    const token = await assinarConvite(
      convite({ sala: "Sala Grande" }),
      SEGREDO,
    );
    expect(await verificarConvite(token, SEGREDO, AGORA)).toBeNull();
  });
});

/* ------------------------------------------------------------------ *
 * O destino
 * ------------------------------------------------------------------ */

describe("destinoSeguro", () => {
  it("aceita caminho desta instalação", () => {
    expect(destinoSeguro("/fin/visao?periodo=dezembro")).toBe(
      "/fin/visao?periodo=dezembro",
    );
    expect(destinoSeguro("/conversa?tela=rh/visao")).toBe(
      "/conversa?tela=rh/visao",
    );
  });

  it.each([
    ["absoluto", "https://evil.example/x"],
    ["sem esquema", "//evil.example/x"],
    ["com barra invertida", "/\\evil.example"],
    ["relativo", "fin/visao"],
    ["vazio", ""],
    ["ausente", null],
  ])("recusa %s e cai no padrão", (_, pedido) => {
    expect(destinoSeguro(pedido)).toBe("/rh/visao");
  });
});

/* ------------------------------------------------------------------ *
 * As duas decisões
 * ------------------------------------------------------------------ */

describe("decidirAcesso", () => {
  const base = {
    caminho: "/rh/visao",
    busca: "",
    cookie: null,
    ambiente: CONVITE_LIGADO,
    agoraSegundos: AGORA,
  };

  it("em modo aberto, não nega nada", async () => {
    expect(
      await decidirAcesso({ ...base, ambiente: { AUTH_PROVIDER: "fixtures" } }),
    ).toEqual({ tipo: "seguir" });
  });

  it("com cookie válido, segue", async () => {
    const cookie = await assinarSessao(sessao(), SEGREDO);
    expect(await decidirAcesso({ ...base, cookie })).toEqual({
      tipo: "seguir",
    });
  });

  it("sem cookie, a página vai para /entrar levando o destino", async () => {
    const decidida = await decidirAcesso({
      ...base,
      caminho: "/fin/visao",
      busca: "periodo=dezembro",
    });
    expect(decidida.tipo).toBe("redirecionar");
    if (decidida.tipo !== "redirecionar") return;
    expect(decidida.para).toContain("motivo=sem-sessao");
    expect(decidida.para).toContain(
      `ir=${encodeURIComponent("/fin/visao?periodo=dezembro")}`,
    );
  });

  it("cookie vencido diz que venceu, e não que falta", async () => {
    const cookie = await assinarSessao(sessao({ expira: AGORA - 1 }), SEGREDO);
    const decidida = await decidirAcesso({ ...base, cookie });
    expect(decidida.tipo).toBe("redirecionar");
    if (decidida.tipo !== "redirecionar") return;
    expect(decidida.para).toContain("motivo=expirado");
  });

  /** Uma rota de dados não redireciona: responde que não há sessão. */
  it("sem cookie, /api/ é negada", async () => {
    expect(await decidirAcesso({ ...base, caminho: "/api/chat" })).toEqual({
      tipo: "negar",
    });
  });

  it.each([...CAMINHOS_PUBLICOS])("%s segue sem sessão", async (caminho) => {
    expect(await decidirAcesso({ ...base, caminho })).toEqual({
      tipo: "seguir",
    });
  });

  it("um caminho que só começa igual não é público", async () => {
    const decidida = await decidirAcesso({ ...base, caminho: "/entrarxx" });
    expect(decidida.tipo).toBe("redirecionar");
  });

  it("sem segredo, nada passa — nem com cookie que um dia valeu", async () => {
    const cookie = await assinarSessao(sessao(), SEGREDO);
    const decidida = await decidirAcesso({
      ...base,
      cookie,
      ambiente: { AUTH_PROVIDER: "convite" },
    });
    expect(decidida.tipo).toBe("redirecionar");
  });
});

describe("decidirEntrada", () => {
  it("um convite válido vira cookie, com o prazo do convite", async () => {
    const token = await assinarConvite(convite(), SEGREDO);
    const decidida = await decidirEntrada({
      token,
      ir: "/conversa?tela=fin/visao",
      ambiente: CONVITE_LIGADO,
      agoraSegundos: AGORA,
    });
    expect(decidida.tipo).toBe("entrar");
    if (decidida.tipo !== "entrar") return;
    expect(decidida.destino).toBe("/conversa?tela=fin/visao");
    expect(decidida.maxAge).toBe(DEPOIS - AGORA);

    const aberta = await verificarSessao(decidida.cookie, SEGREDO, AGORA);
    expect(aberta?.sala).toBe("demo");
    expect(aberta?.perfil).toBe(PERFIL_DO_PUBLICO);
    expect(aberta?.expira).toBe(DEPOIS);
    expect(aberta?.dispositivo).not.toBe("");
  });

  it("dois celulares com o mesmo convite recebem dispositivos diferentes", async () => {
    const token = await assinarConvite(convite(), SEGREDO);
    const entrada = () =>
      decidirEntrada({
        token,
        ir: null,
        ambiente: CONVITE_LIGADO,
        agoraSegundos: AGORA,
      });
    const um = await entrada();
    const dois = await entrada();
    if (um.tipo !== "entrar" || dois.tipo !== "entrar")
      throw new Error("devia entrar");
    const a = await verificarSessao(um.cookie, SEGREDO, AGORA);
    const b = await verificarSessao(dois.cookie, SEGREDO, AGORA);
    expect(a?.dispositivo).not.toBe(b?.dispositivo);
  });

  it("um destino para fora vira o padrão", async () => {
    const token = await assinarConvite(convite(), SEGREDO);
    const decidida = await decidirEntrada({
      token,
      ir: "https://evil.example",
      ambiente: CONVITE_LIGADO,
      agoraSegundos: AGORA,
    });
    if (decidida.tipo !== "entrar") throw new Error("devia entrar");
    expect(decidida.destino).toBe("/rh/visao");
  });

  it.each([
    ["sem token", null],
    ["token vazio", ""],
    ["token forjado", "abc.def"],
  ])("recusa %s", async (_, token) => {
    const decidida = await decidirEntrada({
      token,
      ir: null,
      ambiente: CONVITE_LIGADO,
      agoraSegundos: AGORA,
    });
    expect(decidida).toEqual({ tipo: "recusar", motivo: "invalido" });
  });

  it("em modo aberto, entrar por convite é recusado como desligado", async () => {
    const token = await assinarConvite(convite(), SEGREDO);
    expect(
      await decidirEntrada({
        token,
        ir: null,
        ambiente: { AUTH_PROVIDER: "fixtures", CONVITE_SEGREDO: SEGREDO },
        agoraSegundos: AGORA,
      }),
    ).toEqual({ tipo: "recusar", motivo: "desligado" });
  });
});

/* ------------------------------------------------------------------ *
 * O middleware
 * ------------------------------------------------------------------ */

describe("o middleware", () => {
  function pedido(caminho: string, cookie?: string): NextRequest {
    const requisicao = new NextRequest(`https://painel.local${caminho}`);
    if (cookie !== undefined) {
      requisicao.cookies.set(NOME_DO_COOKIE, cookie);
    }
    return requisicao;
  }

  it("em modo fixtures, segue e mantém os cabeçalhos de sempre", async () => {
    vi.stubEnv("AUTH_PROVIDER", "fixtures");
    const resposta = await middleware(pedido("/rh/visao"));
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get("Content-Security-Policy")).toContain(
      "default-src",
    );
  });

  it("em modo convite, sem cookie, a página é redirecionada com CSP", async () => {
    vi.stubEnv("AUTH_PROVIDER", "convite");
    vi.stubEnv("CONVITE_SEGREDO", SEGREDO);
    const resposta = await middleware(pedido("/rh/visao"));
    expect(resposta.status).toBe(303);
    expect(resposta.headers.get("location")).toContain("/entrar?");
    expect(resposta.headers.get("Content-Security-Policy")).toContain(
      "default-src",
    );
  });

  it("em modo convite, /api/chat sem cookie é 401", async () => {
    vi.stubEnv("AUTH_PROVIDER", "convite");
    vi.stubEnv("CONVITE_SEGREDO", SEGREDO);
    const resposta = await middleware(pedido("/api/chat"));
    expect(resposta.status).toBe(401);
  });

  /**
   * O token sai da URL na entrada.
   *
   * A URL fica no histórico do navegador e vaza pelo cabeçalho de referência.
   * O que sobra na barra do celular é o destino; o acesso passa a viver no
   * cookie, que é `httpOnly`.
   */
  it("entrar com convite grava o cookie e redireciona sem o token", async () => {
    vi.stubEnv("AUTH_PROVIDER", "convite");
    vi.stubEnv("CONVITE_SEGREDO", SEGREDO);
    const token = await assinarConvite(
      convite({ expira: Math.floor(Date.now() / 1000) + 3600 }),
      SEGREDO,
    );
    const resposta = await middleware(
      pedido(`/entrar?convite=${encodeURIComponent(token)}&ir=/fin/visao`),
    );
    expect(resposta.status).toBe(303);
    expect(resposta.headers.get("location")).toContain("/fin/visao");
    expect(resposta.headers.get("location")).not.toContain("convite=");

    const guardado = resposta.cookies.get(NOME_DO_COOKIE);
    expect(guardado?.httpOnly).toBe(true);
    expect(guardado?.sameSite).toBe("lax");
    expect(guardado?.secure).toBe(true);
    expect(guardado?.path).toBe("/");
  });

  it("entrar com convite inválido volta para a tela de entrada, sem cookie", async () => {
    vi.stubEnv("AUTH_PROVIDER", "convite");
    vi.stubEnv("CONVITE_SEGREDO", SEGREDO);
    const resposta = await middleware(pedido("/entrar?convite=nao-e-token"));
    expect(resposta.status).toBe(303);
    expect(resposta.headers.get("location")).toContain("motivo=invalido");
    expect(resposta.cookies.get(NOME_DO_COOKIE)).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ *
 * O boot e os perfis
 * ------------------------------------------------------------------ */

describe("o boot", () => {
  it("convite é um provedor aceito, e pode ficar na frente de dado real", () => {
    expect(
      lerProvedor({ AUTH_PROVIDER: "convite", DATA_SOURCE: "warehouse" }),
    ).toBe("convite");
  });

  it("fixtures na frente de dado real continua abortando", () => {
    expect(() =>
      lerProvedor({ AUTH_PROVIDER: "fixtures", DATA_SOURCE: "warehouse" }),
    ).toThrow(ProvedorInvalido);
  });

  it("convite sem segredo não sobe", () => {
    const problemas = conferirAmbiente({
      DATA_SOURCE: "fixtures",
      AUTH_PROVIDER: "convite",
    }).map((p) => p.variavel);
    expect(problemas).toContain("CONVITE_SEGREDO");
  });

  it("segredo curto não sobe, e a mensagem não traz o valor", () => {
    const problemas = conferirAmbiente({
      DATA_SOURCE: "fixtures",
      AUTH_PROVIDER: "convite",
      CONVITE_SEGREDO: "curto",
    });
    expect(problemas.map((p) => p.variavel)).toContain("CONVITE_SEGREDO");
    expect(JSON.stringify(problemas)).not.toContain("curto");
    expect(JSON.stringify(problemas)).toContain(
      String(TAMANHO_MINIMO_DO_SEGREDO),
    );
  });

  it("convite com segredo sobe", () => {
    expect(
      conferirAmbiente({
        DATA_SOURCE: "fixtures",
        AUTH_PROVIDER: "convite",
        CONVITE_SEGREDO: SEGREDO,
      }),
    ).toEqual([]);
  });
});

describe("os perfis da apresentação", () => {
  it("quem apresenta é quem configura a instalação", () => {
    expect([...PERFIS_QUE_APRESENTAM].sort()).toEqual([
      "controller",
      "diretoria",
    ]);
  });

  it.each(PERFIS.filter((p) => !PERFIS_QUE_APRESENTAM.includes(p)))(
    "%s não apresenta",
    (perfil) => {
      expect(podeApresentar(perfil)).toBe(false);
    },
  );

  /**
   * Quem entra pelo QR lê, e só. Um perfil de leitura que configurasse a
   * marca deixaria a plateia trocar o logo da apresentação.
   */
  it("o perfil do público não configura a marca nem apresenta", () => {
    expect(podeConfigurarMarca(PERFIL_DO_PUBLICO)).toBe(false);
    expect(podeApresentar(PERFIL_DO_PUBLICO)).toBe(false);
  });
});
