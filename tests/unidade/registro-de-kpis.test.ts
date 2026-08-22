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

  it("são exatamente cinco sem detalhamento, e nenhum a mais", () => {
    // Fixado para só encolher: um KPI novo sem painel entra calado se ninguém
    // contar, e "sem detalhamento" vira o padrão em vez da exceção.
    expect(SEM_DETALHAMENTO.map((k) => k.id).sort()).toEqual([
      "fin-fat-ticket-medio",
      "rh-engaj-cobertura-da-pesquisa",
      "rh-recrut-custo-por-contratacao",
      "rh-trein-custo-por-hora",
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

  it("13 KPIs medem o que o enum não nomeia (H-45), e o conjunto é fixo", () => {
    // Mesmo achado de T-107, agora do lado dos KPIs: horas, eNPS em pontos,
    // contagens de vaga e de desligamento, idade e tempo de casa em anos.
    expect(KPIS_SEM_UNIDADE_NO_ENUM.length).toBe(13);
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

describe("os KPIs cravados no protótipo (Anexo D achado 5)", () => {
  it("são catorze, e o conjunto está fixado para só encolher", () => {
    /*
     * Catorze dos setenta não respondem a filtro nenhum no protótipo.
     *
     * Fixar a lista transforma o achado em lista de verificação da Fase 2:
     * cada um que passar a responder ao recorte sai daqui, e um KPI novo
     * cravado não entra calado.
     */
    expect(CONSTANTES_NO_PROTOTIPO.map((k) => k.id).sort()).toEqual([
      "fin-contas-ciclo-de-conversao",
      "fin-contas-pme",
      "fin-contas-pmp",
      "fin-contas-pmr",
      "fin-fat-ticket-medio",
      "rh-colab-estados-atendidos",
      "rh-colab-idade-media",
      "rh-colab-tempo-medio-de-casa",
      "rh-recrut-custo-por-contratacao",
      "rh-recrut-tempo-de-fechamento",
      "rh-sal-encargos",
      "rh-trein-conclusao-media",
      "rh-trein-participacao",
      "rh-turnover-tempo-ate-a-saida",
    ]);
  });

  it("o ciclo financeiro inteiro está entre eles", () => {
    // PMR, PME, PMP e o ciclo: os quatro números da tela `fin/contas` que a
    // Controladoria mais olha, e nenhum deles muda de recorte hoje.
    const ciclo = CONSTANTES_NO_PROTOTIPO.filter(
      (k) => k.tela === "fin/contas",
    );
    expect(ciclo.length).toBe(4);
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
