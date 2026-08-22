import { expect, test } from "@playwright/test";

/**
 * O arnes de e2e sobe a aplicacao e le uma rota servida (T-005.1).
 *
 * Desde T-126 a raiz redireciona para a tela padrao, entao a afirmacao aqui e
 * que o servidor sobe, redireciona e responde. A cobertura das 13 telas fica em
 * `shell.spec.ts`.
 */
test("a raiz e servida pela aplicacao", async ({ page }) => {
  const resposta = await page.goto("/");

  expect(resposta?.status()).toBe(200);
  await expect(page).toHaveURL(/\/rh\/visao$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Visão geral",
  );
});

test("rota inexistente devolve 404", async ({ page }) => {
  const resposta = await page.goto("/rota-que-nao-existe");

  expect(resposta?.status()).toBe(404);
});
