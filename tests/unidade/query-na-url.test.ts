/**
 * O recorte na URL (T-127, seção 6.6).
 *
 * O aceite pede o round-trip exato para os 768 recortes válidos. Aqui eles são
 * **gerados** a partir do vocabulário e da matriz de T-004, e não escritos: uma
 * lista escrita à mão teria 768 linhas que ninguém conferiria, e um valor novo
 * no vocabulário não entraria nela.
 */

import { describe, expect, it } from "vitest";

import type { Query } from "@/semantica/contrato";
import {
  AREAS,
  ENTIDADES,
  MODALIDADES,
  PERIODOS,
  QUERY_PADRAO,
} from "@/semantica/contrato";
import { contarRecortes } from "@/semantica/recortes";
import {
  apelidar,
  buscaParaQuery,
  PARAMETROS,
  queryParaBusca,
  rotaCom,
} from "@/semantica/url";

const ANOS = ["2025", "2026"] as const;

/** Os 768 recortes, pelo produto das dimensões — contados, nunca escritos. */
function todosOsRecortes(): readonly Query[] {
  const saida: Query[] = [];
  for (const periodo of PERIODOS)
    for (const ano of ANOS)
      for (const entidade of ENTIDADES)
        for (const area of AREAS)
          for (const modalidade of MODALIDADES)
            saida.push({ periodo, ano, entidade, area, modalidade });
  return saida;
}

const RECORTES = todosOsRecortes();

describe("a matriz de recortes", () => {
  it("tem 768 combinações, batendo com a contagem de T-004", () => {
    expect(RECORTES.length).toBe(768);
    expect(RECORTES.length).toBe(
      contarRecortes({
        periodo: [...PERIODOS],
        ano: [...ANOS],
        entidade: [...ENTIDADES],
        area: [...AREAS],
        modalidade: [...MODALIDADES],
      }),
    );
  });
});

describe("o round-trip Query → URL → Query", () => {
  it("é idêntico para os 768 recortes", () => {
    const divergentes: string[] = [];
    for (const q of RECORTES) {
      const volta = buscaParaQuery(queryParaBusca(q), ANOS).query;
      if (JSON.stringify(volta) !== JSON.stringify(q)) {
        divergentes.push(`${JSON.stringify(q)} → ${JSON.stringify(volta)}`);
      }
    }
    expect(divergentes).toEqual([]);
  });

  it("nenhum recorte perde aviso pelo caminho", () => {
    // Um round-trip que "funciona" mas avisa a cada volta seria um round-trip
    // quebrado com cara de bom.
    for (const q of RECORTES) {
      expect(buscaParaQuery(queryParaBusca(q), ANOS).avisos).toEqual([]);
    }
  });

  it("recortes distintos produzem URLs distintas", () => {
    // Sem isto, dois recortes podendo colidir na mesma URL passariam no
    // round-trip apenas por sorte de ordem.
    const urls = new Set(RECORTES.map((q) => queryParaBusca(q).toString()));
    expect(urls.size).toBe(768);
  });

  it("a ordem dos parâmetros é canônica, não a de digitação", () => {
    const q: Query = {
      periodo: "6-meses",
      ano: "2025",
      entidade: "unidade-sp",
      area: "rh",
      modalidade: "remoto",
    };
    const chaves = [...queryParaBusca(q).keys()];
    expect(chaves).toEqual([...PARAMETROS]);
  });
});

describe("a URL fica legível", () => {
  it("o recorte padrão não põe parâmetro nenhum", () => {
    expect(queryParaBusca(QUERY_PADRAO).toString()).toBe("");
    expect(rotaCom("rh/visao", QUERY_PADRAO)).toBe("/rh/visao");
  });

  it("'4º trimestre' vira '4-trimestre', e não '4%C2%BA+trimestre'", () => {
    const url = rotaCom("fin/visao", {
      ...QUERY_PADRAO,
      periodo: "4-trimestre",
    });
    expect(url).toBe("/fin/visao?periodo=4-trimestre");
    expect(url).not.toContain("%");
  });

  it("nenhum apelido do vocabulário precisa de codificação", () => {
    // A prova de que a URL inteira é legível: se algum valor gerasse um
    // apelido com caractere reservado, ele apareceria codificado no `%`.
    const todos = [...PERIODOS, ...ENTIDADES, ...AREAS, ...MODALIDADES];
    for (const v of todos) {
      const a = apelidar(v);
      expect(a).toMatch(/^[a-z0-9-]+$/);
      expect(encodeURIComponent(a)).toBe(a);
    }
  });

  it("os apelidos são únicos dentro de cada dimensão", () => {
    // Dois valores com o mesmo apelido fariam a leitura devolver o errado, em
    // silêncio. É o modo de falha que uma tabela escrita à mão introduz.
    for (const dim of [PERIODOS, ENTIDADES, AREAS, MODALIDADES]) {
      expect(new Set(dim.map(apelidar)).size).toBe(dim.length);
    }
  });
});

describe("valor fora do vocabulário cai no padrão, com aviso", () => {
  it("período inválido: usa o padrão e registra o desvio", () => {
    const r = buscaParaQuery("periodo=decada", ANOS);
    expect(r.query.periodo).toBe(QUERY_PADRAO.periodo);
    expect(r.avisos).toEqual([
      {
        campo: "periodo",
        pedido: "decada",
        usado: QUERY_PADRAO.periodo,
        motivo: "fora_do_vocabulario",
      },
    ]);
  });

  it("cair no padrão nunca acontece em silêncio", () => {
    // O ponto do aceite. Sem aviso, a pessoa leria '12 meses' achando que
    // está vendo o que pediu.
    for (const busca of [
      "periodo=decada",
      "entidade=matriz",
      "area=juridico",
      "modalidade=hibrido-parcial",
    ]) {
      expect(buscaParaQuery(busca, ANOS).avisos.length).toBe(1);
    }
  });

  it("vários inválidos rendem vários avisos, não o primeiro", () => {
    const r = buscaParaQuery("periodo=x&entidade=y&area=z", ANOS);
    expect(r.avisos.map((a) => a.campo).sort()).toEqual([
      "area",
      "entidade",
      "periodo",
    ]);
  });

  it("nunca lança, por pior que seja a URL", () => {
    for (const lixo of [
      "",
      "periodo=",
      "periodo=%%%",
      "a=1&a=2&a=3",
      "painel=",
      "ano=abacaxi",
      "periodo=12-meses&periodo=6-meses",
    ]) {
      expect(() => buscaParaQuery(lixo, ANOS)).not.toThrow();
    }
  });

  it("URL vazia devolve o recorte padrão sem aviso", () => {
    const r = buscaParaQuery("", ANOS);
    expect(r.query).toEqual(QUERY_PADRAO);
    expect(r.avisos).toEqual([]);
  });
});

describe("o ano, que não tem vocabulário fechado (D-P8)", () => {
  it("aceita qualquer ano que getMeta declarou", () => {
    expect(buscaParaQuery("ano=2025", ANOS).query.ano).toBe("2025");
  });

  it("ano inexistente cai no mais recente, com aviso", () => {
    const r = buscaParaQuery("ano=2019", ANOS);
    expect(r.query.ano).toBe("2026");
    expect(r.avisos[0]?.motivo).toBe("ano_indisponivel");
  });

  it("sem a lista de anos, aceita como veio", () => {
    // Quem chama sem a lista ainda não sabe quais anos existem. Inventar uma
    // lista aqui seria a decisão que D-P8 tirou do código.
    expect(buscaParaQuery("ano=2031").query.ano).toBe("2031");
    expect(buscaParaQuery("ano=2031").avisos).toEqual([]);
  });

  it("URL sem ano, e o padrão não foi carregado: usa o mais recente", () => {
    const r = buscaParaQuery("", ["2023", "2024"]);
    expect(r.query.ano).toBe("2024");
  });
});

describe("trocar de tela preserva os cinco filtros", () => {
  const RECORTE: Query = {
    periodo: "4-trimestre",
    ano: "2025",
    entidade: "unidade-sp",
    area: "tecnologia",
    modalidade: "hibrido",
  };

  it("os cinco sobrevivem à troca de tela", () => {
    const partida = rotaCom("rh/turnover", RECORTE);
    const chegada = rotaCom("fin/caixa", RECORTE);

    const q1 = buscaParaQuery(partida.split("?")[1] ?? "", ANOS).query;
    const q2 = buscaParaQuery(chegada.split("?")[1] ?? "", ANOS).query;

    expect(q1).toEqual(RECORTE);
    expect(q2).toEqual(RECORTE);
    expect(chegada.startsWith("/fin/caixa?")).toBe(true);
  });

  it("percorrer as 13 telas não perde nem altera um filtro", () => {
    const telas = [
      "rh/visao",
      "rh/colab",
      "rh/turnover",
      "rh/recrut",
      "rh/trein",
      "rh/engaj",
      "rh/sal",
      "fin/visao",
      "fin/caixa",
      "fin/orc",
      "fin/contas",
      "fin/fat",
      "int/cruz",
    ];
    for (const t of telas) {
      const url = rotaCom(t, RECORTE);
      expect(buscaParaQuery(url.split("?")[1] ?? "", ANOS).query).toEqual(
        RECORTE,
      );
    }
  });
});

describe("o painel destacado (seção 6.6)", () => {
  it("vai e volta pela URL", () => {
    const url = rotaCom("fin/orc", QUERY_PADRAO, "orc-desvio");
    expect(url).toBe("/fin/orc?painel=orc-desvio");
    expect(buscaParaQuery("painel=orc-desvio").painelDestacado).toBe(
      "orc-desvio",
    );
  });

  it("convive com os filtros sem atrapalhar o round-trip", () => {
    const q: Query = { ...QUERY_PADRAO, area: "comercial" };
    const url = rotaCom("fin/orc", q, "orc-desvio");
    const busca = url.split("?")[1] ?? "";
    const r = buscaParaQuery(busca, ANOS);

    expect(r.query).toEqual(q);
    expect(r.painelDestacado).toBe("orc-desvio");
  });

  it("ausente é null, e não string vazia", () => {
    expect(buscaParaQuery("").painelDestacado).toBeNull();
    expect(buscaParaQuery("painel=").painelDestacado).toBeNull();
  });
});
