/* eslint-disable no-restricted-syntax --
 * A regra de T-124 existe para a paleta do produto nao se espalhar pelo
 * codigo. A cor que aparece aqui e outra coisa: e o que o site de arnes
 * declara, e o caso existe justamente para provar que ela chega a tela.
 */
import { expect, test, type Page } from "@playwright/test";

/**
 * A personalização visual por empresa (D-MARCA).
 *
 * ## Por que estes casos rodam em série
 *
 * A marca vale para a **instalação inteira**, e o arnês tem um servidor só:
 * um caso que aplica marca muda a tela do caso seguinte. Rodar em série e
 * limpar ao fim de cada um é o que torna o resultado repetível — a alternativa
 * seria uma rota de reinício, e um endereço que zera estado é buraco que fica.
 *
 * A série vale **entre os dois tamanhos de tela também**: `playwright.config.ts`
 * põe este arquivo em dois projetos próprios, um dependente do outro, porque
 * o `limpar` de um tamanho apagava a proposta que o outro ia aplicar.
 *
 * ## O que este arquivo não cobre, e onde isso está coberto
 *
 * O perfil vem do ambiente do processo (`AUTH_PROFILE`), então não dá para
 * exercitar "o botão não aparece para RH" sem subir um segundo servidor. A
 * matriz de quem configura é teste de unidade, que percorre os cinco perfis;
 * aqui fica o caminho de quem pode.
 *
 * O servidor sobe com `MARCA_ARMAZEM=memoria` e `MARCA_SITE=fixtures` (ver
 * `playwright.config.ts`). A guarda de endereço **não** é afrouxada por isso:
 * ela vale nos dois modos, e o teste de unidade confere os dois com a mesma
 * tabela de recusa.
 */

test.describe.configure({ mode: "serial" });

const SITE = "dreamy.com.br";
/** A cor que o site de arnês declara em `theme-color`. */
const COR_DO_SITE = "rgb(11, 92, 255)";

/** Um PNG de um pixel, para o envio manual. O tipo sai destes bytes. */
const PNG_DE_UM_PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);
/** Um vetor com script: a conferência dos bytes recusa, e a tela diz. */
const SVG_PERIGOSO = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg"><script>x()</script></svg>',
);

async function limpar(page: Page) {
  await page.goto("/configuracoes/marca");
  const voltar = page.locator('[data-teste="limpar-marca"]');
  if (await voltar.isVisible()) await voltar.click();
  const descartar = page.locator('[data-teste="descartar-marca"]');
  if (await descartar.isVisible()) await descartar.click();
}

test.afterEach(async ({ page }) => {
  await limpar(page);
});

/** A cor computada de um elemento, como o navegador a resolve. */
async function corDeFundo(page: Page, seletor: string): Promise<string> {
  return page
    .locator(seletor)
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor);
}

test.describe("o caminho até as configurações", () => {
  test("o cabeçalho mostra quem entrou e leva às configurações", async ({
    page,
  }) => {
    await page.goto("/rh/visao");

    const conta = page.locator('[data-teste="conta"]');
    await expect(conta).toBeVisible();
    await expect(page.locator('[data-teste="perfil-da-sessao"]')).toHaveText(
      "Diretoria",
    );

    await page.locator('[data-teste="abrir-configuracoes"]').click();
    await expect(page).toHaveURL(/\/configuracoes\/marca$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "A marca da empresa neste painel",
    );
  });

  test("sem marca configurada, o painel abre no tema padrão", async ({
    page,
  }) => {
    await page.goto("/configuracoes/marca");
    await expect(page.locator('[data-teste="marca-atual"]')).toHaveAttribute(
      "data-tem-marca",
      "0",
    );

    await page.goto("/rh/visao");
    // Nenhuma variável de marca é emitida: o recuo de cada `var()` vale.
    await expect(page.locator('[data-teste="estilo-da-marca"]')).toHaveCount(0);
    await expect(page.locator('[data-teste="logo-da-marca"]')).toHaveCount(0);
  });
});

test.describe("o fluxo inteiro", () => {
  test("informar o site, ver a proposta, aplicar, e o painel muda", async ({
    page,
  }) => {
    // A cor de hoje, medida na tela: é contra ela que a mudança se prova.
    await page.goto("/rh/visao");
    const antes = await corDeFundo(page, '[data-teste="aplicar-filtros"]');
    expect(antes).not.toBe(COR_DO_SITE);

    await page.goto("/configuracoes/marca");
    await page.locator('[data-teste="campo-do-site"]').fill(SITE);
    await page.locator('[data-teste="buscar-marca"]').click();

    /* --- a proposta, antes de qualquer coisa mudar --- */

    const proposta = page.locator('[data-teste="proposta"]');
    await expect(proposta).toBeVisible();
    await expect(proposta).toContainText("dreamy.com.br");

    // As cinco cores, com a cor que o site declara na primeira.
    const amostras = proposta.locator('[data-teste="amostra-de-cor"]');
    await expect(amostras).toHaveCount(5);
    await expect(amostras.filter({ hasText: "Ação" }).first()).toHaveAttribute(
      "data-cor",
      "#0b5cff",
    );

    // O logo encontrado no site.
    await expect(
      proposta.locator('[data-teste="logo-da-proposta"]'),
    ).toHaveAttribute("data-tem-logo", "1");

    // Nada foi aplicado ainda: o painel continua como estava.
    await page.goto("/rh/visao");
    expect(await corDeFundo(page, '[data-teste="aplicar-filtros"]')).toBe(
      antes,
    );

    /* --- aplicar --- */

    await page.goto("/configuracoes/marca");
    await page.locator('[data-teste="aplicar-marca"]').click();
    await expect(page.locator('[data-teste="marca-feito"]')).toBeVisible();
    await expect(page.locator('[data-teste="marca-atual"]')).toHaveAttribute(
      "data-tem-marca",
      "1",
    );

    /* --- o painel, agora com a cara da empresa --- */

    await page.goto("/rh/visao");
    await expect(page.locator('[data-teste="estilo-da-marca"]')).toHaveCount(1);
    expect(await corDeFundo(page, '[data-teste="aplicar-filtros"]')).toBe(
      COR_DO_SITE,
    );

    const logo = page.locator('[data-teste="logo-da-marca"]');
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute("alt", "dreamy.com.br");

    // A marca é da instalação: vale em qualquer tela, não só na que aplicou.
    await page.goto("/fin/caixa");
    expect(await corDeFundo(page, '[data-teste="aplicar-filtros"]')).toBe(
      COR_DO_SITE,
    );
  });

  test("a rota do logo serve a imagem conferida, com política própria", async ({
    page,
    request,
  }) => {
    await page.goto("/configuracoes/marca");
    await page.locator('[data-teste="campo-do-site"]').fill(SITE);
    await page.locator('[data-teste="buscar-marca"]').click();
    await page.locator('[data-teste="aplicar-marca"]').click();

    const resposta = await request.get("/api/marca/logo");
    expect(resposta.status()).toBe(200);
    // O tipo sai dos bytes conferidos na ingestão, nunca do site de origem.
    expect(resposta.headers()["content-type"]).toBe("image/png");
    expect(resposta.headers()["x-content-type-options"]).toBe("nosniff");
    expect(resposta.headers()["content-security-policy"]).toContain(
      "default-src 'none'",
    );
    expect(resposta.headers()["content-security-policy"]).toContain("sandbox");
    expect(resposta.headers()["etag"]).toBeTruthy();
  });

  test("voltar ao padrão desfaz tudo", async ({ page }) => {
    await page.goto("/configuracoes/marca");
    await page.locator('[data-teste="campo-do-site"]').fill(SITE);
    await page.locator('[data-teste="buscar-marca"]').click();
    await page.locator('[data-teste="aplicar-marca"]').click();

    await page.goto("/rh/visao");
    expect(await corDeFundo(page, '[data-teste="aplicar-filtros"]')).toBe(
      COR_DO_SITE,
    );

    await page.goto("/configuracoes/marca");
    await page.locator('[data-teste="limpar-marca"]').click();
    await expect(page.locator('[data-teste="marca-atual"]')).toHaveAttribute(
      "data-tem-marca",
      "0",
    );

    await page.goto("/rh/visao");
    await expect(page.locator('[data-teste="estilo-da-marca"]')).toHaveCount(0);
    expect(await corDeFundo(page, '[data-teste="aplicar-filtros"]')).not.toBe(
      COR_DO_SITE,
    );
  });

  test("descartar a proposta não aplica nada", async ({ page }) => {
    await page.goto("/configuracoes/marca");
    await page.locator('[data-teste="campo-do-site"]').fill(SITE);
    await page.locator('[data-teste="buscar-marca"]').click();
    await expect(page.locator('[data-teste="proposta"]')).toBeVisible();

    await page.locator('[data-teste="descartar-marca"]').click();
    await expect(page.locator('[data-teste="proposta"]')).toHaveCount(0);
    await expect(page.locator('[data-teste="marca-atual"]')).toHaveAttribute(
      "data-tem-marca",
      "0",
    );
  });
});

test.describe("o caminho manual", () => {
  test("nome, cores e logo informados à mão viram proposta, e aplicar muda o painel", async ({
    page,
    request,
  }) => {
    await page.goto("/configuracoes/marca");
    await page.locator('[data-teste="caminho-manual"] summary').click();

    await page.locator('[data-teste="campo-do-nome"]').fill("Dreamy S.A.");
    // A cor da empresa, que passa no contraste; e uma que reprova.
    await page.locator('[data-teste="cor-marca"]').fill("#0b5cff");
    await page.locator('[data-teste="cor-destaque"]').fill("#ffcc00");
    await page.locator('[data-teste="campo-do-logo"]').setInputFiles({
      name: "logo.png",
      mimeType: "image/png",
      buffer: PNG_DE_UM_PIXEL,
    });
    await page.locator('[data-teste="propor-manual"]').click();

    /* --- a proposta --- */

    const proposta = page.locator('[data-teste="proposta"]');
    await expect(proposta).toBeVisible();
    await expect(proposta).toHaveAttribute("data-origem", "manual");
    await expect(proposta).toContainText("Dreamy S.A.");

    const amostras = proposta.locator('[data-teste="amostra-de-cor"]');
    await expect(amostras).toHaveCount(5);
    await expect(
      proposta.locator('[data-teste="amostra-de-cor"][data-papel="marca"]'),
    ).toHaveAttribute("data-cor", "#0b5cff");

    // O amarelo reprovou no contraste: a original aparece riscada.
    await expect(proposta.locator('[data-teste="cor-original"]')).toContainText(
      "#ffcc00",
    );
    await expect(
      proposta.locator('[data-teste="logo-da-proposta"]'),
    ).toHaveAttribute("data-tem-logo", "1");

    /* --- aplicar --- */

    await page.locator('[data-teste="aplicar-marca"]').click();
    await expect(page.locator('[data-teste="marca-feito"]')).toBeVisible();
    const atual = page.locator('[data-teste="marca-atual"]');
    await expect(atual).toHaveAttribute("data-tem-marca", "1");
    await expect(atual).toHaveAttribute("data-origem", "manual");
    await expect(atual).toContainText("cores informadas à mão");

    /* --- o painel --- */

    await page.goto("/rh/visao");
    expect(await corDeFundo(page, '[data-teste="aplicar-filtros"]')).toBe(
      COR_DO_SITE,
    );
    const logo = page.locator('[data-teste="logo-da-marca"]');
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute("alt", "Dreamy S.A.");

    const resposta = await request.get("/api/marca/logo");
    expect(resposta.status()).toBe(200);
    expect(resposta.headers()["content-type"]).toBe("image/png");
  });

  test("sem logo, o nome informado aparece escrito no cabeçalho", async ({
    page,
  }) => {
    await page.goto("/configuracoes/marca");
    await page.locator('[data-teste="caminho-manual"] summary').click();
    await page.locator('[data-teste="campo-do-nome"]').fill("Dreamy S.A.");
    await page.locator('[data-teste="propor-manual"]').click();
    await page.locator('[data-teste="aplicar-marca"]').click();

    await page.goto("/rh/visao");
    await expect(page.locator('[data-teste="logo-da-marca"]')).toHaveCount(0);
    await expect(page.locator('[data-teste="nome-da-instalacao"]')).toHaveText(
      "Dreamy S.A.",
    );
  });

  test("um vetor com script é recusado, e o logo em uso continua", async ({
    page,
  }) => {
    // Primeiro uma marca com logo, pelo site de arnês.
    await page.goto("/configuracoes/marca");
    await page.locator('[data-teste="campo-do-site"]').fill(SITE);
    await page.locator('[data-teste="buscar-marca"]').click();
    await page.locator('[data-teste="aplicar-marca"]').click();

    await page.locator('[data-teste="caminho-manual"] summary').click();
    await page.locator('[data-teste="campo-do-logo"]').setInputFiles({
      name: "logo.svg",
      mimeType: "image/svg+xml",
      buffer: SVG_PERIGOSO,
    });
    await page.locator('[data-teste="propor-manual"]').click();

    const proposta = page.locator('[data-teste="proposta"]');
    await expect(proposta).toBeVisible();
    const recusado = proposta.locator('[data-teste="logo-recusado"]');
    await expect(recusado).toBeVisible();
    await expect(recusado).toContainText("script");
    await expect(recusado).toContainText("continua");
    await expect(
      proposta.locator('[data-teste="logo-da-proposta"]'),
    ).toHaveAttribute("data-tem-logo", "1");
  });

  test("nome longo demais é recusado pela rota, sem proposta", async ({
    page,
    baseURL,
  }) => {
    await page.goto("/configuracoes/marca");
    const resposta = await page.request.post("/api/marca/manual", {
      headers: { origin: baseURL ?? "" },
      maxRedirects: 0,
      multipart: {
        nome: "x".repeat(80),
        marca: "#0b5cff",
        marcaEscura: "#083fb3",
        destaque: "#0b5cff",
        destaqueSuave: "#c9d8ff",
        barraLateral: "#0b1a3a",
      },
    });
    expect(resposta.status()).toBe(303);
    expect(resposta.headers()["location"]).toContain("erro=nome");

    await page.goto("/configuracoes/marca");
    await expect(page.locator('[data-teste="proposta"]')).toHaveCount(0);
  });

  test("envio de outra origem é recusado antes de ler o corpo", async ({
    page,
  }) => {
    await page.goto("/configuracoes/marca");
    const resposta = await page.request.post("/api/marca/manual", {
      headers: { origin: "https://outro.exemplo" },
      maxRedirects: 0,
      multipart: { nome: "Dreamy" },
    });
    expect(resposta.status()).toBe(403);
  });
});

test.describe("o que a tela recusa", () => {
  test("endereço de rede interna é recusado, e nada é gravado", async ({
    page,
  }) => {
    await page.goto("/configuracoes/marca");
    await page
      .locator('[data-teste="campo-do-site"]')
      .fill("http://localhost/");
    await page.locator('[data-teste="buscar-marca"]').click();

    const recusa = page.locator('[data-teste="marca-recusa"]');
    await expect(recusa).toBeVisible();
    // A frase não conta nada sobre a rede interna.
    await expect(recusa).not.toContainText(/127\.|interna|privad/i);

    await expect(page.locator('[data-teste="proposta"]')).toHaveCount(0);
    await expect(page.locator('[data-teste="marca-atual"]')).toHaveAttribute(
      "data-tem-marca",
      "0",
    );
  });

  test("campo vazio pede o endereço em vez de buscar", async ({ page }) => {
    await page.goto("/configuracoes/marca");
    await page.locator('[data-teste="campo-do-site"]').fill("");
    await page.locator('[data-teste="buscar-marca"]').click();
    await expect(page.locator('[data-teste="marca-erro"]')).toBeVisible();
  });
});

test.describe("a marca não quebra o que já existia", () => {
  test("a tela com marca aplicada não tem violação de política", async ({
    page,
  }) => {
    const violacoes: string[] = [];
    page.on("console", (mensagem) => {
      if (/Refused to|Content Security Policy/i.test(mensagem.text())) {
        violacoes.push(mensagem.text());
      }
    });

    await page.goto("/configuracoes/marca");
    await page.locator('[data-teste="campo-do-site"]').fill(SITE);
    await page.locator('[data-teste="buscar-marca"]').click();
    await page.locator('[data-teste="aplicar-marca"]').click();

    await page.goto("/rh/visao", { waitUntil: "networkidle" });
    expect(violacoes).toEqual([]);
  });

  test("aplicar marca não desloca o layout nem faz o corpo rolar na horizontal", async ({
    page,
  }) => {
    await page.goto("/configuracoes/marca");
    await page.locator('[data-teste="campo-do-site"]').fill(SITE);
    await page.locator('[data-teste="buscar-marca"]').click();
    await page.locator('[data-teste="aplicar-marca"]').click();

    await page.addInitScript(() => {
      (window as unknown as { __cls: number }).__cls = 0;
      new PerformanceObserver((lista) => {
        for (const entrada of lista.getEntries()) {
          const deslocamento = entrada as PerformanceEntry & {
            value: number;
            hadRecentInput: boolean;
          };
          if (!deslocamento.hadRecentInput) {
            (window as unknown as { __cls: number }).__cls +=
              deslocamento.value;
          }
        }
      }).observe({ type: "layout-shift", buffered: true });
    });

    await page.goto("/rh/visao", { waitUntil: "networkidle" });
    await page.evaluate(
      () =>
        new Promise<void>((ok) =>
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              ok();
            }),
          ),
        ),
    );

    const cls = await page.evaluate(
      () => (window as unknown as { __cls: number }).__cls,
    );
    expect(cls, "o logo deslocou o layout").toBe(0);

    const excedeu = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(excedeu).toBe(false);
  });
});
