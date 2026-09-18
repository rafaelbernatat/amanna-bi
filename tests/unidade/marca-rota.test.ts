/* eslint-disable no-restricted-syntax --
 * As cores aqui são entrada de teste da folha de estilo: uma cor válida de
 * empresa fictícia e uma tentativa de fechar a regra CSS. Nenhuma é papel de
 * tema do produto.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { EstiloDaMarca } from "@/apresentacao/tema/EstiloDaMarca";
import { PALETA_CLARA, variavelDaMarca } from "@/apresentacao/tema/tema";
import { PERFIS_QUE_CONFIGURAM_MARCA } from "@/marca/permissao";
import { conferirPedidoDeMarca, origemPropria, verTela } from "@/marca/rota";
import { PERFIS } from "@/seguranca/identidade";

/**
 * As duas conferências de toda rota de escrita da marca, e a folha de estilo
 * que a marca aplicada emite (D-MARCA, T-277).
 *
 * Esconder o botão é cortesia; **isto** é o controle. A origem é conferida
 * antes da identidade, e a identidade antes de qualquer byte do corpo.
 */

const ANFITRIAO = "painel.local";

function pedido(cabecalhos: Record<string, string>): Request {
  return new Request(`https://${ANFITRIAO}/api/marca/manual`, {
    method: "POST",
    headers: cabecalhos,
  });
}

const PROPRIO = { origin: `https://${ANFITRIAO}`, host: ANFITRIAO };

let perfilAnterior: string | undefined;

beforeAll(() => {
  process.env["DATA_SOURCE"] = "fixtures";
  process.env["AUTH_PROVIDER"] = "fixtures";
  perfilAnterior = process.env["AUTH_PROFILE"];
});

afterAll(() => {
  if (perfilAnterior === undefined) delete process.env["AUTH_PROFILE"];
  else process.env["AUTH_PROFILE"] = perfilAnterior;
});

/* ------------------------------------------------------------------ *
 * A origem
 * ------------------------------------------------------------------ */

describe("origemPropria", () => {
  it("aceita quando a origem é o próprio anfitrião", () => {
    expect(origemPropria(pedido(PROPRIO))).toBe(true);
  });

  it("o anfitrião encaminhado prevalece sobre o interno", () => {
    expect(
      origemPropria(
        pedido({
          origin: "https://publico.exemplo",
          host: "interno:3000",
          "x-forwarded-host": "publico.exemplo",
        }),
      ),
    ).toBe(true);
    expect(
      origemPropria(
        pedido({
          origin: "https://interno:3000",
          host: "interno:3000",
          "x-forwarded-host": "publico.exemplo",
        }),
      ),
    ).toBe(false);
  });

  it("origem de outro site é recusada", () => {
    expect(
      origemPropria(
        pedido({ origin: "https://outro.exemplo", host: ANFITRIAO }),
      ),
    ).toBe(false);
  });

  /**
   * Sem cabeçalho de origem, o envio não é de formulário de navegador
   * moderno. Preferimos recusar um caso legítimo raro a aceitar o hostil
   * comum.
   */
  it("sem origem, ou com origem malformada, recusa", () => {
    expect(origemPropria(pedido({ host: ANFITRIAO }))).toBe(false);
    expect(origemPropria(pedido({ origin: "null", host: ANFITRIAO }))).toBe(
      false,
    );
    expect(
      origemPropria(pedido({ origin: "::isto não é url::", host: ANFITRIAO })),
    ).toBe(false);
    expect(origemPropria(pedido({ origin: `https://${ANFITRIAO}` }))).toBe(
      false,
    );
  });
});

/* ------------------------------------------------------------------ *
 * Origem e perfil, nesta ordem
 * ------------------------------------------------------------------ */

describe("conferirPedidoDeMarca", () => {
  it("recusa origem cruzada com 403, antes de olhar quem é", async () => {
    process.env["AUTH_PROFILE"] = "diretoria";
    const recusa = await conferirPedidoDeMarca(
      pedido({ origin: "https://outro.exemplo", host: ANFITRIAO }),
    );
    expect(recusa?.resposta.status).toBe(403);
    expect(await recusa?.resposta.json()).toEqual({
      erro: "origem do envio não confere",
    });
  });

  it.each(PERFIS.filter((p) => !PERFIS_QUE_CONFIGURAM_MARCA.includes(p)))(
    "recusa o perfil %s com 403, dizendo que é o perfil",
    async (perfil) => {
      process.env["AUTH_PROFILE"] = perfil;
      const recusa = await conferirPedidoDeMarca(pedido(PROPRIO));
      expect(recusa?.resposta.status).toBe(403);
      expect(JSON.stringify(await recusa?.resposta.json())).toContain("perfil");
    },
  );

  it.each([...PERFIS_QUE_CONFIGURAM_MARCA])(
    "deixa %s seguir",
    async (perfil) => {
      process.env["AUTH_PROFILE"] = perfil;
      expect(await conferirPedidoDeMarca(pedido(PROPRIO))).toBeNull();
    },
  );
});

/* ------------------------------------------------------------------ *
 * O redirecionamento
 * ------------------------------------------------------------------ */

describe("verTela", () => {
  it("responde 303 com destino relativo, nunca absoluto", () => {
    const resposta = verTela(pedido(PROPRIO), "/configuracoes/marca?feito=x");
    expect(resposta.status).toBe(303);
    expect(resposta.headers.get("location")).toBe(
      "/configuracoes/marca?feito=x",
    );
    expect(resposta.headers.get("location")).not.toContain(ANFITRIAO);
  });
});

/* ------------------------------------------------------------------ *
 * A folha de estilo da marca
 * ------------------------------------------------------------------ */

describe("EstiloDaMarca", () => {
  const CORES = {
    marca: "#0b5cff",
    marcaEscura: "#083fb3",
    destaque: "#0b5cff",
    destaqueSuave: "#c9d8ff",
    barraLateral: "#0b1a3a",
  };

  it("sem marca não emite nada", () => {
    expect(
      renderToStaticMarkup(createElement(EstiloDaMarca, { cores: null })),
    ).toBe("");
  });

  it("emite exatamente uma regra em :root, com uma variável por papel", () => {
    const html = renderToStaticMarkup(
      createElement(EstiloDaMarca, { cores: CORES }),
    );
    expect(html).toBe(
      '<style data-teste="estilo-da-marca">:root{' +
        `${variavelDaMarca("marca")}:#0b5cff;` +
        `${variavelDaMarca("marcaEscura")}:#083fb3;` +
        `${variavelDaMarca("destaque")}:#0b5cff;` +
        `${variavelDaMarca("destaqueSuave")}:#c9d8ff;` +
        `${variavelDaMarca("barraLateral")}:#0b1a3a` +
        "}</style>",
    );
  });

  /**
   * A terceira conferência de forma, no ponto em que o valor entra numa
   * folha de estilo que `unsafe-inline` não protege (H-46). Um valor que
   * fecha a regra é descartado, e o papel fica com o recuo.
   */
  it("descarta cor fora da forma em vez de escapá-la", () => {
    const html = renderToStaticMarkup(
      createElement(EstiloDaMarca, {
        cores: { ...CORES, marca: "#fff}html{display:none}", destaque: "red" },
      }),
    );
    expect(html).not.toContain("display:none");
    expect(html).not.toContain("red");
    expect(html).not.toContain(`${variavelDaMarca("marca")}:`);
    expect(html).toContain(`${variavelDaMarca("marcaEscura")}:#083fb3`);
  });

  it("leva o nonce quando há um", () => {
    const html = renderToStaticMarkup(
      createElement(EstiloDaMarca, { cores: CORES, nonce: "abc123" }),
    );
    expect(html).toContain('nonce="abc123"');
  });

  it("a cor de hoje passa pela mesma forma que a cor da empresa", () => {
    const html = renderToStaticMarkup(
      createElement(EstiloDaMarca, {
        cores: {
          marca: PALETA_CLARA.marca,
          marcaEscura: PALETA_CLARA.marcaEscura,
          destaque: PALETA_CLARA.destaque,
          destaqueSuave: PALETA_CLARA.destaqueSuave,
          barraLateral: PALETA_CLARA.barraLateral,
        },
      }),
    );
    expect(html).toContain(`${variavelDaMarca("marca")}:${PALETA_CLARA.marca}`);
  });
});
