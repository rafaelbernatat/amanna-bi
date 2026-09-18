import { expect, test } from "@playwright/test";

/**
 * O caminho que Produto pediu, do painel ao celular da plateia.
 *
 * O painel abre **sem link nenhum** — o arnês roda com `AUTH_PROVIDER=fixtures`
 * — e mesmo assim o botão do QR está no cabeçalho, porque a instalação tem
 * segredo para assinar o convite. Era o contrário até T-365, e o efeito era
 * obrigar quem apresenta a entrar por link no próprio painel.
 *
 * O que estes casos guardam é a ligação inteira: botão na tela, código
 * desenhado, e o endereço sob o código levando à conversa no recorte em que a
 * plateia vai entrar. Os testes de unidade provam os envelopes; aqui se prova
 * que eles chegam a uma página servida por um servidor de verdade.
 */

test.describe("a apresentação por QR, com o painel aberto", () => {
  test("o cabeçalho traz o botão, e ele leva à tela do código", async ({
    page,
  }) => {
    await page.goto("/fin/visao?periodo=dezembro");

    const botao = page.locator('[data-teste="abrir-apresentacao"]');
    await expect(botao).toBeVisible();

    /*
     * O botão abre noutra aba (`target="_blank"`), e por isso o caso segue o
     * endereço em vez de clicar: o que importa é para onde ele aponta.
     */
    const destino = await botao.getAttribute("href");
    expect(destino).not.toBeNull();
    await page.goto(destino ?? "");

    await expect(page.locator('[data-teste="qr"]')).toBeVisible();
  });

  test("o código aponta para a conversa, no recorte da tela", async ({
    page,
  }) => {
    await page.goto(
      "/apresentar?tela=fin/visao&periodo=dezembro&painel=fin-dre",
    );

    await expect(page.locator('[data-teste="qr"]')).toBeVisible();

    const endereco = await page
      .locator('[data-teste="endereco-do-convite"]')
      .textContent();
    expect(endereco ?? "").toContain("/entrar?convite=");
    expect(decodeURIComponent(endereco ?? "")).toContain("/conversa");
    expect(decodeURIComponent(endereco ?? "")).toContain("painel=fin-dre");
  });

  /**
   * Quem escaneia entra sem digitar nada, e entra como plateia.
   *
   * O passe vem do próprio código da tela anterior: é o mesmo caminho da
   * câmera de um celular, sem cadastro e sem senha. Do outro lado ele lê como
   * `auditor`, e por isso a tela de apresentação recusa quem chegou por ali —
   * a prova de que a plateia não herda o perfil de quem apresenta.
   */
  test("escanear abre a conversa, e a plateia não vira apresentador", async ({
    page,
  }) => {
    await page.goto("/apresentar?tela=rh/turnover");
    const endereco = await page
      .locator('[data-teste="endereco-do-convite"]')
      .textContent();

    await page.goto(endereco ?? "");
    await expect(page.locator('[data-teste="chat"]')).toHaveAttribute(
      "data-modo",
      "cheio",
    );

    await page.goto("/apresentar");
    await expect(page.getByText("Você não apresenta")).toBeVisible();
  });
});
