import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  CONTEINER_DA_TELA,
  EstiloDoMenu,
} from "@/apresentacao/navegacao/EstiloDoMenu";
import {
  cookieDoMenu,
  DURACAO_DO_MENU,
  estadoDoMenuValido,
  LARGURA_DO_MENU_ABERTO,
  LARGURA_DO_MENU_RECOLHIDO,
  LARGURA_MINIMA_PARA_MENU_ABERTO,
  NOME_DO_COOKIE_DO_MENU,
} from "@/apresentacao/navegacao/menu";

/**
 * O que e puro no menu lateral (T-421): o estado que o cookie carrega, o texto
 * do cookie que o navegador grava, e a folha que recolhe por consulta de
 * conteiner.
 */
describe("o menu lateral", () => {
  it("so aberto e recolhido sao estados", () => {
    expect(estadoDoMenuValido("aberto")).toBe(true);
    expect(estadoDoMenuValido("recolhido")).toBe(true);
    expect(estadoDoMenuValido("fechado")).toBe(false);
    expect(estadoDoMenuValido("")).toBe(false);
  });

  it("o cookie leva o estado, o caminho, a duracao e o samesite; secure so em https", () => {
    const comum = cookieDoMenu("recolhido", false);
    expect(comum).toContain(`${NOME_DO_COOKIE_DO_MENU}=recolhido`);
    expect(comum).toContain("path=/");
    expect(comum).toContain(`max-age=${String(DURACAO_DO_MENU)}`);
    expect(comum).toContain("samesite=lax");
    expect(comum).not.toContain("secure");
    expect(cookieDoMenu("aberto", true)).toContain("; secure");
  });

  it("a faixa recolhida e menor que o menu aberto, e o minimo da tela e maior que ele", () => {
    expect(LARGURA_DO_MENU_RECOLHIDO).toBeLessThan(LARGURA_DO_MENU_ABERTO);
    expect(LARGURA_MINIMA_PARA_MENU_ABERTO).toBeGreaterThan(
      LARGURA_DO_MENU_ABERTO,
    );
  });

  it("a folha recolhe o menu por consulta de conteiner abaixo do minimo, e leva o nonce", () => {
    const html = renderToStaticMarkup(
      createElement(EstiloDoMenu, { nonce: "n0nce" }),
    );
    expect(html).toContain('nonce="n0nce"');
    expect(html).toContain(
      `@container ${CONTEINER_DA_TELA} (max-width: ${String(LARGURA_MINIMA_PARA_MENU_ABERTO - 1)}px)`,
    );
    expect(html).toContain(
      `width:${String(LARGURA_DO_MENU_RECOLHIDO)}px !important`,
    );
    // Sem nonce, sem atributo: a folha nao inventa um.
    expect(renderToStaticMarkup(createElement(EstiloDoMenu, {}))).not.toContain(
      "nonce=",
    );
  });
});
