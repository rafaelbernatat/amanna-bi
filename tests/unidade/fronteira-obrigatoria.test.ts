/**
 * Nenhum caminho chega ao adaptador sem passar pela fronteira (T-137).
 *
 * O aceite pede uma **regra de arquitetura**, e não um teste de
 * comportamento — a diferença importa. Um teste de comportamento prova que a
 * fronteira funciona quando é usada. Uma regra de arquitetura prova que não
 * existe caminho que a contorne, que é a única versão da promessa da seção 11
 * que sobrevive à décima pessoa entrando no time.
 *
 * A verificação é sobre o **grafo de importação**: `obterFonteDeDados` só pode
 * ser importada dentro de `src/acesso/`, e a interface `DataSource` só pode ser
 * usada como valor lá. Quem está fora recebe `Fronteira`, que não tem como
 * devolver a fonte crua.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

const RAIZ = process.cwd();
const FONTES = join(RAIZ, "src");

/** Todo arquivo de código do produto, com o caminho relativo à raiz. */
function todosOsArquivos(pasta: string): readonly string[] {
  const saida: string[] = [];
  for (const nome of readdirSync(pasta)) {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) {
      saida.push(...todosOsArquivos(caminho));
    } else if (/\.(ts|tsx|mts)$/.test(nome)) {
      saida.push(caminho);
    }
  }
  return saida;
}

const ARQUIVOS = [
  ...todosOsArquivos(FONTES),
  join(RAIZ, "middleware.ts"),
  join(RAIZ, "instrumentation.ts"),
].filter((c) => {
  try {
    return statSync(c).isFile();
  } catch {
    return false;
  }
});

function rel(caminho: string): string {
  return relative(RAIZ, caminho).split(sep).join("/");
}

function naCamadaDeAcesso(caminho: string): boolean {
  return rel(caminho).startsWith("src/acesso/");
}

describe("o grafo de importação", () => {
  it("encontra os arquivos do produto — senão não prova nada", () => {
    // A guarda contra o vácuo: se a varredura devolvesse lista vazia, todos os
    // testes abaixo passariam sem olhar arquivo nenhum.
    expect(ARQUIVOS.length).toBeGreaterThan(20);
    expect(ARQUIVOS.some((c) => rel(c).startsWith("src/acesso/"))).toBe(true);
    expect(ARQUIVOS.some((c) => rel(c).startsWith("src/apresentacao/"))).toBe(
      true,
    );
  });

  it("só a camada de acesso importa a fábrica de fonte de dados", () => {
    const infratores = ARQUIVOS.filter((c) => {
      if (naCamadaDeAcesso(c)) return false;
      const texto = readFileSync(c, "utf8");
      return /\bobterFonteDeDados\b/.test(texto);
    }).map(rel);

    expect(infratores).toEqual([]);
  });

  it("só a camada de acesso importa o provedor de sessão", () => {
    // Mesma razão: uma tela que constrói a própria sessão escolhe o próprio
    // perfil, e aí o escopo da seção 11 é decorativo.
    const infratores = ARQUIVOS.filter((c) => {
      if (naCamadaDeAcesso(c)) return false;
      return /\bgetSession\b|\bsessaoDeFixtures\b/.test(
        readFileSync(c, "utf8"),
      );
    }).map(rel);

    expect(infratores).toEqual([]);
  });

  it("ninguém fora da camada de acesso chama getPanel, getKpis, getMetric ou getMeta", () => {
    /*
     * A regra que fecha o caminho.
     *
     * Mesmo sem importar a fábrica, alguém poderia receber um `DataSource` por
     * parâmetro e chamá-lo direto. Procurar pelos quatro nomes de método pega
     * isso: fora de `src/acesso/`, nenhum deles deve aparecer.
     */
    const metodos = /\.(getPanel|getKpis|getMetric|getMeta)\s*\(/;
    const infratores = ARQUIVOS.filter((c) => {
      if (naCamadaDeAcesso(c)) return false;
      return metodos.test(readFileSync(c, "utf8"));
    }).map(rel);

    expect(infratores).toEqual([]);
  });

  it("a apresentação não importa `pg` nem o SDK da Anthropic", () => {
    const proibidos = /from\s+["'](pg|@anthropic-ai\/[^"']+)["']/;
    const infratores = ARQUIVOS.filter((c) => {
      if (naCamadaDeAcesso(c)) return false;
      return proibidos.test(readFileSync(c, "utf8"));
    }).map(rel);

    expect(infratores).toEqual([]);
  });
});

describe("a regra pega uma violação plantada", () => {
  /**
   * A prova de que os testes acima não passam por não olharem nada.
   *
   * Em vez de escrever um arquivo no repositório — que ficaria para trás se o
   * teste falhasse no meio — a violação é simulada sobre o mesmo predicado que
   * os testes usam.
   */
  const predicados: readonly [string, RegExp, string][] = [
    [
      "uma tela importando a fábrica",
      /\bobterFonteDeDados\b/,
      'import { obterFonteDeDados } from "@/acesso/fabrica";',
    ],
    [
      "uma tela chamando o adaptador direto",
      /\.(getPanel|getKpis|getMetric|getMeta)\s*\(/,
      "const p = await fonte.getPanel(id, q);",
    ],
    [
      "uma tela construindo a própria sessão",
      /\bgetSession\b|\bsessaoDeFixtures\b/,
      "const s = sessaoDeFixtures(process.env);",
    ],
    [
      "uma tela importando o driver do Postgres",
      /from\s+["'](pg|@anthropic-ai\/[^"']+)["']/,
      'import { Pool } from "pg";',
    ],
  ];

  it.each(predicados)("%s seria pega", (_nome, padrao, linha) => {
    expect(padrao.test(linha)).toBe(true);
  });

  it("e código legítimo não é pego por engano", () => {
    // Sem isto, um padrão que casasse com tudo passaria nos quatro acima e
    // reprovaria o repositório inteiro — ou, pior, seria afrouxado até não
    // pegar mais nada.
    const legitimo = [
      'import { criarFronteira } from "@/acesso/fronteira";',
      "const painel = await fronteira.lerPainel(pedido);",
      "const kpis = await fronteira.lerKpis(tela, consulta);",
      'import { PALETA } from "@/apresentacao/tema/tema";',
    ];
    for (const [, padrao] of predicados) {
      for (const linha of legitimo) {
        expect(padrao.test(linha), `${padrao} casou com: ${linha}`).toBe(false);
      }
    }
  });
});
