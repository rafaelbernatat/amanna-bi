import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

import { corCanonica } from "@/apresentacao/tema/contraste";
import {
  CHAVES_DE_MARCA,
  MARCA,
  PALETA,
  variavelDaMarca,
  type ChaveDeMarca,
} from "@/apresentacao/tema/tema";
import {
  corDaCategoria,
  SEQUENCIA_CATEGORICA,
} from "@/apresentacao/tema/sequencia";

/**
 * A camada viva do tema, e a regra que a mantém no lugar certo (D-MARCA).
 *
 * A regra é de papel, e dá para verificar: **moldura lê `MARCA`, gráfico lê
 * `PALETA`**. Ela existe por duas razões concretas, e as duas viram teste
 * aqui:
 *
 * 1. `var()` não é substituído em atributo de apresentação de SVG. Uma série
 *    pintada com `var(--bi-marca, …)` sairia invisível.
 * 2. Um SVG serializado para fora do documento — a exportação de T-409 e
 *    T-410 — perde o `:root` junto, e o arquivo exportado sairia com a cor
 *    errada em silêncio.
 */

const RAIZ = process.cwd();

function varrer(pasta: string): string[] {
  const achados: string[] = [];
  for (const nome of readdirSync(pasta)) {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) achados.push(...varrer(caminho));
    else if (/\.tsx?$/.test(nome)) achados.push(caminho);
  }
  return achados;
}

function semComentarios(caminho: string): string {
  return readFileSync(join(RAIZ, caminho), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const APRESENTACAO = varrer(join(RAIZ, "src", "apresentacao")).map((c) =>
  relative(RAIZ, c),
);
const DE_GRAFICO = APRESENTACAO.filter((c) =>
  c.startsWith(join("src", "apresentacao", "graficos") + sep),
);

/** O arquivo importa `MARCA` do tema? Nome que so coincide nao conta. */
function importaMarca(fonte: string): boolean {
  const IMPORTA =
    /import\s*\{[^}]*\bMARCA\b[^}]*\}\s*from\s*["']@\/apresentacao\/tema\/tema["']/;
  return IMPORTA.test(fonte);
}

/* ------------------------------------------------------------------ *
 * A camada
 * ------------------------------------------------------------------ */

describe("a camada viva do tema", () => {
  it("cobre cinco dos vinte e quatro papéis", () => {
    expect(CHAVES_DE_MARCA).toHaveLength(5);
    expect(Object.keys(PALETA)).toHaveLength(24);
  });

  /**
   * Os papéis que **não** entram, e a razão de cada grupo.
   *
   * Fundo e texto sustentam a legibilidade medida; as cores de sentido são
   * semânticas, e a seção 13 diz que cor nunca é o único sinal — deixar o
   * cliente escolher a cor de "prejuízo" seria deixá-lo mudar o que um número
   * significa.
   */
  it.each(["fundo", "texto", "positivo", "negativo", "comparacao", "meta"])(
    "%s continua fora do alcance da marca",
    (papel) => {
      expect((CHAVES_DE_MARCA as readonly string[]).includes(papel)).toBe(
        false,
      );
    },
  );

  it("cada papel de marca é uma variável CSS com a cor de hoje como recuo", () => {
    for (const chave of CHAVES_DE_MARCA) {
      expect(MARCA[chave]).toBe(
        `var(${variavelDaMarca(chave)}, ${PALETA[chave]})`,
      );
    }
  });

  /**
   * O recuo é o que faz a personalização ser aditiva: uma instalação que nunca
   * configurou nada não tem como notar que esta camada existe.
   */
  it("o recuo de cada variável é exatamente a cor de hoje", () => {
    for (const chave of CHAVES_DE_MARCA) {
      const recuo = /,\s*(#[0-9a-f]{6})\)$/.exec(MARCA[chave])?.[1];
      expect(recuo, chave).toBe(PALETA[chave]);
      expect(corCanonica(recuo ?? "")).toBe(true);
    }
  });

  it("a variável de cada papel leva o nome do próprio papel", () => {
    for (const chave of CHAVES_DE_MARCA) {
      expect(MARCA[chave]).toContain(`--bi-${chave}`);
    }
  });

  it("a paleta crua continua sendo só hexadecimal", () => {
    for (const [chave, valor] of Object.entries(PALETA)) {
      expect(corCanonica(valor), chave).toBe(true);
    }
  });
});

/* ------------------------------------------------------------------ *
 * A regra de papel
 * ------------------------------------------------------------------ */

describe("gráfico não lê a camada viva", () => {
  /**
   * A rampa categórica e as cores de sentido pintam SVG, e por isso vêm da
   * paleta crua. Se alguma virasse `var()`, a série sairia invisível.
   */
  it("toda cor da sequência categórica é hexadecimal", () => {
    for (const cor of SEQUENCIA_CATEGORICA) {
      expect(corCanonica(cor)).toBe(true);
    }
    expect(corCanonica(corDaCategoria(0))).toBe(true);
    // Dá a volta depois de oito, e continua hexadecimal.
    expect(corCanonica(corDaCategoria(9))).toBe(true);
  });

  it("nenhum componente de gráfico importa MARCA do tema", () => {
    const infratores = DE_GRAFICO.filter((c) =>
      importaMarca(semComentarios(c)),
    );
    expect(infratores).toEqual([]);
  });

  it("o desenho de painel também não: ele atribui cor de série", () => {
    const desenho = join(
      "src",
      "apresentacao",
      "paineis",
      "DesenhoDePainel.tsx",
    );
    expect(importaMarca(semComentarios(desenho))).toBe(false);
  });

  /**
   * A guarda pega uma violação plantada?
   *
   * Sem isto, a regra passaria mesmo com a busca quebrada — e ela quase ficou
   * quebrada: a primeira versão procurava o identificador solto, e um gráfico
   * tem uma constante local de mesmo nome, a largura de um marcador em pixels.
   * O que a regra diz é "não importa do tema", e é isso que ela mede.
   */
  it("a regra reprova a importação, e ignora nome que só coincide", () => {
    expect(
      importaMarca('import { MARCA } from "@/apresentacao/tema/tema";'),
    ).toBe(true);
    expect(
      importaMarca('import { MARCA, PALETA } from "@/apresentacao/tema/tema";'),
    ).toBe(true);
    expect(importaMarca("const MARCA = 6;")).toBe(false);
  });
});

/* ------------------------------------------------------------------ *
 * A moldura
 * ------------------------------------------------------------------ */

describe("a moldura lê a camada viva", () => {
  const MOLDURA = [
    join("src", "apresentacao", "shell", "Cabecalho.tsx"),
    join("src", "apresentacao", "filtros", "BarraDeFiltros.tsx"),
    join("src", "apresentacao", "filtros", "BannerDeRecorte.tsx"),
    join("src", "apresentacao", "paineis", "Painel.tsx"),
    join("src", "apresentacao", "chat", "Chat.tsx"),
  ];

  it.each(MOLDURA)("%s usa MARCA", (caminho) => {
    expect(/\bMARCA\./.test(semComentarios(caminho))).toBe(true);
  });

  /**
   * O que fecha a regra: nenhum arquivo de moldura pode ler um papel de marca
   * direto da paleta crua. Um `PALETA.marca` esquecido num botão seria uma cor
   * que a empresa troca em todo lugar menos ali.
   */
  it.each(MOLDURA)("%s não lê papel de marca pela paleta crua", (caminho) => {
    const fonte = semComentarios(caminho);
    for (const chave of CHAVES_DE_MARCA) {
      expect(fonte.includes(`PALETA.${chave}`), `${caminho} · ${chave}`).toBe(
        false,
      );
    }
  });

  it("a lista de papéis de marca é exatamente a que o tipo declara", () => {
    const chaves: readonly ChaveDeMarca[] = CHAVES_DE_MARCA;
    expect([...chaves].sort()).toEqual([
      "barraLateral",
      "destaque",
      "destaqueSuave",
      "marca",
      "marcaEscura",
    ]);
  });
});
