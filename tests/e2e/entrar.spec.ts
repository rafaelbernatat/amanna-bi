import { expect, test } from "@playwright/test";

/**
 * A porta por senha, do jeito que quem apresenta usa.
 *
 * Abrir o endereço do produto, digitar, entrar. Sem terminal, sem link, sem
 * token na barra de endereços — foi o pedido de Produto depois de a primeira
 * publicação travar três vezes na igualdade entre o segredo da máquina e o do
 * servidor (D-CONVITE-apresentacao, T-369).
 *
 * Os testes de unidade provam a decisão e o envelope. Aqui se prova a ligação:
 * formulário na tela, `POST` de verdade, cookie na resposta e painel do outro
 * lado.
 */

test.describe("entrar pelo painel com senha", () => {
  test("a tela de entrada traz o campo, e não o cartão do QR sozinho", async ({
    page,
  }) => {
    await page.goto("/entrar");

    await expect(page.locator('[data-teste="forma-de-senha"]')).toBeVisible();
    await expect(page.locator("#senha")).toHaveAttribute("type", "password");
    await expect(page.getByText("Entrar no painel")).toBeVisible();
  });

  test("a senha errada volta para a entrada, dizendo o motivo", async ({
    page,
  }) => {
    await page.goto("/entrar");
    await page.locator("#senha").fill("nao-e-a-senha");
    await page.locator('[data-teste="entrar-com-senha"]').click();

    await expect(page).toHaveURL(/\/entrar\?motivo=senha/);
    await expect(page.locator('[data-teste="entrar"]')).toHaveAttribute(
      "data-motivo",
      "senha",
    );
  });

  /**
   * A senha certa abre o painel, e o destino pedido e respeitado.
   *
   * O `ir` viaja escondido no formulario e passa por `destinoSeguro` do outro
   * lado — o teste de unidade cobre os enderecos hostis; aqui basta que o
   * caminho honesto funcione.
   */
  test("a senha certa leva ao painel pedido", async ({ page }) => {
    await page.goto("/entrar?ir=%2Ffin%2Fvisao");
    await page.locator("#senha").fill("senha-do-arnes-de-teste");
    await page.locator('[data-teste="entrar-com-senha"]').click();

    await expect(page).toHaveURL(/\/fin\/visao$/);
    await expect(page.locator('[data-teste="painel"]').first()).toBeVisible();
  });

  test("depois de entrar, o cabeçalho oferece o QR da apresentação", async ({
    page,
  }) => {
    await page.goto("/entrar");
    await page.locator("#senha").fill("senha-do-arnes-de-teste");
    await page.locator('[data-teste="entrar-com-senha"]').click();

    await expect(
      page.locator('[data-teste="abrir-apresentacao"]'),
    ).toBeVisible();
  });
});
