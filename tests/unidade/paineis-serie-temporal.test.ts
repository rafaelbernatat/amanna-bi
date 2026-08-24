/**
 * `getPanel` para barras, linha e barras empilhadas — os 31 de T-117.
 *
 * Três coisas precisam valer ao mesmo tempo, e cada uma pega um defeito
 * diferente:
 *
 * 1. **Envelope válido no JSON Schema.** Pega campo faltando e forma errada —
 *    o painel que compila e quebra na tela.
 * 2. **Muda ao trocar entidade e área.** Pega o achado 5 em forma de gráfico:
 *    o desenho bonito que ignora o filtro.
 * 3. **Categorias respeitam o período.** Pega o achado 6: o filtro que existe
 *    na barra e não chega ao dado.
 */

import Ajv from "ajv";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  calcularPainel,
  paineisComDesenho,
  PainelDesconhecido,
  PainelSemDesenho,
} from "@/acesso/fixtures/paineis";
import { MESES_DO_PERIODO } from "@/acesso/fixtures/recorte";
import type { Query } from "@/semantica/contrato";
import {
  EIXOS_TEMPORAIS,
  FORMAS_DE_SERIE_TEMPORAL,
  INVARIANTES_DOS_PAINEIS,
  invariantesSob,
  origemDoPainel,
} from "@/semantica/origem-de-painel";
import { REGISTRO_DE_PAINEIS } from "@/semantica/paineis";

const BASE: Query = {
  entidade: "consolidado",
  area: "todas",
  modalidade: "todas",
  periodo: "12-meses",
  ano: "2026",
};

const DAS_TRES_FORMAS = REGISTRO_DE_PAINEIS.filter((p) =>
  FORMAS_DE_SERIE_TEMPORAL.some((f) => f === p.forma),
);

const IDS = DAS_TRES_FORMAS.map((p) => p.id);

const PERIODOS = ["12-meses", "6-meses", "4-trimestre", "dezembro"] as const;

/**
 * O envelope, estreitado às formas cartesianas.
 *
 * `calcularPainel` passou a devolver também as formas categóricas de T-118, e
 * nove das doze variantes não têm `series`. Estreitar aqui é o oposto de um
 * `as`: se um painel destas três formas deixar de trazer carga cartesiana, o
 * teste falha com uma frase, em vez de o compilador ser calado.
 */
function cartesiano(id: string, q: Query) {
  const envelope = calcularPainel(id, q);
  if (!("categories" in envelope) || !("series" in envelope)) {
    throw new Error(
      `${id} devolveu um envelope sem carga cartesiana — forma ${envelope.forma}`,
    );
  }
  return envelope;
}

/** As séries de um painel, como texto — para comparar dois recortes. */
function assinatura(id: string, q: Query): string {
  return JSON.stringify(cartesiano(id, q).series.map((s) => s.values));
}

/* ------------------------------------------------------------------ *
 * 1. O envelope
 * ------------------------------------------------------------------ */

describe("todo painel responde com envelope válido", () => {
  // Mesmo arnês de T-102: o schema é draft-07 e o modo estrito do Ajv
  // reclamaria de vocabulário que não afeta validação.
  const schema: Record<string, unknown> = JSON.parse(
    readFileSync("contratos/painel.schema.json", "utf8"),
  ) as Record<string, unknown>;
  const validar = new Ajv({ allErrors: true, strict: false }).compile(schema);

  it.each(IDS)("%s valida contra o JSON Schema publicado", (id) => {
    const envelope = cartesiano(id, BASE);
    const ok = validar(envelope);
    expect(ok, JSON.stringify(validar.errors?.slice(0, 3))).toBe(true);
  });

  it("os 31 estão entre os que sabem se desenhar", () => {
    /*
     * Era igualdade até T-118, quando 34 painéis categóricos passaram a saber
     * se desenhar também. A afirmação que continua sendo desta tarefa é a
     * inclusão: nenhum dos 31 pode ter deixado de desenhar. A conta total dos
     * que desenham é do arquivo de T-118, onde ela é o assunto.
     */
    const sabem = new Set(paineisComDesenho());
    const sem = IDS.filter((id) => !sabem.has(id));
    expect(sem).toEqual([]);
    expect(IDS).toHaveLength(31);
  });

  it.each(IDS)("%s declara fórmula não vazia", (id) => {
    // PR-3 e T-109: número sem fórmula é número sem procedência.
    expect(calcularPainel(id, BASE).formula.trim().length).toBeGreaterThan(0);
  });

  it.each(IDS)(
    "%s tem uma série por série declarada, do mesmo tamanho",
    (id) => {
      const envelope = cartesiano(id, BASE);
      const origem = origemDoPainel(id);
      expect(envelope.series).toHaveLength(origem?.series.length ?? -1);
      for (const serie of envelope.series) {
        expect(serie.values, `${id} · ${serie.name}`).toHaveLength(
          envelope.categories.length,
        );
      }
    },
  );

  it("painel que não existe lança, e não devolve envelope vazio", () => {
    // Envelope vazio faria um id errado parecer um recorte sem dado — o pior
    // dos dois erros, porque parece uma resposta.
    expect(() => calcularPainel("nao-existe", BASE)).toThrowError(
      PainelDesconhecido,
    );
  });

  it("painel de forma que ainda não tem desenho lança nomeando a tarefa", () => {
    /*
     * "Outra forma" deixou de bastar quando T-118 cobriu cinco delas. As que
     * ainda recusam são as quatro de T-119 — e é uma delas que precisa lançar,
     * não uma que já desenha.
     */
    const semDesenho = new Set(paineisComDesenho());
    const deT119 = REGISTRO_DE_PAINEIS.find((p) => !semDesenho.has(p.id));
    expect(deT119, "todas as formas já desenham?").toBeDefined();
    expect(() => calcularPainel(deT119?.id ?? "", BASE)).toThrowError(
      PainelSemDesenho,
    );
  });
});

/* ------------------------------------------------------------------ *
 * 2. O painel responde ao recorte
 * ------------------------------------------------------------------ */

describe("o painel muda ao trocar entidade", () => {
  const invariantes = new Set(invariantesSob("entidade"));
  const mudam = IDS.filter((id) => !invariantes.has(id));

  it.each(mudam)("%s muda entre consolidado e unidade de SP", (id) => {
    expect(assinatura(id, BASE)).not.toBe(
      assinatura(id, { ...BASE, entidade: "unidade-sp" }),
    );
  });

  /*
   * O outro sentido, e é ele que impede a lista de virar esconderijo.
   *
   * Declarar um painel invariante sem que ele seja invariante deixaria passar
   * exatamente o defeito que o item 2 do aceite existe para pegar. Aqui cada
   * declaração é verificada: quem está na lista tem de mesmo não mudar.
   */
  it.each([...invariantes])("%s é invariante, como declarado", (id) => {
    expect(assinatura(id, BASE)).toBe(
      assinatura(id, { ...BASE, entidade: "unidade-sp" }),
    );
  });
});

describe("o painel muda ao trocar área", () => {
  const invariantes = new Set(invariantesSob("area"));
  const mudam = IDS.filter((id) => !invariantes.has(id));

  it.each(mudam)("%s muda entre todas as áreas e Tecnologia", (id) => {
    expect(assinatura(id, BASE)).not.toBe(
      assinatura(id, { ...BASE, area: "tecnologia" }),
    );
  });

  it.each([...invariantes])("%s é invariante, como declarado", (id) => {
    expect(assinatura(id, BASE)).toBe(
      assinatura(id, { ...BASE, area: "tecnologia" }),
    );
  });
});

describe("o painel muda ao trocar modalidade", () => {
  const invariantes = new Set(invariantesSob("modalidade"));
  const mudam = IDS.filter((id) => !invariantes.has(id));

  it.each(mudam)("%s muda entre todas e remoto", (id) => {
    expect(assinatura(id, BASE)).not.toBe(
      assinatura(id, { ...BASE, modalidade: "remoto" }),
    );
  });

  it.each([...invariantes])("%s é invariante, como declarado", (id) => {
    expect(assinatura(id, BASE)).toBe(
      assinatura(id, { ...BASE, modalidade: "remoto" }),
    );
  });
});

/* ------------------------------------------------------------------ *
 * A lista de invariantes é ela mesma verificada
 * ------------------------------------------------------------------ */

describe("a lista de invariantes não pode virar esconderijo", () => {
  it("toda entrada tem razão escrita, e não uma palavra", () => {
    /*
     * "Não muda" sem razão é indistinguível de defeito. A exigência de tamanho
     * mínimo existe porque um `porque: "n/a"` passaria numa checagem de
     * presença e não explicaria nada a quem lê daqui a um ano.
     */
    const MINIMO = 40;
    const fracas = INVARIANTES_DOS_PAINEIS.filter(
      (i) => i.porque.trim().length < MINIMO,
    ).map((i) => `${i.dimensao}: ${i.porque}`);
    expect(fracas).toEqual([]);
  });

  it("nenhuma entrada aponta para painel fora das três formas", () => {
    const conhecidos = new Set(IDS);
    const forasteiros = INVARIANTES_DOS_PAINEIS.flatMap((i) =>
      i.paineis.filter((p) => !conhecidos.has(p)),
    );
    expect(forasteiros).toEqual([]);
  });

  it("nenhum painel aparece duas vezes na mesma dimensão", () => {
    // Duplicata é sinal de duas justificativas concorrentes para o mesmo caso,
    // e a segunda esconderia a primeira.
    for (const dimensao of ["entidade", "area", "modalidade"] as const) {
      const lista = invariantesSob(dimensao);
      expect(new Set(lista).size, dimensao).toBe(lista.length);
    }
  });
});

/* ------------------------------------------------------------------ *
 * 3. As categorias e o período
 * ------------------------------------------------------------------ */

describe("as categorias respeitam o recorte de período", () => {
  const temporais = IDS.filter((id) => {
    const origem = origemDoPainel(id);
    return (
      origem !== undefined &&
      EIXOS_TEMPORAIS.includes(origem.eixo) &&
      origem.eixo === "mes"
    );
  });

  it("são 22 painéis de eixo mensal, contados", () => {
    expect(temporais).toHaveLength(22);
  });

  it.each(temporais.flatMap((id) => PERIODOS.map((p) => [id, p] as const)))(
    "%s em %s tem uma categoria por mês da janela",
    (id, periodo) => {
      const envelope = cartesiano(id, { ...BASE, periodo });
      expect(envelope.categories).toHaveLength(MESES_DO_PERIODO[periodo] ?? -1);
    },
  );

  it.each(temporais)("%s enumera meses do ano pedido, em ordem", (id) => {
    const cats = cartesiano(id, BASE).categories;
    expect(cats[0]).toBe("2026-01");
    expect(cats.at(-1)).toBe("2026-12");
    expect([...cats].sort()).toEqual([...cats]);
  });

  /*
   * O eixo que não é tempo não encolhe com o período, e isso está certo.
   *
   * Um aging tem cinco faixas de vencimento tanto em doze meses quanto em
   * dezembro — o que muda é o saldo dentro delas, não quantas são. Exigir que
   * encolhesse seria confundir "o recorte chegou ao dado" com "o recorte mudou
   * o desenho".
   */
  const naoTemporais = IDS.filter((id) => {
    const origem = origemDoPainel(id);
    return (
      origem !== undefined && !EIXOS_TEMPORAIS.some((e) => e === origem.eixo)
    );
  });

  it.each(naoTemporais)(
    "%s mantém as categorias entre 12 meses e o mês",
    (id) => {
      const doze = cartesiano(id, BASE).categories;
      const dezembro = cartesiano(id, {
        ...BASE,
        periodo: "dezembro",
      }).categories;
      expect(dezembro).toEqual(doze);
    },
  );

  it("mas o valor dentro delas muda — senão o filtro seria decorativo", () => {
    // O aging é estoque no fim da janela e as quatro janelas terminam em
    // dezembro, então ele é o contraexemplo errado. `tov-custo` é fluxo: o
    // custo de três meses é menor que o de doze.
    const doze = cartesiano("tov-custo", BASE).total ?? 0;
    const tri =
      cartesiano("tov-custo", { ...BASE, periodo: "4-trimestre" }).total ?? 0;
    expect(tri).toBeLessThan(doze);
    expect(tri).toBeGreaterThan(0);
  });

  /*
   * O painel diário é o terceiro caso, e não cabe em nenhum dos dois de cima.
   *
   * O eixo é tempo, mas a unidade é o dia útil e não o mês, então ele não tem
   * "uma categoria por mês da janela". E ele encolhe com o recorte, então
   * também não é dos que mantêm as categorias. A primeira versão deste bloco o
   * pôs junto dos não temporais e o teste reprovou — corretamente: em dezembro
   * a janela tem 23 dias úteis, e o painel devolve os 23 que existem.
   *
   * Completar até trinta com dias de novembro mostraria, dentro de um filtro,
   * dado que o filtro excluiu.
   */
  it("o painel diário mostra trinta dias úteis, como o título promete", () => {
    const envelope = cartesiano("cx-diario", BASE);
    expect(envelope.categories).toHaveLength(30);
    expect(envelope.categories.at(-1)).toBe("2026-12-31");
  });

  it("e devolve o que existe quando a janela é mais curta que trinta", () => {
    const dezembro = cartesiano("cx-diario", {
      ...BASE,
      periodo: "dezembro",
    });
    expect(dezembro.categories).toHaveLength(23);
    expect(dezembro.categories[0]).toBe("2026-12-01");
    // Nenhum dia de fora da janela entrou para completar.
    for (const dia of dezembro.categories) {
      expect(dia.startsWith("2026-12"), dia).toBe(true);
    }
  });
});

/* ------------------------------------------------------------------ *
 * O total afirma a janela, e não a soma das barras
 * ------------------------------------------------------------------ */

describe("o total do painel", () => {
  it("de taxa é a taxa da janela, e não a soma das taxas", () => {
    /*
     * Somar doze percentuais de folha sobre receita daria 186 %, e o painel
     * passaria a afirmar algo que não existe. O total é a mesma medida sobre a
     * janela inteira — que é como o cartão da mesma tela a calcula.
     */
    const envelope = cartesiano("int-pct", BASE);
    const soma = (envelope.series[0]?.values ?? []).reduce(
      (a: number, v: number | null) => a + (v ?? 0),
      0,
    );
    expect(envelope.total).not.toBe(soma);
    expect(envelope.total ?? 0).toBeLessThan(100);
    expect(envelope.total ?? 0).toBeGreaterThan(0);
  });

  it("de estoque é o saldo do fim, e não a soma dos doze saldos", () => {
    const envelope = cartesiano("cx-saldo", BASE);
    expect(envelope.total).toBe(envelope.series[0]?.values.at(-1));
  });

  it("de partição é a soma das partes", () => {
    const envelope = cartesiano("cr-aging", BASE);
    const soma = (envelope.series[0]?.values ?? []).reduce(
      (a: number, v: number | null) => a + (v ?? 0),
      0,
    );
    expect(envelope.total).toBeCloseTo(soma, 6);
  });
});
