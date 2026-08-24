/**
 * O registro de KPIs (T-145) e o mapa KPI → painel (T-108).
 *
 * Como nos outros registros, o Anexo A é lido **do PRD.md**. O que muda aqui é
 * que há um segundo lado a conferir: cada `detalhadoPor` precisa apontar para
 * um painel que **existe e está na mesma tela**. Um mapa que aponta para outra
 * tela é pior que um mapa vazio — manda a pessoa clicar e sair do contexto.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { AGREGACOES, UNIDADES } from "@/semantica/contrato";
import {
  CONSTANTES_NO_PROTOTIPO,
  kpiPorId,
  kpisDaTela,
  KPIS_SEM_UNIDADE_NO_ENUM,
  QUANTIDADE_DE_KPIS,
  REGISTRO_DE_KPIS,
  SEM_DETALHAMENTO,
} from "@/semantica/kpis";
import {
  MAXIMO_DE_KPIS_POR_TELA,
  painelPorId,
  REGISTRO_DE_PAINEIS,
} from "@/semantica/paineis";

const RAIZ = process.cwd();

/** As 13 telas do Anexo A, lidas do documento. */
function telasDoAnexoA(): readonly string[] {
  const prd = readFileSync(resolve(RAIZ, "PRD.md"), "utf8");
  const saida: string[] = [];
  for (const linha of prd.split("\n")) {
    const m = /^\| \*\*.+\*\* \(`([a-z]+\/[a-z]+)`\) \|/.exec(linha);
    if (m !== null) saida.push(m[1] ?? "");
  }
  return saida;
}

const telas = telasDoAnexoA();

describe("cobertura das 13 telas", () => {
  it("o Anexo A rendeu 13 telas — senão o resto não prova nada", () => {
    expect(telas.length).toBe(13);
  });

  it("toda tela tem ao menos um KPI", () => {
    const vazias = telas.filter((t) => kpisDaTela(t).length === 0);
    expect(vazias).toEqual([]);
  });

  it("nenhum KPI aponta para tela fora do Anexo A", () => {
    const validas = new Set(telas);
    const orfaos = REGISTRO_DE_KPIS.filter((k) => !validas.has(k.tela)).map(
      (k) => `${k.id} → ${k.tela}`,
    );
    expect(orfaos).toEqual([]);
  });

  it("os ids são únicos", () => {
    expect(new Set(REGISTRO_DE_KPIS.map((k) => k.id)).size).toBe(
      QUANTIDADE_DE_KPIS,
    );
  });

  it("são 70, contados", () => {
    expect(QUANTIDADE_DE_KPIS).toBe(70);
    expect(REGISTRO_DE_KPIS.length).toBe(70);
  });
});

describe("o limite da seção 5", () => {
  it("nenhuma tela passa de 6 KPIs", () => {
    // A sétima caixa empurra as outras para fora do campo de visão, e a leitura
    // "numa passada" que a seção 5 descreve vira rolagem.
    const excedentes = telas
      .map((t) => ({ tela: t, n: kpisDaTela(t).length }))
      .filter((x) => x.n > MAXIMO_DE_KPIS_POR_TELA);
    expect(excedentes).toEqual([]);
  });

  it("e o teto conferido é o do PRD", () => {
    expect(MAXIMO_DE_KPIS_POR_TELA).toBe(6);
  });
});

describe("o mapa KPI → painel (T-108)", () => {
  it("todo KPI está classificado: ou aponta um painel, ou justifica", () => {
    const semClassificacao = REGISTRO_DE_KPIS.filter(
      (k) =>
        k.detalhadoPor === null &&
        (k.semDetalhamentoPorque ?? "").trim().length === 0,
    ).map((k) => k.id);
    expect(semClassificacao).toEqual([]);
  });

  it("todo painel apontado existe no registro dos 71", () => {
    const quebrados = REGISTRO_DE_KPIS.filter(
      (k) =>
        k.detalhadoPor !== null && painelPorId(k.detalhadoPor) === undefined,
    ).map((k) => `${k.id} → ${k.detalhadoPor}`);
    expect(quebrados).toEqual([]);
  });

  it("todo painel apontado está na mesma tela do KPI", () => {
    /*
     * A regra que evita o pior mapa: um que funciona.
     *
     * Apontar para um painel de outra tela abre o número, mas tira a pessoa do
     * contexto em que ela estava lendo — e a reconciliação da regra 1 da seção
     * 9.2 passa a comparar dois recortes diferentes.
     */
    const foraDaTela = REGISTRO_DE_KPIS.filter((k) => {
      if (k.detalhadoPor === null) return false;
      return painelPorId(k.detalhadoPor)?.tela !== k.tela;
    }).map((k) => `${k.id} → ${k.detalhadoPor}`);
    expect(foraDaTela).toEqual([]);
  });

  it("a justificativa de quem não tem painel é frase, não rótulo", () => {
    for (const k of SEM_DETALHAMENTO) {
      expect(
        (k.semDetalhamentoPorque ?? "").length,
        `${k.id}: justificativa curta demais`,
      ).toBeGreaterThan(40);
    }
  });

  it("são exatamente dez sem detalhamento, e nenhum a mais", () => {
    // Fixado para só encolher: um KPI novo sem painel entra calado se ninguém
    // contar, e "sem detalhamento" vira o padrão em vez da exceção.
    expect(SEM_DETALHAMENTO.map((k) => k.id).sort()).toEqual([
      "fin-caixa-conversao-de-dez",
      "fin-fat-concentracao-top-10",
      "fin-fat-ticket-medio",
      "fin-visao-receita-bruta",
      "rh-engaj-cobertura-da-pesquisa",
      "rh-recrut-custo-por-contratacao",
      "rh-sal-custo-por-colaborador",
      "rh-trein-custo-por-hora",
      "rh-turnover-tempo-ate-a-saida",
      "rh-visao-enps",
    ]);
  });
});

describe("unidade e sentido", () => {
  it("toda unidade declarada está no enum fechado", () => {
    const fora = REGISTRO_DE_KPIS.filter(
      (k) =>
        k.unidade !== null &&
        !(UNIDADES as readonly string[]).includes(k.unidade),
    ).map((k) => `${k.id}: ${k.unidade}`);
    expect(fora).toEqual([]);
  });

  it("todo sentido é um dos três", () => {
    const validos = new Set(["maior_melhor", "menor_melhor", "neutro"]);
    const fora = REGISTRO_DE_KPIS.filter((k) => !validos.has(k.sentido)).map(
      (k) => `${k.id}: ${k.sentido}`,
    );
    expect(fora).toEqual([]);
  });

  it("nenhum KPI ficou sem unidade, depois de H-45", () => {
    /*
     * Eram treze: horas de treinamento, eNPS em pontos, contagens de vaga e de
     * desligamento, idade e tempo de casa em anos. Todos ganharam unidade em
     * 2026-08-24, quando D-H45 estendeu o enum.
     *
     * O conjunto continua fixado para só encolher, e agora está vazio: um KPI
     * novo sem unidade reprova aqui.
     */
    expect(KPIS_SEM_UNIDADE_NO_ENUM).toEqual([]);
  });

  it("e as quatro unidades novas são as que a decisão nomeia", () => {
    const esperado: Readonly<Record<string, string>> = {
      "rh-visao-enps": "pontos",
      "rh-engaj-enps": "pontos",
      "rh-colab-idade-media": "anos",
      "rh-colab-tempo-medio-de-casa": "anos",
      "rh-turnover-tempo-ate-a-saida": "anos",
      "rh-colab-estados-atendidos": "contagem",
      "rh-turnover-desligamentos": "contagem",
      "rh-recrut-vagas-abertas": "contagem",
      "rh-recrut-em-andamento": "contagem",
      "rh-recrut-fechadas-12m": "contagem",
      "rh-recrut-canceladas": "contagem",
      "rh-trein-horas-de-treinamento": "horas",
      "rh-trein-horas-por-fte": "horas",
    };
    // Treze, e não os doze que a tabela de H-45 detalhava: o décimo terceiro é
    // `rh-turnover-tempo-ate-a-saida`, cuja própria justificativa de registro já
    // dizia "medido em anos".
    expect(Object.keys(esperado)).toHaveLength(13);
    for (const [id, unidade] of Object.entries(esperado)) {
      const kpi = REGISTRO_DE_KPIS.find((k) => k.id === id);
      expect(kpi, id).toBeDefined();
      expect(kpi?.unidade, id).toBe(unidade);
    }
  });

  it("o turnover é menor_melhor e a retenção é maior_melhor, nas duas telas", () => {
    // O par que mais expõe um sentido trocado: são o mesmo número visto do
    // avesso, e se os dois tiverem o mesmo sentido, um dos dois está errado.
    for (const tela of ["rh/visao", "rh/turnover"]) {
      const tov = kpisDaTela(tela).find((k) => /Turnover/.test(k.rotulo));
      const ret = kpisDaTela(tela).find((k) => /Reten/.test(k.rotulo));
      expect(tov?.sentido, tela).toBe("menor_melhor");
      expect(ret?.sentido, tela).toBe("maior_melhor");
    }
  });

  it("PMP é maior_melhor e PMR é menor_melhor — não são a mesma coisa", () => {
    // Prazo que o fornecedor dá é bom quando cresce; prazo que o cliente toma
    // é ruim quando cresce. Tratar os dois como "dias, menor melhor" é o erro
    // clássico de leitura de ciclo financeiro.
    expect(kpiPorId("fin-contas-pmp")?.sentido).toBe("maior_melhor");
    expect(kpiPorId("fin-contas-pmr")?.sentido).toBe("menor_melhor");
    expect(kpiPorId("fin-contas-ciclo-de-conversao")?.sentido).toBe(
      "menor_melhor",
    );
  });
});

describe("os KPIs que não reagem a filtro (relacionado ao Anexo D achado 5)", () => {
  it("são vinte e três, e o conjunto está fixado para só encolher", () => {
    /*
     * A primeira versão deste teste dizia catorze, e passava.
     *
     * O critério escrito era "não responde a filtro nenhum", mas a medição só
     * pegava valor em string literal. Um número literal **passado a um
     * formatador** — `this.pc(54.3)` — parecia calculado e escapava. Nove
     * escaparam assim.
     *
     * O teste abaixo fixa a medição correta; o `describe` seguinte impede que
     * o mesmo ponto cego volte.
     */
    expect(CONSTANTES_NO_PROTOTIPO.map((k) => k.id).sort()).toEqual([
      "fin-caixa-conversao-de-dez",
      "fin-contas-ciclo-de-conversao",
      "fin-contas-inadimplencia",
      "fin-contas-pme",
      "fin-contas-pmp",
      "fin-contas-pmr",
      "fin-fat-concentracao-top-10",
      "fin-fat-ticket-medio",
      "fin-visao-margem-bruta",
      "fin-visao-margem-liquida",
      "rh-colab-estados-atendidos",
      "rh-colab-idade-media",
      "rh-colab-superior-ou-mais",
      "rh-colab-tempo-medio-de-casa",
      "rh-engaj-cobertura-da-pesquisa",
      "rh-engaj-promotores",
      "rh-recrut-custo-por-contratacao",
      "rh-recrut-tempo-de-fechamento",
      "rh-sal-encargos",
      "rh-trein-conclusao-media",
      "rh-trein-custo-por-hora",
      "rh-trein-participacao",
      "rh-turnover-tempo-ate-a-saida",
    ]);
  });

  it("os cinco números de fin/contas estão todos entre eles", () => {
    // PMR, PME, PMP, o ciclo e a inadimplência: a tela inteira que a
    // Controladoria mais olha, e nenhum deles muda de recorte hoje.
    expect(
      CONSTANTES_NO_PROTOTIPO.filter((k) => k.tela === "fin/contas").length,
    ).toBe(5);
  });
});

describe("o ponto cego que produziu a contagem errada", () => {
  /**
   * A regressão que este bloco impede.
   *
   * Medir "constante" por string literal deixa passar `this.pc(54.3)`. A
   * medição correta pergunta se a **expressão consulta filtro** — `F.`, `D.`,
   * `AR` ou `S(...)`. Aqui isso é re-derivado do protótipo a cada rodada, e
   * comparado com o registro: se alguém reescrever o registro pela regra
   * errada, os dois divergem e o teste reprova.
   */
  const prototipo = readFileSync(
    resolve(RAIZ, "public", "design", "Dashboard BI v2.dc.html"),
    "utf8",
  );

  function kpisRaw(): string {
    const i = prototipo.indexOf("kpisRaw(t, s, F) {");
    return prototipo.slice(i, prototipo.indexOf("\n  }\n", i));
  }

  it("re-derivar do protótipo dá o mesmo conjunto que o registro", () => {
    const corpo = kpisRaw();
    // `vg` é helper que lê AR e F.ent: quem o chama reage a filtro.
    const consultaFiltro =
      /\bF\.|\bD\.|\bAR\b|\bS\(|\bvg\(|\bhc\b|\bfolha\b|\brec\b|\beb\b|\bor\b|\bre\b|\breclY\b|\bhc0\b/;

    let constantes = 0;
    for (const m of corpo.matchAll(/\{ l: '/g)) {
      const inicio = m.index ?? 0;
      let prof = 0;
      let fim = inicio;
      for (let k = inicio; k < corpo.length; k++) {
        if (corpo[k] === "{") prof++;
        else if (corpo[k] === "}") {
          prof--;
          if (prof === 0) {
            fim = k + 1;
            break;
          }
        }
      }
      const item = corpo.slice(inicio, fim);
      // o valor de `v:`, até a vírgula de topo
      const jv = item.indexOf("v: ") + 3;
      let p2 = 0;
      let v = item.slice(jv);
      for (let k = jv; k < item.length; k++) {
        const c = item[k] ?? "";
        if (c === "(" || c === "[") p2++;
        else if (c === ")" || c === "]") p2--;
        else if (c === "," && p2 === 0) {
          v = item.slice(jv, k);
          break;
        }
      }
      if (!consultaFiltro.test(v)) constantes++;
    }

    expect(constantes).toBe(CONSTANTES_NO_PROTOTIPO.length);
  });

  it("e a medição ingênua daria outro número — é por isso que ela não serve", () => {
    // A prova de que o teste acima não é decorativo: contar só string literal
    // dá 14, e 14 foi o que ficou commitado por engano.
    const corpo = kpisRaw();
    const soLiteral = [...corpo.matchAll(/v: '(?!\+'|R\$ ')[^']*'/g)].length;
    expect(soLiteral).toBeLessThan(CONSTANTES_NO_PROTOTIPO.length);
  });
});

describe("o registro não invadiu o catálogo", () => {
  it("não traz fórmula nem agregação", () => {
    // Seção 9.4: fórmula e `agg` moram no catálogo. Repeti-las aqui criaria
    // duas fontes para a mesma definição — e a que divergisse seria a que
    // ninguém revisa. O teste existe para impedir que alguém "complete" o
    // registro de boa fé.
    for (const k of REGISTRO_DE_KPIS) {
      const campos = Object.keys(k);
      expect(campos).not.toContain("formula");
      expect(campos).not.toContain("agg");
      for (const agg of AGREGACOES) {
        expect(campos).not.toContain(agg);
      }
    }
  });
});

describe("reconciliação: o insumo que este mapa entrega", () => {
  it("todo painel apontado por um KPI tem forma que sustenta um total", () => {
    /*
     * Regra 1 da seção 9.2: o KPI e o painel que o detalha somam o mesmo total.
     *
     * A conferência de valor só existe com adaptador. O que dá para conferir
     * agora é estrutural: um KPI não pode ser detalhado por um painel de forma
     * `estatisticas`, porque estatísticas não somam a um total — são números
     * soltos, cada um com a sua unidade.
     */
    const impossiveis = REGISTRO_DE_KPIS.filter((k) => {
      if (k.detalhadoPor === null) return false;
      return painelPorId(k.detalhadoPor)?.forma === "estatisticas";
    }).map((k) => `${k.id} → ${k.detalhadoPor} (estatisticas)`);
    expect(impossiveis).toEqual([]);
  });

  it("todo painel do registro dos 71 continua alcançável", () => {
    // Não é obrigatório que todo painel detalhe um KPI — a maioria não detalha.
    // O que este teste garante é que o mapa não inventou id nenhum.
    const ids = new Set(REGISTRO_DE_PAINEIS.map((p) => p.id));
    const inventados = REGISTRO_DE_KPIS.map((k) => k.detalhadoPor)
      .filter((p): p is string => p !== null)
      .filter((p) => !ids.has(p));
    expect(inventados).toEqual([]);
  });
});
