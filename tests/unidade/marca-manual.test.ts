/* eslint-disable no-restricted-syntax --
 * A regra de T-124 existe para a paleta do produto não se espalhar pelo
 * código. O que aparece aqui é o que uma pessoa digitaria num seletor de cor:
 * a cor da empresa fictícia, uma cor que reprova no contraste, uma entrada
 * inválida. Nenhuma delas é papel de tema.
 */
import { describe, expect, it } from "vitest";

import { contrasteSuficiente } from "@/apresentacao/tema/contraste";
import { CHAVES_DE_MARCA, PALETA_CLARA } from "@/apresentacao/tema/tema";
import { TETO_DO_NOME, VERSAO_DA_MARCA, type Marca } from "@/marca/documento";
import {
  coresIniciais,
  lerEntradaManual,
  montarPropostaManual,
  ORIGEM_DO_LOGO_MANUAL,
  TETO_DO_PEDIDO_MANUAL,
  type EntradaManual,
} from "@/marca/manual";
import { TETO_DO_LOGO } from "@/marca/logo";
import { PNG_DE_UM_PIXEL } from "@/marca/site/paginas";

/**
 * O caminho manual da marca (D-MARCA, T-275).
 *
 * A fronteira não confia no `<input type="color">`: cada cor passa pela
 * normalização, cada arquivo pelos bytes, o nome pela mesma forma que o
 * documento exige. E o ajuste de contraste é o mesmo estágio 3 do site.
 */

const AGORA = new Date("2026-09-17T12:00:00.000Z");

const CORES_VALIDAS = {
  marca: "#0b5cff",
  marcaEscura: "#083fb3",
  destaque: "#0b5cff",
  destaqueSuave: "#c9d8ff",
  barraLateral: "#0b1a3a",
} as const;

const PNG = Uint8Array.from(Buffer.from(PNG_DE_UM_PIXEL, "base64"));

function entrada(parcial: Partial<EntradaManual> = {}): EntradaManual {
  return {
    nome: "",
    cores: CORES_VALIDAS,
    logo: null,
    semLogo: false,
    ...parcial,
  };
}

const ATUAL: Marca = {
  versao: VERSAO_DA_MARCA,
  origem: "site",
  site: "https://dreamy.com.br/",
  nome: null,
  cores: CORES_VALIDAS,
  logo: {
    tipo: "image/png",
    conteudo: PNG_DE_UM_PIXEL,
    bytes: PNG.byteLength,
    origem: "https://dreamy.com.br/logo.png",
    impressao: "abc123",
  },
  aplicadaEm: "2026-09-04T12:00:00.000Z",
  aplicadaPor: { sujeito: "fixtures:diretoria", perfil: "diretoria" },
  extracao: { autoria: "deterministica", modelo: null, ajustes: [] },
};

/* ------------------------------------------------------------------ *
 * Do formulário à entrada
 * ------------------------------------------------------------------ */

describe("lerEntradaManual, sobre um FormData de verdade", () => {
  it("separa nome, as cinco cores, o arquivo e a caixa", async () => {
    const f = new FormData();
    f.set("nome", "Dreamy S.A.");
    for (const chave of CHAVES_DE_MARCA) f.set(chave, CORES_VALIDAS[chave]);
    f.set("logo", new File([PNG], "logo.png", { type: "image/png" }));
    f.set("semLogo", "1");

    const lida = await lerEntradaManual(f);
    expect(lida.nome).toBe("Dreamy S.A.");
    expect(lida.cores).toEqual(CORES_VALIDAS);
    expect(lida.logo).toEqual(PNG);
    expect(lida.semLogo).toBe(true);
  });

  it("arquivo vazio é nenhum arquivo, e campo ausente é texto vazio", async () => {
    const f = new FormData();
    f.set("logo", new File([], "", { type: "application/octet-stream" }));
    const lida = await lerEntradaManual(f);
    expect(lida.logo).toBeNull();
    expect(lida.nome).toBe("");
    expect(lida.cores.marca).toBe("");
    expect(lida.semLogo).toBe(false);
  });
});

/* ------------------------------------------------------------------ *
 * Da entrada à proposta
 * ------------------------------------------------------------------ */

describe("montarPropostaManual", () => {
  it("monta uma proposta de origem manual, sem site nem candidatos", () => {
    const montada = montarPropostaManual(entrada(), null, AGORA);
    expect(montada.ok).toBe(true);
    if (!montada.ok) return;
    const { proposta } = montada;
    expect(proposta.origem).toBe("manual");
    expect(proposta.site).toBeNull();
    expect(proposta.nome).toBeNull();
    expect(proposta.candidatos).toBe(0);
    expect(proposta.avisos).toEqual([]);
    expect(proposta.extracao.autoria).toBe("manual");
    expect(proposta.extracao.modelo).toBeNull();
    expect(proposta.propostaEm).toBe(AGORA.toISOString());
  });

  it("põe as cores em forma canônica antes de qualquer coisa", () => {
    const montada = montarPropostaManual(
      entrada({ cores: { ...CORES_VALIDAS, marca: "#0B5CFF" } }),
      null,
      AGORA,
    );
    if (!montada.ok) throw new Error("devia montar");
    expect(montada.proposta.cores.marca).toBe("#0b5cff");
    expect(montada.proposta.coresOriginais.marca).toBe("#0b5cff");
  });

  it("uma cor que não é cor recusa a entrada inteira, nomeando o campo", () => {
    const montada = montarPropostaManual(
      entrada({ cores: { ...CORES_VALIDAS, destaque: "não é cor" } }),
      null,
      AGORA,
    );
    expect(montada).toEqual({ ok: false, erro: "cor" });
  });

  /**
   * O mesmo estágio 3 do site: a cor digitada que reprova no contraste é
   * ajustada e **mostrada** — a original fica em `coresOriginais`, o ajuste
   * em `extracao.ajustes`, com antes e depois.
   */
  it("cor que reprova no contraste é ajustada, e o ajuste fica à vista", () => {
    const montada = montarPropostaManual(
      entrada({ cores: { ...CORES_VALIDAS, marca: "#ffcc00" } }),
      null,
      AGORA,
    );
    if (!montada.ok) throw new Error("devia montar");
    const { proposta } = montada;
    expect(contrasteSuficiente("#ffcc00", PALETA_CLARA.superficie)).toBe(false);
    expect(proposta.coresOriginais.marca).toBe("#ffcc00");
    expect(proposta.cores.marca).not.toBe("#ffcc00");
    expect(
      contrasteSuficiente(proposta.cores.marca, PALETA_CLARA.superficie),
    ).toBe(true);
    expect(proposta.extracao.ajustes.map((a) => a.papel)).toEqual(["marca"]);
    expect(proposta.extracao.ajustes[0]?.original).toBe("#ffcc00");
  });

  it("o nome é aparado e colapsado; vazio vale nulo", () => {
    const com = montarPropostaManual(
      entrada({ nome: "  Dreamy   S.A. " }),
      null,
      AGORA,
    );
    if (!com.ok) throw new Error("devia montar");
    expect(com.proposta.nome).toBe("Dreamy S.A.");

    const sem = montarPropostaManual(entrada({ nome: "   " }), null, AGORA);
    if (!sem.ok) throw new Error("devia montar");
    expect(sem.proposta.nome).toBeNull();
  });

  it("nome longo demais é recusado, nomeando o campo", () => {
    expect(
      montarPropostaManual(
        entrada({ nome: "x".repeat(TETO_DO_NOME + 1) }),
        null,
        AGORA,
      ),
    ).toEqual({ ok: false, erro: "nome" });
  });

  it("um PNG enviado vira o logo, com a origem manual", () => {
    const montada = montarPropostaManual(entrada({ logo: PNG }), null, AGORA);
    if (!montada.ok) throw new Error("devia montar");
    expect(montada.proposta.logo?.tipo).toBe("image/png");
    expect(montada.proposta.logo?.origem).toBe(ORIGEM_DO_LOGO_MANUAL);
    expect(montada.proposta.logo?.bytes).toBe(PNG.byteLength);
    expect(montada.proposta.logoRecusado).toBeNull();
  });

  /**
   * Recusado não é apagado. O arquivo que não serviu deixa o logo em uso onde
   * está e a proposta **diz** que recusou — descartar em silêncio, ou tirar o
   * logo atual, seria a correção silenciosa que este repositório não faz.
   */
  it("SVG com script é recusado, o logo em uso continua e o motivo aparece", () => {
    const svg = Uint8Array.from(
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg"><script>x()</script></svg>',
      ),
    );
    const montada = montarPropostaManual(entrada({ logo: svg }), ATUAL, AGORA);
    if (!montada.ok) throw new Error("devia montar");
    expect(montada.proposta.logoRecusado).toBe("vetor_perigoso");
    expect(montada.proposta.logo).toEqual(ATUAL.logo);
  });

  it("sem arquivo, o logo em uso é mantido; sem marca em uso, fica sem logo", () => {
    const mantido = montarPropostaManual(entrada(), ATUAL, AGORA);
    if (!mantido.ok) throw new Error("devia montar");
    expect(mantido.proposta.logo).toEqual(ATUAL.logo);

    const nenhum = montarPropostaManual(entrada(), null, AGORA);
    if (!nenhum.ok) throw new Error("devia montar");
    expect(nenhum.proposta.logo).toBeNull();
  });

  it("a caixa 'sem logo' remove o logo em uso, mesmo com arquivo junto", () => {
    const montada = montarPropostaManual(
      entrada({ semLogo: true, logo: PNG }),
      ATUAL,
      AGORA,
    );
    if (!montada.ok) throw new Error("devia montar");
    expect(montada.proposta.logo).toBeNull();
    expect(montada.proposta.logoRecusado).toBeNull();
  });
});

/* ------------------------------------------------------------------ *
 * O formulário abre com o quê
 * ------------------------------------------------------------------ */

describe("coresIniciais", () => {
  it("sem marca, as cinco cores de hoje", () => {
    const iniciais = coresIniciais(null);
    for (const chave of CHAVES_DE_MARCA) {
      expect(iniciais[chave]).toBe(PALETA_CLARA[chave]);
    }
  });

  it("com marca, as cores dela", () => {
    expect(coresIniciais(ATUAL)).toEqual(ATUAL.cores);
  });

  it("o teto do pedido é o do logo mais a folga dos campos", () => {
    expect(TETO_DO_PEDIDO_MANUAL).toBeGreaterThan(TETO_DO_LOGO);
    expect(TETO_DO_PEDIDO_MANUAL - TETO_DO_LOGO).toBe(64 * 1024);
  });
});
