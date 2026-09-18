import { describe, expect, it } from "vitest";

import { verificarSessao } from "@/seguranca/convite";
import {
  conferirSenha,
  decidirEntradaPorSenha,
  entradaPorSenhaLigada,
  HORAS_DA_SESSAO_POR_SENHA,
  PERFIL_DE_QUEM_APRESENTA,
  senhaDoPainel,
} from "@/seguranca/senha";
import {
  criarControleDeTentativas,
  TENTATIVAS_POR_JANELA,
} from "@/seguranca/tentativas";

/**
 * A porta por senha (D-CONVITE-apresentacao).
 *
 * Duas portas levam à mesma sessão: o convite assinado do QR e a senha de quem
 * apresenta. O que estes casos fixam é que a segunda entrega **o mesmo
 * envelope** que a primeira — mesma forma, mesmo perfil de quem conduz, mesmo
 * dispositivo sorteado no servidor — e que ela recusa pelo mesmo motivo
 * genérico em todos os jeitos de errar.
 */

const SEGREDO = "um-segredo-de-teste-com-mais-de-32-caracteres";
const SENHA = "apresentacao-de-setembro";
const AGORA = Math.floor(Date.UTC(2026, 8, 18, 14, 0, 0) / 1000);

const LIGADA = {
  CONVITE_SEGREDO: SEGREDO,
  SENHA_DO_PAINEL: SENHA,
};

describe("a senha do painel, lida do ambiente", () => {
  it("ausente, vazia ou só espaço é o mesmo que não ter", () => {
    expect(senhaDoPainel({})).toBeNull();
    expect(senhaDoPainel({ SENHA_DO_PAINEL: "" })).toBeNull();
    expect(senhaDoPainel({ SENHA_DO_PAINEL: "   " })).toBeNull();
    expect(entradaPorSenhaLigada({})).toBe(false);
  });

  it("presente liga a porta", () => {
    expect(senhaDoPainel(LIGADA)).toBe(SENHA);
    expect(entradaPorSenhaLigada(LIGADA)).toBe(true);
  });
});

describe("conferirSenha", () => {
  it("aceita a igual e recusa as demais", async () => {
    expect(await conferirSenha(SENHA, SENHA)).toBe(true);
    expect(await conferirSenha("outra", SENHA)).toBe(false);
    expect(await conferirSenha("", SENHA)).toBe(false);
  });

  /**
   * Prefixo certo nao vale nada.
   *
   * E o caso que a comparacao de tempo constante existe para tratar: quem
   * chuta caractere a caractere precisa que "acertei os cinco primeiros" seja
   * indistinguivel de "errei tudo". Aqui se fixa a parte observavel disso — o
   * resultado —, ja que medir tempo num teste seria instavel.
   */
  it("prefixo correto não passa", async () => {
    expect(await conferirSenha(SENHA.slice(0, SENHA.length - 1), SENHA)).toBe(
      false,
    );
    expect(await conferirSenha(SENHA + "x", SENHA)).toBe(false);
  });
});

describe("decidirEntradaPorSenha", () => {
  it("sem senha configurada, a porta está desligada", async () => {
    expect(
      await decidirEntradaPorSenha({
        senha: SENHA,
        ir: null,
        ambiente: { CONVITE_SEGREDO: SEGREDO },
        agoraSegundos: AGORA,
      }),
    ).toEqual({ tipo: "recusar", motivo: "desligado" });
  });

  it("sem segredo para assinar, também está desligada", async () => {
    expect(
      await decidirEntradaPorSenha({
        senha: SENHA,
        ir: null,
        ambiente: { SENHA_DO_PAINEL: SENHA },
        agoraSegundos: AGORA,
      }),
    ).toEqual({ tipo: "recusar", motivo: "desligado" });
  });

  /**
   * Errada e vazia saem iguais.
   *
   * Distinguir as duas entregaria um oraculo de graca a quem esta chutando, e
   * nao ajuda ninguem que esteja digitando de boa-fe.
   */
  it.each([
    ["errada", "nao-e-a-senha"],
    ["vazia", ""],
    ["ausente", null],
  ])("senha %s recebe o mesmo motivo", async (_, senha) => {
    expect(
      await decidirEntradaPorSenha({
        senha,
        ir: null,
        ambiente: LIGADA,
        agoraSegundos: AGORA,
      }),
    ).toEqual({ tipo: "recusar", motivo: "senha" });
  });

  it("a senha certa vira a mesma sessão que o QR entrega", async () => {
    const decidida = await decidirEntradaPorSenha({
      senha: SENHA,
      ir: "/fin/visao",
      ambiente: LIGADA,
      agoraSegundos: AGORA,
    });

    expect(decidida.tipo).toBe("entrar");
    if (decidida.tipo !== "entrar") return;
    expect(decidida.destino).toBe("/fin/visao");

    const sessao = await verificarSessao(decidida.cookie, SEGREDO, AGORA);
    expect(sessao).not.toBeNull();
    expect(sessao?.tipo).toBe("sessao");
    expect(sessao?.perfil).toBe(PERFIL_DE_QUEM_APRESENTA);
    expect(sessao?.dispositivo).toBeTruthy();
    expect(sessao?.expira).toBe(AGORA + HORAS_DA_SESSAO_POR_SENHA * 3600);
  });

  it("dois acessos recebem dispositivos diferentes", async () => {
    const um = await decidirEntradaPorSenha({
      senha: SENHA,
      ir: null,
      ambiente: LIGADA,
      agoraSegundos: AGORA,
    });
    const dois = await decidirEntradaPorSenha({
      senha: SENHA,
      ir: null,
      ambiente: LIGADA,
      agoraSegundos: AGORA,
    });
    if (um.tipo !== "entrar" || dois.tipo !== "entrar") {
      throw new Error("as duas deviam entrar");
    }
    const a = await verificarSessao(um.cookie, SEGREDO, AGORA);
    const b = await verificarSessao(dois.cookie, SEGREDO, AGORA);
    expect(a?.dispositivo).not.toBe(b?.dispositivo);
  });

  it("destino hostil cai na tela padrão", async () => {
    for (const ir of ["//evil.example", "https://evil.example", "\\\\evil"]) {
      const decidida = await decidirEntradaPorSenha({
        senha: SENHA,
        ir,
        ambiente: LIGADA,
        agoraSegundos: AGORA,
      });
      if (decidida.tipo !== "entrar") throw new Error("devia entrar");
      expect(decidida.destino, ir).not.toContain("evil");
    }
  });

  it("o cookie assinado com outro segredo não vale", async () => {
    const decidida = await decidirEntradaPorSenha({
      senha: SENHA,
      ir: null,
      ambiente: LIGADA,
      agoraSegundos: AGORA,
    });
    if (decidida.tipo !== "entrar") throw new Error("devia entrar");
    expect(
      await verificarSessao(decidida.cookie, `${SEGREDO}-outro`, AGORA),
    ).toBeNull();
  });
});

describe("o limite de tentativas", () => {
  const AGORA_MS = Date.UTC(2026, 8, 18, 14, 0, 0);

  it("deixa passar o limite e barra a seguinte", () => {
    const controle = criarControleDeTentativas();
    for (let i = 0; i < TENTATIVAS_POR_JANELA; i += 1) {
      expect(
        controle.admitir("1.2.3.4", AGORA_MS),
        `tentativa ${String(i)}`,
      ).toBe(true);
    }
    expect(controle.admitir("1.2.3.4", AGORA_MS)).toBe(false);
  });

  it("um endereço não gasta a cota do outro", () => {
    const controle = criarControleDeTentativas();
    for (let i = 0; i < TENTATIVAS_POR_JANELA; i += 1) {
      controle.admitir("1.2.3.4", AGORA_MS);
    }
    expect(controle.admitir("5.6.7.8", AGORA_MS)).toBe(true);
  });

  it("depois da janela, volta a passar", () => {
    const controle = criarControleDeTentativas();
    for (let i = 0; i < TENTATIVAS_POR_JANELA; i += 1) {
      controle.admitir("1.2.3.4", AGORA_MS);
    }
    expect(controle.admitir("1.2.3.4", AGORA_MS)).toBe(false);
    expect(controle.admitir("1.2.3.4", AGORA_MS + 60_001)).toBe(true);
  });

  /**
   * Acertar zera a contagem.
   *
   * Sem isto, quem erra cinco vezes e acerta na sexta fica um minuto trancado
   * do lado de dentro — a janela puniria quem digitou errado em vez de quem
   * esta chutando.
   */
  it("esquecer devolve a cota inteira", () => {
    const controle = criarControleDeTentativas();
    for (let i = 0; i < TENTATIVAS_POR_JANELA; i += 1) {
      controle.admitir("1.2.3.4", AGORA_MS);
    }
    expect(controle.admitir("1.2.3.4", AGORA_MS)).toBe(false);
    controle.esquecer("1.2.3.4");
    expect(controle.admitir("1.2.3.4", AGORA_MS)).toBe(true);
  });
});
