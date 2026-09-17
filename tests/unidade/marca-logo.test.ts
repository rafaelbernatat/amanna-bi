import { describe, expect, it } from "vitest";

import {
  baixarLogo,
  conferirLogo,
  construcaoPerigosa,
  LADO_MAXIMO,
  TETO_DO_LOGO,
  tipoPelosBytes,
} from "@/marca/logo";
import {
  PERFIS_QUE_CONFIGURAM_MARCA,
  podeConfigurarMarca,
} from "@/marca/permissao";
import { criarFonteDeFixtures } from "@/marca/site/fixtures";
import { PNG_DE_UM_PIXEL } from "@/marca/site/paginas";
import { PERFIS } from "@/seguranca/identidade";

/**
 * O logo e a permissão (D-MARCA).
 *
 * O logo é o único byte de terceiro que o produto passa a servir. As duas
 * garantias que este arquivo sustenta: o tipo sai dos bytes, nunca do
 * cabeçalho declarado; e vetor com script é **recusado**, não limpo.
 */

const png = Buffer.from(PNG_DE_UM_PIXEL, "base64");
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const webp = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.from([0, 0, 0, 0]),
  Buffer.from("WEBP"),
]);
const svg = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>',
);

function bytes(b: Buffer): Uint8Array {
  return Uint8Array.from(b);
}

describe("o tipo sai dos bytes, nunca do cabeçalho", () => {
  it.each([
    ["png", png, "image/png"],
    ["jpeg", jpeg, "image/jpeg"],
    ["webp", webp, "image/webp"],
    ["svg", svg, "image/svg+xml"],
  ] as const)("reconhece %s", (_, conteudo, tipo) => {
    expect(tipoPelosBytes(bytes(conteudo))).toBe(tipo);
  });

  it("reconhece svg depois de declaração, tipo de documento e comentário", () => {
    const enfeitado = Buffer.from(
      '<?xml version="1.0"?>\n<!-- um comentário -->\n<svg xmlns="x"></svg>',
    );
    expect(tipoPelosBytes(bytes(enfeitado))).toBe("image/svg+xml");
  });

  it.each([
    [
      "um script travestido de imagem",
      Buffer.from("<script>roubar()</script>"),
    ],
    ["um ícone antigo", Buffer.from([0x00, 0x00, 0x01, 0x00])],
    ["um gif", Buffer.from("GIF89a")],
    ["texto qualquer", Buffer.from("não sou imagem")],
  ])("recusa %s", (_, conteudo) => {
    expect(tipoPelosBytes(bytes(conteudo))).toBeNull();
  });

  /**
   * O ataque que esta conferência existe para impedir.
   *
   * Um `content-type: image/png` num arquivo que começa com `<script` é
   * precisamente o caso. O cabeçalho `nosniff` que o produto manda só ajuda se
   * **nós** declararmos o tipo certo, e só sabemos o tipo certo porque
   * olhamos os bytes.
   */
  it("script com cabeçalho de imagem é recusado", () => {
    const conferido = conferirLogo(
      bytes(Buffer.from("<script>roubar()</script>")),
      "https://empresa.com.br/logo.png",
    );
    expect(conferido.ok).toBe(false);
    if (conferido.ok) return;
    expect(conferido.motivo).toBe("tipo_nao_reconhecido");
  });
});

describe("vetor perigoso é recusado, não limpo", () => {
  it.each([
    ["script", "<svg><script>roubar()</script></svg>", "script"],
    [
      "manipulador de evento",
      '<svg onload="roubar()"></svg>',
      "manipulador de evento",
    ],
    [
      "objeto estrangeiro",
      "<svg><foreignObject><b>x</b></foreignObject></svg>",
      "objeto estrangeiro",
    ],
    [
      "endereço javascript",
      '<svg><a xlink:href="javascript:roubar()"></a></svg>',
      "endereço javascript:",
    ],
    [
      "referência externa",
      '<svg><image href="https://outro.com/x.png"/></svg>',
      "referência externa",
    ],
    [
      "importação de estilo",
      "<svg><style>@import url(x)</style></svg>",
      "importação de estilo",
    ],
    [
      "quadro embutido",
      "<svg><iframe src=x></iframe></svg>",
      "quadro embutido",
    ],
  ])("recusa %s e diz qual construção achou", (_, conteudo, detalhe) => {
    expect(construcaoPerigosa(conteudo)).toBe(detalhe);

    const conferido = conferirLogo(
      bytes(Buffer.from(conteudo)),
      "https://empresa.com.br/logo.svg",
    );
    expect(conferido.ok).toBe(false);
    if (conferido.ok) return;
    expect(conferido.motivo).toBe("vetor_perigoso");
    expect(conferido.detalhe).toBe(detalhe);
  });

  it("vetor que é só desenho passa", () => {
    expect(construcaoPerigosa(svg.toString())).toBeNull();
    expect(conferirLogo(bytes(svg), "https://empresa.com.br/x.svg").ok).toBe(
      true,
    );
  });

  it("referência interna e imagem embutida continuam valendo", () => {
    expect(construcaoPerigosa('<svg><use href="#simbolo"/></svg>')).toBeNull();
    expect(
      construcaoPerigosa('<svg><image href="data:image/png;base64,AA"/></svg>'),
    ).toBeNull();
  });
});

describe("os tetos", () => {
  it("recusa acima do teto de bytes", () => {
    const gordo = Buffer.concat([png, Buffer.alloc(TETO_DO_LOGO)]);
    const conferido = conferirLogo(
      bytes(gordo),
      "https://empresa.com.br/x.png",
    );
    expect(conferido.ok).toBe(false);
    if (conferido.ok) return;
    expect(conferido.motivo).toBe("grande_demais");
  });

  it("recusa imagem com lado maior que o permitido", () => {
    // Um PNG com IHDR forjado, declarando um lado enorme.
    const enorme = Buffer.from(png);
    enorme.writeUInt32BE(LADO_MAXIMO + 1, 16);
    const conferido = conferirLogo(
      bytes(enorme),
      "https://empresa.com.br/x.png",
    );
    expect(conferido.ok).toBe(false);
    if (conferido.ok) return;
    expect(conferido.motivo).toBe("dimensao_demais");
  });

  it("arquivo vazio é recusado", () => {
    const conferido = conferirLogo(
      new Uint8Array(),
      "https://empresa.com.br/x",
    );
    expect(conferido.ok).toBe(false);
  });
});

describe("o logo aceito", () => {
  it("guarda tipo, tamanho, origem e impressão", () => {
    const conferido = conferirLogo(
      bytes(png),
      "https://dreamy.com.br/logo.png",
    );
    expect(conferido.ok).toBe(true);
    if (!conferido.ok) return;
    expect(conferido.logo.tipo).toBe("image/png");
    expect(conferido.logo.bytes).toBe(png.byteLength);
    expect(conferido.logo.origem).toBe("https://dreamy.com.br/logo.png");
    expect(conferido.logo.impressao).toMatch(/^[0-9a-f]{64}$/);
  });

  /** A impressão é o que garante que se serve o que foi aprovado. */
  it("um byte diferente muda a impressão", () => {
    const outro = Buffer.from(png);
    outro[outro.length - 1] = (outro[outro.length - 1] ?? 0) ^ 0xff;
    const um = conferirLogo(bytes(png), "x");
    const dois = conferirLogo(bytes(outro), "x");
    if (!um.ok || !dois.ok) return;
    expect(um.logo.impressao).not.toBe(dois.logo.impressao);
  });

  it("baixa pelo adaptador e confere", async () => {
    const baixado = await baixarLogo(
      "https://dreamy.com.br/marca/dreamy-192.png",
      criarFonteDeFixtures(),
    );
    expect(baixado.ok).toBe(true);
  });

  it("endereço que a guarda recusa não vira logo", async () => {
    const baixado = await baixarLogo(
      "https://169.254.169.254/logo.png",
      criarFonteDeFixtures(),
    );
    expect(baixado.ok).toBe(false);
  });
});

describe("quem configura a marca", () => {
  it("só diretoria e controller", () => {
    expect([...PERFIS_QUE_CONFIGURAM_MARCA]).toEqual([
      "diretoria",
      "controller",
    ]);
  });

  /**
   * Percorre os cinco perfis, para que um perfil novo force uma decisão em vez
   * de herdar permissão por omissão.
   */
  it.each(PERFIS)("o perfil %s", (perfil) => {
    const esperado = perfil === "diretoria" || perfil === "controller";
    expect(podeConfigurarMarca(perfil)).toBe(esperado);
  });
});
