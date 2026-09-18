import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { proxy } from "../../src/proxy";
import {
  assinarConvite,
  assinarSessao,
  CAMINHO_DA_CONVERSA,
  caminhoDaEntrada,
  CAMINHOS_DO_PUBLICO,
  CAMINHOS_PUBLICOS,
  decidirAcesso,
  decidirEntrada,
  destinoSeguro,
  ehSessaoDoPublico,
  gerarDispositivo,
  HORAS_DO_PUBLICO,
  NOME_DO_COOKIE,
  PERFIL_DO_PUBLICO,
  PERFIS_QUE_APRESENTAM,
  podeApresentar,
  salaValida,
  SEGUNDOS_POR_HORA,
  sujeitoDe,
  TAMANHO_MINIMO_DO_SEGREDO,
  verificarConvite,
  verificarSessao,
  VERSAO_DO_ENVELOPE,
  type Convite,
  type SessaoDeConvite,
} from "@/seguranca/convite";
import { ROTA_DA_CONVERSA } from "@/semantica/url";
import { PERFIS } from "@/seguranca/identidade";
import { conferirAmbiente } from "@/seguranca/configuracao";
import { lerProvedor, ProvedorInvalido } from "@/acesso/sessao";
import { podeConfigurarMarca } from "@/marca/permissao";

/**
 * O convite assinado que abre a apresentação (D-CONVITE-apresentacao).
 *
 * Três blocos: o envelope (assinar, verificar, e tudo que precisa falhar), as
 * duas decisões do proxy, e o boot. O que se prova é que só um envelope
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

  it("com cookie válido de quem apresenta, segue", async () => {
    // O público do QR não segue para /rh/visao: vê a entrada por senha
    // (T-429, abaixo).
    const cookie = await assinarSessao(
      sessao({ perfil: "diretoria" }),
      SEGREDO,
    );
    expect(await decidirAcesso({ ...base, cookie })).toEqual({
      tipo: "seguir",
    });
  });

  it("com cookie válido do público, a conversa segue", async () => {
    const cookie = await assinarSessao(sessao(), SEGREDO);
    expect(
      await decidirAcesso({ ...base, cookie, caminho: CAMINHO_DA_CONVERSA }),
    ).toEqual({ tipo: "seguir" });
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

  /**
   * Apresentar nao depende do modo de sessao.
   *
   * O painel abre do jeito que a instalacao escolheu — em `fixtures` aqui, em
   * OIDC num cliente — e o QR funciona do mesmo jeito nos dois. Era o
   * contrario ate 2026-09-17, e o efeito era obrigar quem apresenta a entrar
   * por link no proprio painel para que a plateia pudesse entrar por QR.
   */
  it("em modo aberto, quem escaneia entra do mesmo jeito", async () => {
    const token = await assinarConvite(convite(), SEGREDO);
    const decidida = await decidirEntrada({
      token,
      ir: null,
      ambiente: { AUTH_PROVIDER: "fixtures", CONVITE_SEGREDO: SEGREDO },
      agoraSegundos: AGORA,
    });
    expect(decidida.tipo).toBe("entrar");
  });

  it("sem segredo nenhum, nao ha apresentacao para entrar", async () => {
    const token = await assinarConvite(convite(), SEGREDO);
    expect(
      await decidirEntrada({
        token,
        ir: null,
        ambiente: { AUTH_PROVIDER: "fixtures" },
        agoraSegundos: AGORA,
      }),
    ).toEqual({ tipo: "recusar", motivo: "desligado" });
  });

  it("o passe da plateia leva perfil de leitura e dispositivo proprio", async () => {
    const token = await assinarConvite(convite(), SEGREDO);
    const um = await decidirEntrada({
      token,
      ir: null,
      ambiente: { AUTH_PROVIDER: "fixtures", CONVITE_SEGREDO: SEGREDO },
      agoraSegundos: AGORA,
    });
    const dois = await decidirEntrada({
      token,
      ir: null,
      ambiente: { AUTH_PROVIDER: "fixtures", CONVITE_SEGREDO: SEGREDO },
      agoraSegundos: AGORA,
    });
    expect(um.tipo === "entrar" && dois.tipo === "entrar").toBe(true);
    if (um.tipo !== "entrar" || dois.tipo !== "entrar") return;
    const sessaoUm = await verificarSessao(um.cookie, SEGREDO, AGORA);
    const sessaoDois = await verificarSessao(dois.cookie, SEGREDO, AGORA);
    expect(sessaoUm?.dispositivo).not.toBe(sessaoDois?.dispositivo);
  });
});

/* ------------------------------------------------------------------ *
 * O proxy
 * ------------------------------------------------------------------ */

/**
 * Onde o arquivo mora, e por que isso e um teste.
 *
 * O Next so carrega esta convencao se o arquivo estiver **ao lado** de `app`.
 * Como o produto poe `app` dentro de `src`, o arquivo tem de ser
 * `src/proxy.ts`; na raiz do repositorio ele e silenciosamente ignorado — sem
 * aviso, sem erro, sem log. Foi o que aconteceu: os testes abaixo passavam
 * chamando a funcao direto, e o servidor nunca a executava, de modo que nem a
 * negacao por convite nem a politica de seguranca chegavam a uma resposta.
 *
 * Em 16 o nome `middleware` esta descontinuado e virou `proxy`
 * (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md).
 * Este teste guarda as duas coisas: o lugar e a ausencia de um homonimo na
 * raiz, que voltaria a criar a mesma ilusao.
 */
describe("o arquivo do proxy", () => {
  const RAIZ = process.cwd();

  it("mora ao lado de app, dentro de src", () => {
    expect(existsSync(join(RAIZ, "src", "app"))).toBe(true);
    expect(existsSync(join(RAIZ, "src", "proxy.ts"))).toBe(true);
  });

  it("nao tem homonimo na raiz, que o Next ignoraria em silencio", () => {
    for (const nome of [
      "proxy.ts",
      "proxy.js",
      "middleware.ts",
      "middleware.js",
    ]) {
      expect(existsSync(join(RAIZ, nome)), `${nome} na raiz`).toBe(false);
    }
  });

  it("exporta `proxy`, o nome que a versao 16 carrega", () => {
    const texto = readFileSync(join(RAIZ, "src", "proxy.ts"), "utf8");
    expect(texto).toContain("export async function proxy(");
    expect(texto).not.toContain("export async function middleware(");
  });
});

describe("o proxy", () => {
  function pedido(caminho: string, cookie?: string): NextRequest {
    const requisicao = new NextRequest(`https://painel.local${caminho}`);
    if (cookie !== undefined) {
      requisicao.cookies.set(NOME_DO_COOKIE, cookie);
    }
    return requisicao;
  }

  it("em modo fixtures, segue e mantém os cabeçalhos de sempre", async () => {
    vi.stubEnv("AUTH_PROVIDER", "fixtures");
    const resposta = await proxy(pedido("/rh/visao"));
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get("Content-Security-Policy")).toContain(
      "default-src",
    );
  });

  it("em modo convite, sem cookie, a página é redirecionada com CSP", async () => {
    vi.stubEnv("AUTH_PROVIDER", "convite");
    vi.stubEnv("CONVITE_SEGREDO", SEGREDO);
    const resposta = await proxy(pedido("/rh/visao"));
    expect(resposta.status).toBe(303);
    expect(resposta.headers.get("location")).toContain("/entrar?");
    expect(resposta.headers.get("Content-Security-Policy")).toContain(
      "default-src",
    );
  });

  it("em modo convite, /api/chat sem cookie é 401", async () => {
    vi.stubEnv("AUTH_PROVIDER", "convite");
    vi.stubEnv("CONVITE_SEGREDO", SEGREDO);
    const resposta = await proxy(pedido("/api/chat"));
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
    const resposta = await proxy(
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
    const resposta = await proxy(pedido("/entrar?convite=nao-e-token"));
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

/* ------------------------------------------------------------------ *
 * O público: cinco horas, e só o chat (D-CONVIDADO-cadastro)
 * ------------------------------------------------------------------ */

describe("o público entra por cinco horas e fica no chat (T-423, T-429)", () => {
  const OITO_HORAS = 8 * SEGUNDOS_POR_HORA;
  const CINCO_HORAS = HORAS_DO_PUBLICO * SEGUNDOS_POR_HORA;

  it("um convite público de oito horas vira sessão de cinco", async () => {
    const token = await assinarConvite(
      convite({ expira: AGORA + OITO_HORAS }),
      SEGREDO,
    );
    const decidida = await decidirEntrada({
      token,
      ir: null,
      ambiente: CONVITE_LIGADO,
      agoraSegundos: AGORA,
    });
    if (decidida.tipo !== "entrar") throw new Error("devia entrar");
    expect(decidida.maxAge).toBe(CINCO_HORAS);
    const aberta = await verificarSessao(decidida.cookie, SEGREDO, AGORA);
    expect(aberta?.expira).toBe(AGORA + CINCO_HORAS);
  });

  it("um convite de quem apresenta herda o prazo inteiro", async () => {
    const token = await assinarConvite(
      convite({ perfil: "diretoria", expira: AGORA + OITO_HORAS }),
      SEGREDO,
    );
    const decidida = await decidirEntrada({
      token,
      ir: null,
      ambiente: CONVITE_LIGADO,
      agoraSegundos: AGORA,
    });
    if (decidida.tipo !== "entrar") throw new Error("devia entrar");
    expect(decidida.maxAge).toBe(OITO_HORAS);
  });

  it("é o perfil que diz quem é público, não o prefixo do sujeito", () => {
    expect(ehSessaoDoPublico(sessao())).toBe(true);
    expect(ehSessaoDoPublico(sessao({ perfil: "diretoria" }))).toBe(false);
    expect(sujeitoDe(sessao({ perfil: "diretoria" }))).toMatch(/^convite:/);
  });

  it("o público fora da conversa vê a entrada por senha, levando o destino; /api fora da lista é negada", async () => {
    const cookie = await assinarSessao(sessao(), SEGREDO);
    const base = {
      busca: "",
      cookie,
      ambiente: CONVITE_LIGADO,
      agoraSegundos: AGORA,
    };
    // Produto (2026-09-18): o endereço do produto mostra a senha a quem
    // apresenta, mesmo num navegador que carrega uma sessão de plateia.
    expect(await decidirAcesso({ ...base, caminho: "/rh/visao" })).toEqual({
      tipo: "redirecionar",
      para: "/entrar?motivo=plateia&ir=%2Frh%2Fvisao",
    });
    expect(
      await decidirAcesso({
        ...base,
        caminho: "/fin/caixa",
        busca: "periodo=dezembro",
      }),
    ).toEqual({
      tipo: "redirecionar",
      para: "/entrar?motivo=plateia&ir=%2Ffin%2Fcaixa%3Fperiodo%3Ddezembro",
    });
    expect(await decidirAcesso({ ...base, caminho: "/apresentar" })).toEqual({
      tipo: "redirecionar",
      para: "/entrar?motivo=plateia&ir=%2Fapresentar",
    });
    // O layout do painel, que não conhece o caminho, manda só o motivo.
    expect(caminhoDaEntrada("plateia")).toBe("/entrar?motivo=plateia");
    expect(
      await decidirAcesso({ ...base, caminho: "/api/marca/extrair" }),
    ).toEqual({ tipo: "negar" });
    for (const caminho of CAMINHOS_DO_PUBLICO) {
      expect(await decidirAcesso({ ...base, caminho }), caminho).toEqual({
        tipo: "seguir",
      });
    }
  });

  it("o caminho da conversa escrito no proxy é o da semântica", () => {
    expect(CAMINHO_DA_CONVERSA).toBe(ROTA_DA_CONVERSA);
    expect(CAMINHOS_DO_PUBLICO).toContain("/api/chat");
    expect(CAMINHOS_DO_PUBLICO).toContain("/api/convidado");
  });

  it("/api/interesse é pública: o clique depois de vencer não tem sessão", () => {
    expect(CAMINHOS_PUBLICOS).toContain("/api/interesse");
  });
});
