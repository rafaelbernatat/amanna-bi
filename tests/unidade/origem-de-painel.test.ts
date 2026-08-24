/**
 * Nenhum painel sem fonte (T-117.2).
 *
 * A pergunta que este arquivo torna mecânica: *existe painel que ninguém sabe
 * alimentar?* Ela era impossível de responder enquanto a ligação painel → view
 * não estava escrita, e a resposta era sim — `tov-custo` e `fat-risco` pediam
 * medidas que nenhuma das nove views de 10.1 tinha.
 *
 * O teste de cobertura é o que impede o próximo caso de passar do mesmo jeito:
 * silenciosamente, até alguém abrir a tela numa demonstração.
 */

import { describe, expect, it } from "vitest";

import { VIEWS } from "@/acesso/fixtures/adaptador";
import { VW_FATO_FATURAMENTO_CLIENTE } from "@/acesso/fixtures/fin";
import { VW_FATO_RH_MES } from "@/acesso/fixtures/rh";
import {
  COMPONENTES_DE_CUSTO_DE_TURNOVER,
  VW_FATO_TURNOVER_CUSTO,
} from "@/acesso/fixtures/turnover-custo";
import {
  CUSTO_DO_TURNOVER,
  FAIXAS_DE_RATING,
  TOP_CLIENTES,
} from "@/acesso/fixtures/referencia-perfil";
import {
  FORMAS_DE_SERIE_TEMPORAL,
  ORIGEM_DOS_PAINEIS,
  origemDoPainel,
} from "@/semantica/origem-de-painel";
import { REGISTRO_DE_PAINEIS } from "@/semantica/paineis";

const DAS_TRES_FORMAS = REGISTRO_DE_PAINEIS.filter((p) =>
  FORMAS_DE_SERIE_TEMPORAL.some((f) => f === p.forma),
);

describe("a cobertura painel a painel", () => {
  it("são 31 painéis nas três formas, contados e não escritos", () => {
    expect(DAS_TRES_FORMAS).toHaveLength(31);
  });

  it.each(DAS_TRES_FORMAS.map((p) => [p.id, p.forma]))(
    "%s (%s) declara de qual view lê",
    (id) => {
      const origem = origemDoPainel(id);
      expect(origem, `${id} não tem view declarada`).toBeDefined();
      expect(
        origem?.views.length,
        `${id} declarou lista vazia`,
      ).toBeGreaterThan(0);
    },
  );

  it("toda view declarada existe de fato no adaptador", () => {
    /*
     * A checagem que um tipo não faria.
     *
     * `src/semantica` não importa de `src/acesso`, então os nomes de view são
     * texto. Um tipo garantiria grafia; este caso garante EXISTÊNCIA — que é o
     * que separa "escrevi certo" de "a view está lá".
     */
    const existentes = new Set(Object.keys(VIEWS));
    const inventadas = ORIGEM_DOS_PAINEIS.flatMap((o) =>
      o.views
        .filter((v) => !existentes.has(v))
        .map((v) => `${o.painel} → ${v}`),
    );
    expect(inventadas).toEqual([]);
  });

  it("não há declaração órfã, apontando para painel que não existe", () => {
    // O outro sentido da cobertura. Sem isto, apagar um painel do registro
    // deixaria a declaração dele para trás, e o mapa passaria a descrever um
    // produto que não existe mais.
    const doRegistro = new Set(REGISTRO_DE_PAINEIS.map((p) => p.id));
    const orfas = ORIGEM_DOS_PAINEIS.filter(
      (o) => !doRegistro.has(o.painel),
    ).map((o) => o.painel);
    expect(orfas).toEqual([]);
  });

  it("painel que lê de mais de uma view diz por que", () => {
    // Cruzar domínios é decisão, não acidente. Quem cruzar sem escrever a razão
    // deixa a próxima pessoa adivinhando se foi de propósito.
    const mudos = ORIGEM_DOS_PAINEIS.filter(
      (o) => o.views.length > 1 && (o.cruzamento ?? "").trim() === "",
    ).map((o) => o.painel);
    expect(mudos).toEqual([]);
  });
});

describe("vw_fato_turnover_custo", () => {
  it("cada componente soma exatamente o total declarado", () => {
    for (const componente of CUSTO_DO_TURNOVER) {
      const soma = VW_FATO_TURNOVER_CUSTO.filter(
        (l) => l.componente === componente.codigo,
      ).reduce((a, l) => a + l.valor, 0);
      expect(soma, componente.codigo).toBe(
        Math.round(componente.milhoes * 1_000_000),
      );
    }
  });

  it("os quatro componentes do protótipo estão todos lá", () => {
    const presentes = new Set(VW_FATO_TURNOVER_CUSTO.map((l) => l.componente));
    expect([...presentes].sort()).toEqual(
      [...COMPONENTES_DE_CUSTO_DE_TURNOVER].sort(),
    );
    expect(presentes.size).toBe(4);
  });

  /*
   * O que separa esta view do achado 5.
   *
   * Um custo repartido por igual entre as áreas daria o mesmo desenho sob
   * qualquer filtro — número na tela que não reage a recorte, que é
   * exatamente o defeito que o produto existe para não repetir. Aqui o custo
   * segue os desligamentos, então a área que perdeu mais gente carrega mais.
   */
  it("a participação de cada área no custo é a dela nos desligamentos", () => {
    /*
     * A primeira versão deste caso só exigia que os totais por área fossem
     * diferentes entre si, e passou numa provocação que repartia o custo por
     * igual: com pesos iguais, o maior resto ainda deixa alguns centavos de
     * diferença entre as áreas, e "diferentes" era verdade sem que a
     * repartição significasse nada.
     *
     * A propriedade que interessa é proporcionalidade, e é esta que se afirma
     * agora. Repartir por igual erra por dezenas de pontos percentuais.
     */
    const somar = <T>(linhas: readonly T[], medida: (l: T) => number) =>
      linhas.reduce((a, l) => a + medida(l), 0);

    const custoTotal = somar(VW_FATO_TURNOVER_CUSTO, (l) => l.valor);
    const saidasTotais = somar(VW_FATO_RH_MES, (l) => l.desligamentos);
    const areas = [...new Set(VW_FATO_RH_MES.map((l) => l.area))];
    expect(areas.length).toBeGreaterThan(1);

    for (const area of areas) {
      const doCusto =
        somar(
          VW_FATO_TURNOVER_CUSTO.filter((l) => l.area === area),
          (l) => l.valor,
        ) / custoTotal;
      const dasSaidas =
        somar(
          VW_FATO_RH_MES.filter((l) => l.area === area),
          (l) => l.desligamentos,
        ) / saidasTotais;

      expect(
        Math.abs(doCusto - dasSaidas),
        `${area}: custo ${String(doCusto)} contra saídas ${String(dasSaidas)}`,
      ).toBeLessThan(0.005);
    }
  });

  it("o total geral fecha nos R$ 12,4 mi da decomposição", () => {
    const total = VW_FATO_TURNOVER_CUSTO.reduce((a, l) => a + l.valor, 0);
    const declarado = CUSTO_DO_TURNOVER.reduce(
      (a, c) => a + Math.round(c.milhoes * 1_000_000),
      0,
    );
    expect(total).toBe(declarado);
    expect(declarado).toBe(12_400_000);
  });
});

describe("o rating na carteira", () => {
  it("todo cliente tem faixa, e a faixa é uma das declaradas", () => {
    for (const cliente of TOP_CLIENTES) {
      expect(FAIXAS_DE_RATING, cliente.codigo).toContain(cliente.rating);
    }
  });

  it("a view carrega a faixa em toda linha", () => {
    const semRating = VW_FATO_FATURAMENTO_CLIENTE.filter(
      (l) => l.rating === "",
    );
    expect(semRating).toEqual([]);
  });

  /*
   * A participação por faixa reproduz a do protótipo — 62 %, 21 %, 11 % e 6 %.
   *
   * Não é coincidência e não é medição: o enquadramento dos dez clientes foi
   * escolhido para chegar nesses números, porque a tela já foi aprovada com
   * eles. O que este caso protege é que mexer nas receitas dos clientes sem
   * rever o enquadramento não desmonte a leitura em silêncio.
   *
   * De onde vem rating de verdade é H-53.
   */
  it.each([
    ["AAA-A", 62],
    ["BBB", 21],
    ["BB", 11],
    ["B-ou-inferior", 6],
  ])("a faixa %s fica em torno de %i%% da carteira", (faixa, esperado) => {
    const total = VW_FATO_FATURAMENTO_CLIENTE.reduce(
      (a, l) => a + l.receita,
      0,
    );
    const daFaixa = VW_FATO_FATURAMENTO_CLIENTE.filter(
      (l) => l.rating === faixa,
    ).reduce((a, l) => a + l.receita, 0);

    const CEM = 100;
    const participacao = (daFaixa / total) * CEM;
    expect(
      Math.abs(participacao - esperado),
      `${faixa}: ${String(participacao)}`,
    ).toBeLessThan(1);
  });

  it("as quatro faixas cobrem a carteira inteira, sem sobra", () => {
    const total = VW_FATO_FATURAMENTO_CLIENTE.reduce(
      (a, l) => a + l.receita,
      0,
    );
    const somaDasFaixas = FAIXAS_DE_RATING.reduce(
      (a, faixa) =>
        a +
        VW_FATO_FATURAMENTO_CLIENTE.filter((l) => l.rating === faixa).reduce(
          (b, l) => b + l.receita,
          0,
        ),
      0,
    );
    expect(somaDasFaixas).toBe(total);
  });
});
