/**
 * A tela não deriva nem escala número algum (T-134).
 *
 * A regra de AST prova isso pelo código: nenhuma conta chega ao formatador.
 * Este arquivo prova pelo **comportamento**, que é a outra metade do aceite —
 * um adaptador de teste devolve valores arbitrários por área, e o que aparece
 * na tela é exatamente o que ele devolveu.
 *
 * ## Por que valores arbitrários, e não plausíveis
 *
 * O achado 4 do Anexo D é uma armadilha de verificação: no protótipo, KPI e
 * painel reconciliavam porque escalavam pelo **mesmo** fator. Números
 * plausíveis e proporcionais escondem exatamente esse defeito — se cada área
 * vale a sua participação no total, um fator de escala produz o mesmo resultado
 * que um recorte de verdade, e o teste passa dos dois jeitos.
 *
 * Por isso as áreas aqui recebem primos sem razão comum entre si, e a razão
 * entre duas medidas muda de área para área. Nenhum fator único reproduz esta
 * tabela: se a tela multiplicasse por qualquer coisa, alguma linha sairia
 * errada.
 *
 * ## Por onde o dado passa
 *
 * Pela fronteira de verdade (T-137/T-138), e não direto no componente: é ela
 * que fica entre o adaptador e a tela em produção, e um fator escondido nela
 * seria invisível para um teste que a pulasse.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { dimensoesProvisorias } from "@/acesso/dimensoes-provisorias";
import { criarFronteira } from "@/acesso/fronteira";
import { formatarValor } from "@/apresentacao/formato/formato";
import { DesenhoDePainel } from "@/apresentacao/paineis/DesenhoDePainel";
import type {
  DataSource,
  Kpi,
  Meta,
  MetricValue,
  PanelResponse,
  Query,
  Unidade,
} from "@/semantica/contrato";
import { QUERY_PADRAO } from "@/semantica/contrato";
import { formula } from "@/semantica/painel";
import type { AccessScope } from "@/seguranca/identidade";

/* ------------------------------------------------------------------ *
 * O dado arbitrário
 * ------------------------------------------------------------------ */

/**
 * Sete áreas, dois números cada, sem razão comum.
 *
 * `operacoes` tem 4.871 de quadro e 13 de folha; `comercial` tem 97 e 2.609. A
 * razão entre as duas medidas é 375 numa área e 0,04 na outra — um fator de
 * escala por área, como o `hc` e o `money` do protótipo, não consegue produzir
 * as duas colunas ao mesmo tempo.
 */
const POR_AREA = [
  { area: "operacoes", quadro: 4871, folha: 13 },
  { area: "comercial", quadro: 97, folha: 2609 },
  { area: "tecnologia", quadro: 1531, folha: 7919 },
  { area: "logistica", quadro: 6113, folha: 101 },
  { area: "financeiro", quadro: 29, folha: 3457 },
  { area: "marketing", quadro: 8191, folha: 47 },
  { area: "rh", quadro: 311, folha: 6737 },
] as const;

/** Os fatores exatos do protótipo, que nenhum número da tela pode carregar. */
const FATORES_DO_PROTOTIPO = [0.62, 0.38] as const;

const ESCOPO_TOTAL: AccessScope = {
  perfil: "diretoria",
  entidades: ["consolidado", "unidade-sp", "demais-unidades"],
  areas: [
    "todas",
    "operacoes",
    "comercial",
    "tecnologia",
    "logistica",
    "financeiro",
    "marketing",
    "rh",
  ],
  modulos: ["rh", "fin", "int"],
};

/**
 * Um envelope de ranking por área, com os valores que o teste mandar.
 *
 * `barras-horizontais` é a forma escolhida porque escreve **todos** os seus
 * valores como texto na página: dezoito dos 71 painéis usam essa forma, e o que
 * ela desenha é exatamente o que se quer conferir.
 */
function rankingPorArea(
  valores: readonly number[],
  unidade: Unidade,
): PanelResponse {
  return {
    forma: "barras-horizontais",
    id: "teste-ranking",
    title: "Ranking por área",
    unit: unidade,
    formula: formula("valor por área, como o adaptador devolveu"),
    total: null,
    note: null,
    asOf: "2026-12-31",
    categories: POR_AREA.map((l) => l.area),
    series: [
      {
        name: "Valor",
        papel: "valor",
        values: valores,
      },
    ],
  };
}

/** Um adaptador que devolve exatamente a tabela acima, sem tocar na `Query`. */
function fonteArbitraria(
  envelope: PanelResponse,
  kpis: readonly Kpi[] = [],
): DataSource {
  return {
    getMeta(): Promise<Meta> {
      throw new Error("getMeta não é usada por este teste.");
    },
    getKpis(_tela: string, _q: Query): Promise<readonly Kpi[]> {
      return Promise.resolve(kpis);
    },
    getPanel(_id: string, _q: Query): Promise<PanelResponse> {
      return Promise.resolve(envelope);
    },
    getMetric(_id: string, _q: Query): Promise<MetricValue> {
      throw new Error("getMetric não é usada por este teste.");
    },
  };
}

/** Lê pela fronteira de verdade, como a tela lê em produção. */
async function lerPelaFronteira(
  envelope: PanelResponse,
  consulta: Query = QUERY_PADRAO,
): Promise<PanelResponse> {
  const fronteira = criarFronteira(
    fonteArbitraria(envelope),
    ESCOPO_TOTAL,
    dimensoesProvisorias(),
  );
  return fronteira.lerPainel({
    painel: envelope.id,
    consulta,
    breakdown: "none",
  });
}

/** O texto que a página mostra, sem os atributos das tags. */
function textoRenderizado(painel: PanelResponse, span = 6): string {
  const markup = renderToStaticMarkup(
    createElement(DesenhoDePainel, { painel, span }),
  );
  return markup.replace(/<[^>]*>/g, " ");
}

/** Todo grupo de dígitos do texto, no formato pt-BR. */
function numerosDe(texto: string): readonly string[] {
  return texto.match(/\d[\d.]*(?:,\d+)?/g) ?? [];
}

/**
 * Os valores que a tela escreveu, cada um inteiro.
 *
 * Comparar por `toContain` no texto corrido não serve, e a primeira versão
 * deste arquivo tropeçou nisso: `311 FTE` contém `11 FTE`, então a busca por
 * "apareceu 29 escalado por 0,38" achava um valor que ninguém escalou. O
 * defeito era do teste, não do produto — e um teste que acusa defeito onde não
 * há é pior que um que não acusa, porque ensina a ignorar vermelho.
 *
 * Extraindo os valores inteiros e comparando conjunto com conjunto, a
 * afirmação passa a ser exata: estes números, e só estes.
 */
function valoresRenderizados(
  texto: string,
  unidade: string,
): readonly string[] {
  const padrao = new RegExp(`\\d[\\d.]*(?:,\\d+)? ${unidade}`, "g");
  return texto.match(padrao) ?? [];
}

/* ------------------------------------------------------------------ *
 * Os casos
 * ------------------------------------------------------------------ */

describe("o valor atravessa a fronteira e a tela sem mudar", () => {
  it("1. cada valor arbitrário aparece na tela como o adaptador o devolveu", async () => {
    const valores = POR_AREA.map((l) => l.quadro);
    const lido = await lerPelaFronteira(rankingPorArea(valores, "FTE"));
    const texto = textoRenderizado(lido);

    /*
     * Igualdade de conjunto, e não `toContain` valor a valor: assim o caso
     * afirma as duas metades de uma vez — todo valor do envelope chegou, e
     * nenhum valor a mais foi escrito.
     */
    expect(valoresRenderizados(texto, "FTE")).toEqual(
      valores.map((v) => formatarValor(v, "FTE")),
    );
  });

  it("2. nenhum número da tela carrega os fatores do protótipo", async () => {
    const valores = POR_AREA.map((l) => l.quadro);
    const lido = await lerPelaFronteira(rankingPorArea(valores, "FTE"));
    const texto = textoRenderizado(lido);

    const escritos = valoresRenderizados(texto, "FTE");
    for (const valor of valores) {
      for (const fator of FATORES_DO_PROTOTIPO) {
        expect(
          escritos,
          `apareceu ${String(valor)} escalado por ${String(fator)}`,
        ).not.toContain(formatarValor(valor * fator, "FTE"));
      }
    }
  });

  it("3. nenhum número estranho aparece na tela", async () => {
    const valores = POR_AREA.map((l) => l.quadro);
    const lido = await lerPelaFronteira(rankingPorArea(valores, "FTE"));

    /*
     * O conjunto do que pode aparecer é fechado: os valores do envelope, e mais
     * nada. Um total somado na tela, uma média, uma participação percentual —
     * qualquer número que a apresentação inventasse cairia aqui.
     *
     * As categorias são códigos de área, sem dígito, de propósito: uma faixa
     * como `18-24` traria dígitos que não são valor e tornaria o conjunto
     * ambíguo.
     */
    const permitidos = new Set(
      valores.flatMap((v) => numerosDe(formatarValor(v, "FTE"))),
    );

    for (const achado of numerosDe(textoRenderizado(lido))) {
      expect(
        permitidos.has(achado),
        `número ${achado} apareceu na tela sem vir do envelope`,
      ).toBe(true);
    }
  });
});

describe("a tela acompanha o adaptador, e não uma proporção", () => {
  it("4. multiplicar a entrada por mil multiplica a saída por mil, e nada mais", async () => {
    const MIL = 1000;
    const originais = POR_AREA.map((l) => l.quadro);
    const ampliados = originais.map((v) => v * MIL);

    const texto = textoRenderizado(
      await lerPelaFronteira(rankingPorArea(ampliados, "FTE")),
    );

    const escritos = valoresRenderizados(texto, "FTE");
    expect(escritos).toEqual(ampliados.map((v) => formatarValor(v, "FTE")));
    /*
     * E os valores antigos somem. Se algum sobrevivesse, a tela estaria
     * guardando número de leitura anterior — o "valor remanescente" que RF-01
     * proíbe.
     */
    for (const valor of originais) {
      expect(escritos).not.toContain(formatarValor(valor, "FTE"));
    }
  });

  it("5. duas medidas sem razão comum saem cada uma com o seu número", async () => {
    /*
     * O achado 4 em forma de teste. Se a tela aplicasse um fator por área — o
     * `hc` e o `money` do protótipo — as duas colunas seriam proporcionais
     * entre si. Aqui a razão entre quadro e folha vai de 375 (operações) a 0,04
     * (financeiro), e as duas leituras precisam sair inteiras.
     */
    const quadro = await lerPelaFronteira(
      rankingPorArea(
        POR_AREA.map((l) => l.quadro),
        "FTE",
      ),
    );
    const folha = await lerPelaFronteira(
      rankingPorArea(
        POR_AREA.map((l) => l.folha),
        "FTE",
      ),
    );

    const textoQuadro = textoRenderizado(quadro);
    const textoFolha = textoRenderizado(folha);

    for (const linha of POR_AREA) {
      expect(textoQuadro).toContain(formatarValor(linha.quadro, "FTE"));
      expect(textoFolha).toContain(formatarValor(linha.folha, "FTE"));
    }
  });
});

describe("o recorte não escala: a fronteira entrega o que o adaptador deu", () => {
  it("6. trocar entidade e área não multiplica valor nenhum", async () => {
    const valores = POR_AREA.map((l) => l.quadro);
    const envelope = rankingPorArea(valores, "FTE");

    const recortes: readonly Query[] = [
      QUERY_PADRAO,
      { ...QUERY_PADRAO, entidade: "unidade-sp" },
      { ...QUERY_PADRAO, entidade: "demais-unidades" },
      { ...QUERY_PADRAO, area: "tecnologia" },
      { ...QUERY_PADRAO, modalidade: "remoto" },
    ];

    for (const consulta of recortes) {
      const texto = textoRenderizado(
        await lerPelaFronteira(envelope, consulta),
      );
      for (const valor of valores) {
        expect(
          texto,
          `recorte ${consulta.entidade}/${consulta.area} mexeu no valor ${String(valor)}`,
        ).toContain(formatarValor(valor, "FTE"));
      }
    }
  });
});

/* ------------------------------------------------------------------ *
 * A varredura que o aceite pede pelo nome
 * ------------------------------------------------------------------ */

/**
 * Os multiplicadores do `fctx()` do protótipo, um a um.
 *
 * O aceite de T-134 nomeia estes: `ent` 0,62 e 0,38 para as entidades, e os
 * fatores `hc`, `money`, `rev` e `trein` pela participação da área no total.
 * A regra de AST pega a **forma** — conta que vira número na tela; esta
 * varredura pega o **nome**, que é o que alguém copiaria do protótipo ao portar
 * uma tela.
 */
const MULTIPLICADORES = [
  { padrao: /\b0\.62\b/, nome: "0.62 (entidade Unidade SP)" },
  { padrao: /\b0\.38\b/, nome: "0.38 (entidade Demais unidades)" },
  { padrao: /\bfctx\b/, nome: "fctx" },
  { padrao: /\bhcA\b/, nome: "hcA" },
  { padrao: /\bmoney\s*[:=]/, nome: "money" },
  { padrao: /\brev\s*[:=]/, nome: "rev" },
  { padrao: /\btrein\s*[:=]/, nome: "trein" },
] as const;

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

/**
 * O código sem comentários.
 *
 * Vários arquivos **explicam** o achado 3 citando o 0,62 — é a documentação
 * fazendo o seu trabalho. O que a varredura persegue é o fator em execução, não
 * a menção a ele: reprovar a explicação ensinaria a não explicar.
 */
function semComentarios(caminho: string): string {
  return readFileSync(caminho, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const ARQUIVOS_DE_TELA = [
  ...varrer(join(RAIZ, "src", "apresentacao")),
  ...varrer(join(RAIZ, "src", "app")),
];

describe("nenhum multiplicador do fctx sobreviveu no código de tela", () => {
  it("7. há arquivos de tela para varrer", () => {
    // Busca em lista vazia devolve zero e não prova nada.
    expect(ARQUIVOS_DE_TELA.length).toBeGreaterThan(20);
  });

  it.each(MULTIPLICADORES)(
    "8. nenhum arquivo de tela usa $nome",
    ({ padrao }) => {
      const infratores = ARQUIVOS_DE_TELA.filter((c) =>
        padrao.test(semComentarios(c)),
      ).map((c) => relative(RAIZ, c).split("\\").join("/"));
      expect(infratores).toEqual([]);
    },
  );

  it("9. a varredura enxerga o fator quando ele existe", () => {
    /*
     * Uma busca quebrada também devolve zero. O exemplo de T-134 declara
     * `const ENTIDADE_SP = 0.62` de propósito, e a varredura precisa achá-lo —
     * senão os casos acima estariam verdes por não procurar nada.
     */
    const plantado = join(RAIZ, "tests", "exemplos", "derivacao-na-tela.ts");
    const entidade = MULTIPLICADORES[0];
    expect(entidade.padrao.test(semComentarios(plantado))).toBe(true);
  });
});
