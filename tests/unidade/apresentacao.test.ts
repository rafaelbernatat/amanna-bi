import { describe, expect, it } from "vitest";

import { caminhoDoQr, MARGEM_EM_MODULOS } from "@/apresentacao/apresentar/qr";
import {
  criarControleDeUso,
  esquecerControleDoProcesso,
  limitesDoAmbiente,
  PERGUNTAS_POR_MINUTO,
  type Limites,
} from "@/chat/limite";
import { QUERY_PADRAO } from "@/semantica/contrato";
import {
  buscaParaQuery,
  paraConversa,
  rotaCom,
  rotaDaConversa,
  rotaDeApresentacao,
  ROTA_DA_CONVERSA,
} from "@/semantica/url";

/**
 * O QR, as rotas da conversa e os limites de uso (D-CONVITE-apresentacao).
 *
 * Os três são puros, e é isso que permite prová-los sem servidor, sem
 * navegador e sem esperar um minuto passar.
 */

/* ------------------------------------------------------------------ *
 * O QR
 * ------------------------------------------------------------------ */

describe("caminhoDoQr", () => {
  const ENDERECO = "https://amanna-bi.exemplo/entrar?convite=abc.def";

  it("é determinístico: o mesmo texto dá o mesmo caminho", () => {
    expect(caminhoDoQr(ENDERECO).caminho).toBe(caminhoDoQr(ENDERECO).caminho);
  });

  it("textos diferentes dão caminhos diferentes", () => {
    expect(caminhoDoQr(ENDERECO).caminho).not.toBe(
      caminhoDoQr(`${ENDERECO}x`).caminho,
    );
  });

  it("o lado inclui a margem dos dois lados", () => {
    const { lado } = caminhoDoQr(ENDERECO);
    // Uma versão de QR tem lado 21 + 4k módulos; com a margem, dois a mais.
    expect((lado - 2 * MARGEM_EM_MODULOS - 21) % 4).toBe(0);
  });

  /** O caminho é só desenho: nada nele executa, e por isso pode ir num `d`. */
  it("o caminho tem só comandos de retângulo", () => {
    expect(caminhoDoQr(ENDERECO).caminho).toMatch(
      /^(?:M\d+ \d+h\d+v1h-\d+z)+$/,
    );
  });

  it("um endereço longo, como o do convite de verdade, cabe", () => {
    const longo = `https://amanna-bi.exemplo/entrar?convite=${"a".repeat(400)}`;
    expect(caminhoDoQr(longo).caminho.length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ *
 * As rotas
 * ------------------------------------------------------------------ */

describe("as rotas da conversa", () => {
  it("leva a tela e o recorte, e o leitor de sempre os lê de volta", () => {
    const q = { ...QUERY_PADRAO, periodo: "dezembro" as const };
    const rota = rotaDaConversa("fin/visao", q, "fin-dre");
    expect(rota.startsWith(`${ROTA_DA_CONVERSA}?`)).toBe(true);

    const lida = buscaParaQuery(rota.split("?")[1] ?? "");
    expect(lida.query.periodo).toBe("dezembro");
    expect(lida.painelDestacado).toBe("fin-dre");
    expect(new URLSearchParams(rota.split("?")[1]).get("tela")).toBe(
      "fin/visao",
    );
  });

  it("o destino de painel vira conversa sem perder nada", () => {
    const q = { ...QUERY_PADRAO, entidade: "unidade-sp" as const };
    const destino = rotaCom("/rh/visao", q, "rh-turnover");
    const conversa = paraConversa(destino);
    const parametros = new URLSearchParams(conversa.split("?")[1]);
    expect(parametros.get("tela")).toBe("rh/visao");
    expect(parametros.get("entidade")).toBe("unidade-sp");
    expect(parametros.get("painel")).toBe("rh-turnover");
  });

  it("a apresentação carrega a tela, o recorte e o painel em foco", () => {
    const rota = rotaDeApresentacao("rh/turnover", QUERY_PADRAO, "tov-tipos");
    const parametros = new URLSearchParams(rota.split("?")[1]);
    expect(rota.startsWith("/apresentar?")).toBe(true);
    expect(parametros.get("tela")).toBe("rh/turnover");
    expect(parametros.get("painel")).toBe("tov-tipos");
  });

  it("sem painel em foco, a apresentação não inventa um", () => {
    const rota = rotaDeApresentacao("rh/visao", QUERY_PADRAO, null);
    expect(rota).not.toContain("painel=");
  });
});

/* ------------------------------------------------------------------ *
 * Os limites
 * ------------------------------------------------------------------ */

describe("o controle de uso", () => {
  const LIMITES: Limites = {
    porMinuto: 3,
    concorrencia: 2,
    tokensPorDia: 1000,
  };
  const AGORA = Date.UTC(2026, 8, 17, 14, 0, 0);
  /** Um celular que entrou pelo QR: é a ele que a janela por minuto se aplica. */
  const CELULAR = "convite:demo:abc";
  const OUTRO_CELULAR = "convite:demo:def";

  it("a quarta pergunta do mesmo dispositivo no minuto espera", () => {
    const controle = criarControleDeUso(LIMITES);
    for (let i = 0; i < LIMITES.porMinuto; i += 1) {
      const admitida = controle.admitir(CELULAR, "sala", AGORA);
      expect(admitida.ok).toBe(true);
      if (admitida.ok) admitida.liberar();
    }
    const excedente = controle.admitir(CELULAR, "sala", AGORA);
    expect(excedente.ok).toBe(false);
    if (excedente.ok) return;
    expect(excedente.motivo).toBe("por_minuto");
    expect(excedente.tentarEmSegundos).toBeGreaterThan(0);
  });

  it("outro dispositivo tem a própria janela", () => {
    const controle = criarControleDeUso(LIMITES);
    for (let i = 0; i < LIMITES.porMinuto; i += 1) {
      const admitida = controle.admitir(CELULAR, "sala", AGORA);
      if (admitida.ok) admitida.liberar();
    }
    expect(controle.admitir(OUTRO_CELULAR, "sala", AGORA).ok).toBe(true);
  });

  it("passado o minuto, a janela abre de novo", () => {
    const controle = criarControleDeUso(LIMITES);
    for (let i = 0; i < LIMITES.porMinuto; i += 1) {
      const admitida = controle.admitir(CELULAR, "sala", AGORA);
      if (admitida.ok) admitida.liberar();
    }
    expect(controle.admitir(CELULAR, "sala", AGORA).ok).toBe(false);
    expect(controle.admitir(CELULAR, "sala", AGORA + 60_001).ok).toBe(true);
  });

  it("a concorrência segura a terceira pergunta simultânea, e liberar abre vaga", () => {
    const controle = criarControleDeUso(LIMITES);
    const um = controle.admitir(CELULAR, "sala", AGORA);
    const dois = controle.admitir(OUTRO_CELULAR, "sala", AGORA);
    const tres = controle.admitir("convite:demo:ghi", "sala", AGORA);
    expect(um.ok && dois.ok).toBe(true);
    expect(tres.ok).toBe(false);
    if (tres.ok) return;
    expect(tres.motivo).toBe("concorrencia");

    if (um.ok) um.liberar();
    expect(controle.admitir("convite:demo:ghi", "sala", AGORA).ok).toBe(true);
  });

  it("liberar duas vezes não abre vaga que não existe", () => {
    const controle = criarControleDeUso(LIMITES);
    const um = controle.admitir(CELULAR, "sala", AGORA);
    const dois = controle.admitir(OUTRO_CELULAR, "sala", AGORA);
    if (!um.ok || !dois.ok) throw new Error("devia admitir");
    um.liberar();
    um.liberar();
    expect(controle.admitir("convite:demo:ghi", "sala", AGORA).ok).toBe(true);
    expect(controle.admitir("convite:demo:jkl", "sala", AGORA).ok).toBe(false);
  });

  it("o teto de tokens da sala segura a pergunta seguinte", () => {
    const controle = criarControleDeUso(LIMITES);
    controle.registrarTokens("sala", LIMITES.tokensPorDia, AGORA);
    const recusada = controle.admitir(CELULAR, "sala", AGORA);
    expect(recusada.ok).toBe(false);
    if (recusada.ok) return;
    expect(recusada.motivo).toBe("tokens");
    // Outra sala não paga pelo gasto desta.
    expect(controle.admitir(CELULAR, "outra", AGORA).ok).toBe(true);
  });

  it("a virada do dia zera o teto", () => {
    const controle = criarControleDeUso(LIMITES);
    controle.registrarTokens("sala", LIMITES.tokensPorDia, AGORA);
    expect(controle.admitir(CELULAR, "sala", AGORA).ok).toBe(false);
    const amanha = AGORA + 24 * 60 * 60 * 1000;
    expect(controle.tokensDaSala("sala", amanha)).toBe(0);
    expect(controle.admitir(CELULAR, "sala", amanha).ok).toBe(true);
  });

  /**
   * Em `fixtures` todo mundo é `fixtures:diretoria`, e em `oidc` o sujeito é
   * uma pessoa da empresa. A janela por minuto mediria a suíte de testes num
   * caso e o expediente de alguém no outro — o limite por usuário
   * identificado é T-344.
   */
  it("sujeito que não é celular de apresentação não entra na janela", () => {
    const controle = criarControleDeUso(LIMITES);
    for (let i = 0; i < LIMITES.porMinuto + 3; i += 1) {
      const admitida = controle.admitir(
        "fixtures:diretoria",
        "instalacao",
        AGORA,
      );
      expect(admitida.ok, `pergunta ${String(i)}`).toBe(true);
      if (admitida.ok) admitida.liberar();
    }
  });

  it("a concorrência e o teto de tokens valem para qualquer sujeito", () => {
    const controle = criarControleDeUso(LIMITES);
    const um = controle.admitir("fixtures:diretoria", "instalacao", AGORA);
    const dois = controle.admitir("fixtures:diretoria", "instalacao", AGORA);
    const tres = controle.admitir("fixtures:diretoria", "instalacao", AGORA);
    expect(um.ok && dois.ok).toBe(true);
    expect(tres.ok).toBe(false);
    if (!tres.ok) expect(tres.motivo).toBe("concorrencia");
  });

  it("os limites vêm do ambiente, com os padrões escritos", () => {
    expect(limitesDoAmbiente({}).porMinuto).toBe(PERGUNTAS_POR_MINUTO);
    expect(limitesDoAmbiente({ CHAT_LIMITE_POR_MINUTO: "2" }).porMinuto).toBe(
      2,
    );
    // Valor sem sentido não vira limite zero: cai no padrão.
    expect(
      limitesDoAmbiente({ CHAT_LIMITE_POR_MINUTO: "zero" }).porMinuto,
    ).toBe(PERGUNTAS_POR_MINUTO);
    expect(limitesDoAmbiente({ CHAT_LIMITE_POR_MINUTO: "-3" }).porMinuto).toBe(
      PERGUNTAS_POR_MINUTO,
    );
  });

  it("esquecer o controle do processo devolve o estado limpo", () => {
    esquecerControleDoProcesso();
    expect(() => {
      esquecerControleDoProcesso();
    }).not.toThrow();
  });
});
