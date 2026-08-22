import { expect, test } from "@playwright/test";

/**
 * O arnes de e2e sobe a aplicacao e le uma rota servida (T-005.1).
 *
 * As 13 telas entram em T-126; aqui a unica afirmacao e que o servidor sobe e
 * responde, que e o que o pipeline precisa ter provado antes de F1.
 */
test("a raiz e servida pela aplicacao", async ({ page }) => {
  const resposta = await page.goto("/");

  expect(resposta?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "Painel BI de Controladoria" }),
  ).toBeVisible();
});

test("rota inexistente devolve 404", async ({ page }) => {
  const resposta = await page.goto("/rota-que-nao-existe");

  expect(resposta?.status()).toBe(404);
});
