/**
 * O cartão de KPI e o painel (T-131).
 *
 * ## Por que renderiza sem navegador
 *
 * O runner é `environment: "node"` e o projeto não tem biblioteca de teste de
 * componente. `renderToStaticMarkup` resolve: monta a marcação de verdade, com
 * a lógica de verdade, sem DOM e sem esperar servidor subir. O que precisa de
 * navegador — deslocamento de layout, foco, contraste — fica no e2e, que é
 * onde já está.
 *
 * Os componentes são chamados por `createElement` e não por JSX porque o
 * `include` do vitest é `*.test.ts`. Muda a escrita, não o que é exercido.
 */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  CartaoDeKpi,
  FaixaDeKpis,
  MAXIMO_DE_KPIS_POR_TELA,
} from "@/apresentacao/paineis/CartaoDeKpi";
import { Painel } from "@/apresentacao/paineis/Painel";
import { formula } from "@/semantica/painel";
import {
  ALTURA_DA_SPARKLINE,
  caminhosDaSparkline,
  LARGURA_DA_SPARKLINE,
  MINIMO_DE_PONTOS,
} from "@/apresentacao/paineis/sparkline";
import { calcularKpis } from "@/acesso/fixtures/kpis";
import { REGISTRO_DE_KPIS } from "@/semantica/kpis";
import type { Kpi, PanelResponse, Query } from "@/semantica/contrato";
import { readFileSync } from "node:fs";

const CONSULTA: Query = {
  entidade: "consolidado",
  area: "todas",
  modalidade: "todas",
  periodo: "12-meses",
  ano: "2026",
};

/** Um KPI forjado. Só o que o teste precisa mexer vem por parâmetro. */
function kpiForjado(mudancas: Partial<Kpi> = {}): Kpi {
  return {
    id: "forjado",
    label: "Rótulo forjado",
    value: 1240,
    unit: "contagem",
    delta: -12,
    sentiment: "good",
    rodape: "rodapé forjado",
    serie: [10, 20, 15, 30],
    ...mudancas,
  };
}

function html(elemento: Parameters<typeof renderToStaticMarkup>[0]): string {
  return renderToStaticMarkup(elemento);
}

function quantos(marcacao: string, marca: string): number {
  return marcacao.split(`data-teste="${marca}"`).length - 1;
}

/* ------------------------------------------------------------------ *
 * A fórmula
 * ------------------------------------------------------------------ */

describe("a fórmula do painel não tem como não aparecer", () => {
  const PAINEL: PanelResponse = {
    id: "painel-forjado",
    title: "Painel forjado",
    unit: "contagem",
    formula: formula("soma de admissões no período", "painel-forjado"),
    total: 241,
    note: null,
    asOf: "2026-12-31",
    forma: "barras",
    categories: ["2026-01", "2026-02"],
    series: [{ name: "admissões", values: [20, 22], papel: "valor" }],
  };

  it("o texto da fórmula chega à marcação", () => {
    const marcacao = html(
      createElement(Painel, { painel: PAINEL, altura: 216 }),
    );
    expect(marcacao).toContain("soma de admissões no período");
    expect(quantos(marcacao, "formula-do-painel")).toBe(1);
  });

  it("aparece igual quando o painel está destacado pela IA", () => {
    // O destaque muda a borda e acrescenta rótulo. Se de quebra escondesse a
    // fórmula, o caminho de esconder existiria — só que com outro nome.
    const marcacao = html(
      createElement(Painel, { painel: PAINEL, altura: 216, destacado: true }),
    );
    expect(quantos(marcacao, "formula-do-painel")).toBe(1);
    expect(quantos(marcacao, "rotulo-de-referencia")).toBe(1);
  });

  /*
   * A guarda estrutural, e a razão de ela existir além do teste de cima.
   *
   * Renderizar prova que HOJE a fórmula aparece. Não prova que amanhã ninguém
   * acrescenta uma propriedade para escondê-la — e o achado 10 do Anexo D é
   * exatamente isso tendo acontecido no protótipo. A guarda de T-109 procura
   * pelo nome que o protótipo usou; esta procura pela FORMA, que é o que
   * sobrevive a alguém escolher outro nome.
   *
   * Se `Painel` passar a aceitar mais uma propriedade, este teste fica vermelho
   * e quem a acrescentou precisa dizer, no diff, por quê.
   *
   * ## A quinta e a sexta, e por que entraram
   *
   * `frescor` entrou em T-132. A tabela 6.4 exige que o estado "dado defasado"
   * mostre **o painel** com o selo de frescor em destaque — o painel continua
   * aparecendo, com o número e com a fórmula; o que muda é o selo.
   *
   * `subtitulo` entrou em T-133. A seção 6.3 troca o subtítulo por "No recorte
   * ativo · Área" quando há filtro fora do padrão, junto com a supressão da
   * nota. É texto que entra, não conteúdo que sai.
   *
   * Nenhuma das duas é interruptor: não são booleanas, não decidem o que
   * aparece, e os casos abaixo conferem que a fórmula segue lá com as duas
   * ligadas. A guarda ficou vermelha duas vezes, foi lida as duas, e estas são
   * as respostas que o comentário acima pedia.
   *
   * A pergunta que importa a cada nova propriedade não é "quantas são", é
   * "esta some com alguma coisa". Se um dia a resposta for sim, a lista não
   * deve crescer: a propriedade é que não deve entrar.
   */
  it("Painel aceita seis propriedades, e nenhuma liga ou desliga a fórmula", () => {
    const fonte = readFileSync("src/apresentacao/paineis/Painel.tsx", "utf8");
    const bloco = /export function Painel\(\{([^}]*)\}/.exec(fonte);
    expect(bloco, "não achei a assinatura de Painel").not.toBeNull();

    const aceitas = (bloco?.[1] ?? "")
      .split(",")
      .map((p) => p.split("=")[0]?.trim() ?? "")
      .filter((p) => p !== "");

    expect(aceitas.sort()).toEqual([
      "altura",
      "children",
      "destacado",
      "frescor",
      "painel",
      "subtitulo",
    ]);
  });

  it("e a fórmula continua aparecendo com subtítulo de recorte ativo", () => {
    /*
     * O subtítulo de T-133 substitui uma descrição que deixou de valer. Ele
     * acrescenta uma linha ao cabeçalho; não tem como tirar a fórmula do
     * rodapé. Este caso é o que faz essa frase ser verificável.
     */
    const marcacao = html(
      createElement(Painel, {
        painel: PAINEL,
        altura: 216,
        subtitulo: "No recorte ativo · Tecnologia",
      }),
    );
    expect(quantos(marcacao, "formula-do-painel")).toBe(1);
    expect(quantos(marcacao, "subtitulo-do-painel")).toBe(1);
    expect(marcacao).toContain("No recorte ativo · Tecnologia");
  });

  it("e a fórmula continua aparecendo com o selo de frescor ligado", () => {
    /*
     * O caso que faz a justificativa acima ser verificável em vez de escrita.
     *
     * Uma propriedade nova é inofensiva enquanto não muda o que aparece. Aqui
     * ela é ligada nos dois valores possíveis de `defasado`, e a fórmula
     * aparece exatamente uma vez nas duas — que é a única coisa que a guarda
     * do achado 10 precisa continuar garantindo.
     */
    for (const defasado of [true, false]) {
      const marcacao = html(
        createElement(Painel, {
          painel: PAINEL,
          altura: 216,
          frescor: {
            asOf: "2026-12-31",
            sincronizadoEm: "2026-08-26T06:15",
            defasado,
          },
        }),
      );
      expect(quantos(marcacao, "formula-do-painel"), String(defasado)).toBe(1);
      expect(quantos(marcacao, "selo-de-frescor"), String(defasado)).toBe(1);
    }
  });

  it("a moldura não tem como esconder a fórmula: ela não a desenha", () => {
    /*
     * T-132 extraiu `MolduraDePainel` de dentro de `Painel`, e uma extração é
     * onde uma garantia se perde sem ninguém notar. A fórmula ficou **fora** da
     * moldura de propósito: a moldura desenha borda, título, unidade e selo, e
     * quem desenha a fórmula continua sendo `Painel`.
     *
     * Uma moldura que também desenhasse a fórmula poderia deixar de desenhá-la,
     * e o caminho de esconder existiria de novo — com outro nome e num arquivo
     * onde ninguém procuraria.
     */
    const fonte = readFileSync("src/apresentacao/paineis/Painel.tsx", "utf8");
    const moldura = /export function MolduraDePainel\([\s\S]*?\n\}/.exec(fonte);
    expect(moldura, "não achei MolduraDePainel").not.toBeNull();
    expect(moldura?.[0] ?? "").not.toContain("FormulaDoPainel");
    expect(moldura?.[0] ?? "").not.toContain("formula");
  });
});

/* ------------------------------------------------------------------ *
 * O limite de seis
 * ------------------------------------------------------------------ */

describe("nenhuma tela renderiza mais de seis cartões", () => {
  it("a faixa corta o excedente, mesmo recebendo mais", () => {
    const demais = Array.from({ length: 9 }, (_, i) =>
      kpiForjado({ id: `forjado-${String(i)}` }),
    );
    const marcacao = html(createElement(FaixaDeKpis, { kpis: demais }));
    expect(quantos(marcacao, "cartao-de-kpi")).toBe(MAXIMO_DE_KPIS_POR_TELA);
  });

  /*
   * O caso de verdade: toda tela do registro, renderizada.
   *
   * O teste de cima prova que a faixa corta. Este prova que nenhuma tela
   * precisa do corte — que é a afirmação que interessa, porque cortar em
   * silêncio esconderia um registro que cresceu.
   */
  it.each([...new Set(REGISTRO_DE_KPIS.map((k) => k.tela))])(
    "a tela %s cabe no limite",
    (tela) => {
      const kpis = calcularKpis(tela, CONSULTA);
      expect(
        kpis.length,
        `${tela} tem ${String(kpis.length)} KPIs no registro`,
      ).toBeLessThanOrEqual(MAXIMO_DE_KPIS_POR_TELA);

      const marcacao = html(createElement(FaixaDeKpis, { kpis }));
      expect(quantos(marcacao, "cartao-de-kpi")).toBe(kpis.length);
    },
  );
});

/* ------------------------------------------------------------------ *
 * O que o cartão mostra vem do KPI, e só dele
 * ------------------------------------------------------------------ */

describe("valor, delta, rodapé e sparkline vêm do KPI recebido", () => {
  it("o rodapé é o do KPI, palavra por palavra", () => {
    const marcacao = html(
      createElement(CartaoDeKpi, {
        kpi: kpiForjado({ rodape: "sete áreas, dezembro" }),
      }),
    );
    expect(marcacao).toContain("sete áreas, dezembro");
  });

  it("trocar o valor troca o que a tela mostra", () => {
    const um = html(
      createElement(CartaoDeKpi, { kpi: kpiForjado({ value: 1240 }) }),
    );
    const outro = html(
      createElement(CartaoDeKpi, { kpi: kpiForjado({ value: 999 }) }),
    );
    expect(um).toContain("1.240");
    expect(outro).toContain("999");
    expect(um).not.toContain("999");
  });

  it("trocar a série troca o traço", () => {
    const subindo = html(
      createElement(CartaoDeKpi, { kpi: kpiForjado({ serie: [1, 2, 3, 4] }) }),
    );
    const descendo = html(
      createElement(CartaoDeKpi, { kpi: kpiForjado({ serie: [4, 3, 2, 1] }) }),
    );
    expect(subindo).toContain("<path");
    expect(subindo).not.toBe(descendo);
  });

  it("série curta demais não desenha, e o cartão continua inteiro", () => {
    const marcacao = html(
      createElement(CartaoDeKpi, { kpi: kpiForjado({ serie: [10, 20] }) }),
    );
    expect(marcacao).toContain('data-tracos="0"');
    expect(marcacao).not.toContain("<path");
    expect(marcacao).toContain("rodapé forjado");
  });

  it("mês sem dado vira lacuna, e não reta atravessando a ausência", () => {
    const marcacao = html(
      createElement(CartaoDeKpi, {
        kpi: kpiForjado({ serie: [10, 20, null, 40, 30] }),
      }),
    );
    expect(marcacao).toContain('data-tracos="2"');
  });

  /*
   * Ausência é estado (PR-4), e o cartão é o menor lugar onde isso se prova.
   *
   * Zero é uma medida: "não houve desligamento". Nulo é outra coisa: "este
   * recorte não tem dado". Mostrar zero no lugar de nulo é afirmar a primeira
   * quando só se sabe a segunda.
   */
  it("valor nulo diz que não há dado, e não desenha zero", () => {
    const marcacao = html(
      createElement(CartaoDeKpi, {
        kpi: kpiForjado({ value: null, unit: "pct", rodape: "12 meses" }),
      }),
    );
    expect(marcacao).toContain("sem dado neste recorte");
    expect(marcacao).not.toContain("0,0%");
    // O rodapé sobrevive: é ele que diz em que recorte o número valeria.
    expect(marcacao).toContain("12 meses");
  });

  it("o sentimento aparece em texto, e não só em cor", () => {
    const bom = html(
      createElement(CartaoDeKpi, { kpi: kpiForjado({ sentiment: "good" }) }),
    );
    const ruim = html(
      createElement(CartaoDeKpi, { kpi: kpiForjado({ sentiment: "bad" }) }),
    );
    expect(bom).toContain('data-sentimento="good"');
    expect(ruim).toContain('data-sentimento="bad"');
    // A seta segue o sinal do delta, não o sentimento: delta negativo desce
    // nos dois casos, mesmo quando descer é bom.
    expect(bom).toContain("▼");
    expect(ruim).toContain("▼");
  });
});

/* ------------------------------------------------------------------ *
 * A ponta de dado: a série que o cálculo entrega
 * ------------------------------------------------------------------ */

describe("a série do KPI vem do cálculo, com um ponto por mês", () => {
  it("doze meses de janela dão doze pontos", () => {
    const kpis = calcularKpis("rh/visao", CONSULTA);
    expect(kpis.length).toBeGreaterThan(0);
    for (const kpi of kpis) {
      expect(kpi.serie.length, kpi.id).toBe(12);
    }
  });

  it("janela de um mês dá um ponto, e aí não há traço para desenhar", () => {
    const kpis = calcularKpis("rh/visao", { ...CONSULTA, periodo: "dezembro" });
    for (const kpi of kpis) {
      expect(kpi.serie.length, kpi.id).toBe(1);
    }
    const marcacao = html(createElement(FaixaDeKpis, { kpis }));
    expect(marcacao).not.toContain("<path");
  });

  it("a série responde ao recorte, como o número responde", () => {
    const consolidado = calcularKpis("rh/visao", CONSULTA);
    const unidadeSp = calcularKpis("rh/visao", {
      ...CONSULTA,
      entidade: "unidade-sp",
    });

    const serieDe = (kpis: readonly Kpi[], id: string) =>
      kpis.find((k) => k.id === id)?.serie;

    /*
     * A versão anterior deste teste comparava com `entidade: "sp"`, que não
     * existe no enum. Nenhuma linha casava, a série inteira vinha nula, e as
     * duas "diferiam" -- passava pelo motivo errado. O `as` no envelope forjado
     * escondia isso do typecheck.
     *
     * Agora a afirmação é a que interessa: headcount é estoque e a unidade de
     * SP é uma fatia do consolidado, então cada mês da série desce, e nenhum
     * dos dois lados é nulo.
     */
    const todos = serieDe(consolidado, "rh-visao-headcount") ?? [];
    const daUnidade = serieDe(unidadeSp, "rh-visao-headcount") ?? [];

    expect(todos).toHaveLength(12);
    expect(daUnidade).toHaveLength(12);
    expect(todos.some((v) => v === null)).toBe(false);
    expect(daUnidade.some((v) => v === null)).toBe(false);

    todos.forEach((valor, i) => {
      expect(daUnidade[i], `mês ${String(i)}`).toBeLessThan(valor ?? 0);
    });
  });
});

/* ------------------------------------------------------------------ *
 * A geometria do traço
 * ------------------------------------------------------------------ */

describe("a série vira traço sem virar afirmação", () => {
  /** As coordenadas de um caminho, na ordem em que o SVG as desenha. */
  function pontos(caminho: string) {
    return caminho
      .split(" ")
      .reduce<{ x: number; y: number }[]>((acc, pedaco, i, todos) => {
        if (!/^[ML]/.test(pedaco)) return acc;
        const x = Number(pedaco.slice(1));
        const y = Number(todos[i + 1]);
        return [...acc, { x, y }];
      }, []);
  }

  it("o traço ocupa a largura inteira, do primeiro ponto ao último", () => {
    const [caminho] = caminhosDaSparkline([10, 20, 30, 40]);
    const p = pontos(caminho ?? "");
    expect(p).toHaveLength(4);
    expect(p[0]?.x).toBe(0);
    expect(p[p.length - 1]?.x).toBe(LARGURA_DA_SPARKLINE);
  });

  /*
   * O eixo Y do SVG cresce para baixo. Se alguém esquecer a inversão, toda
   * tendência aparece de cabeça para baixo: queda de turnover vira subida na
   * tela, com o número certo ao lado. É o pior tipo de defeito de gráfico --
   * o dado está correto e a leitura é o contrário do que ele diz.
   */
  it("valor maior desenha mais alto, e não mais baixo", () => {
    const [caminho] = caminhosDaSparkline([10, 40, 20, 30]);
    const p = pontos(caminho ?? "");
    const menor = p[0];
    const maior = p[1];
    expect(menor?.y).toBeGreaterThan(maior?.y ?? 0);
  });

  it("série constante desenha no meio, sem afirmar máximo nem mínimo", () => {
    const [caminho] = caminhosDaSparkline([7, 7, 7, 7]);
    const p = pontos(caminho ?? "");
    for (const ponto of p) {
      expect(ponto.y).toBe(ALTURA_DA_SPARKLINE / 2);
    }
  });

  it.each([
    ["vazia", []],
    ["um ponto", [10]],
    ["dois pontos", [10, 20]],
    ["três, mas dois nulos", [10, null, null]],
  ])("%s não desenha", (_caso, serie) => {
    expect(caminhosDaSparkline(serie as readonly (number | null)[])).toEqual(
      [],
    );
  });

  it("o mínimo de pontos é o do protótipo, e vale como fronteira", () => {
    const suficiente = Array.from({ length: MINIMO_DE_PONTOS }, (_, i) => i);
    expect(caminhosDaSparkline(suficiente)).toHaveLength(1);
    expect(caminhosDaSparkline(suficiente.slice(1))).toEqual([]);
  });

  it("ponto sozinho entre lacunas não vira trecho", () => {
    // Um ponto não tem segmento. Desenhá-lo como caminho de um comando só
    // produziria um `M` sem `L` -- invisível, e mesmo assim contado.
    const caminhos = caminhosDaSparkline([10, null, 25, null, 30, 40]);
    expect(caminhos).toHaveLength(1);
    expect(pontos(caminhos[0] ?? "")).toHaveLength(2);
  });
});
