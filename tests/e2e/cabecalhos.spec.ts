/**
 * Os cabeçalhos de segurança, na resposta de verdade (T-139).
 *
 * Estes testes valem porque rodam contra o servidor. Um teste de unidade sobre
 * `montarCsp()` prova que a string está certa; só a resposta prova que ela
 * chegou ao navegador — e, mais importante, que **a política não quebra a
 * tela**. CSP que derruba o produto é revertida na primeira reclamação, e aí
 * não protege nada.
 */

import { expect, test } from "@playwright/test";

const ROTA = "/rh/visao";

test.describe("os cabeçalhos de segurança", () => {
  test("a resposta traz CSP, HSTS, nosniff e Referrer-Policy", async ({
    page,
  }) => {
    const resposta = await page.goto(ROTA);
    expect(resposta).not.toBeNull();

    const h = resposta!.headers();

    expect(h["content-security-policy"]).toBeDefined();
    expect(h["strict-transport-security"]).toContain("max-age=");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });

  test("script-src não tem unsafe-inline nem unsafe-eval", async ({ page }) => {
    const resposta = await page.goto(ROTA);
    const csp = resposta!.headers()["content-security-policy"] ?? "";

    const scriptSrc =
      csp
        .split(";")
        .map((d) => d.trim())
        .find((d) => d.startsWith("script-src")) ?? "";

    expect(scriptSrc).not.toBe("");
    expect(scriptSrc).not.toContain("unsafe-inline");
    expect(scriptSrc).not.toContain("unsafe-eval");
    // E traz nonce: sem ele, 'strict-dynamic' não teria de onde herdar
    // confiança e os scripts do Next não rodariam.
    expect(scriptSrc).toMatch(/'nonce-[A-Za-z0-9+/=]{16,}'/);
  });

  test("o nonce muda a cada resposta", async ({ page }) => {
    // Nonce reaproveitado devolve ao atacante o que o nonce tira: um valor
    // previsível para colar no script injetado.
    const extrair = async () => {
      const r = await page.goto(ROTA);
      const csp = r!.headers()["content-security-policy"] ?? "";
      return /'nonce-([A-Za-z0-9+/=]+)'/.exec(csp)?.[1] ?? "";
    };
    const primeiro = await extrair();
    const segundo = await extrair();

    expect(primeiro).not.toBe("");
    expect(primeiro).not.toBe(segundo);
  });

  test("frame-ancestors é 'none' e object-src também", async ({ page }) => {
    const resposta = await page.goto(ROTA);
    const csp = resposta!.headers()["content-security-policy"] ?? "";

    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'none'");
  });

  /**
   * A prova de que a política não é decorativa.
   *
   * O navegador reporta cada bloqueio no console. Se a CSP estivesse
   * estrangulando os scripts do Next, a tela subiria quebrada e esta lista
   * viria cheia — e é exatamente esse o modo de falha que faz uma equipe
   * afrouxar a política de volta para `unsafe-inline`.
   */
  test("a tela carrega sem nenhuma violação de CSP", async ({ page }) => {
    const violacoes: string[] = [];
    page.on("console", (m) => {
      const t = m.text();
      if (/Content Security Policy|Refused to (execute|load|apply)/i.test(t)) {
        violacoes.push(t);
      }
    });

    await page.goto(ROTA);
    await page.waitForLoadState("networkidle");

    // O conteúdo de fato apareceu — senão "sem violação" seria só uma página
    // em branco passando calada.
    await expect(page.locator("main")).toBeVisible();
    expect(violacoes).toEqual([]);
  });
});
