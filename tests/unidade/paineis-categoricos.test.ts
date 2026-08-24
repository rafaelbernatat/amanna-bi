/**
 * `getPanel` para as cinco formas categóricas — os 34 de T-118.
 *
 * O aceite pede três coisas, e cada uma pega um defeito diferente:
 *
 * 1. **Envelope válido** nas cinco formas. Pega a carga trocada — a rosca sem
 *    centro, o funil sem passos, o painel de estatísticas sem fórmula por
 *    número.
 * 2. **Sob recorte de uma área, o painel quebrado por área devolve exatamente
 *    uma categoria.** Pega o painel que ignora o filtro e desenha a empresa
 *    inteira para quem pediu um pedaço.
 * 3. **As fatias da rosca somam o total declarado.** Pega a participação
 *    calculada sobre um denominador fixo — o defeito do protótipo, onde
 *    `pct(v, 1240)` faz as fatias somarem muito menos que 100 % em qualquer
 *    recorte que não seja o consolidado.
 */

import Ajv from "ajv";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  calcularPainel,
  paineisComDesenho,
  PainelDesconhecido,
} from "@/acesso/fixtures/paineis";
import type { Query } from "@/semantica/contrato";
import {
  FORMAS_CATEGORICAS,
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

const CATEGORICOS = REGISTRO_DE_PAINEIS.filter((p) =>
  FORMAS_CATEGORICAS.some((f) => f === p.forma),
);
const IDS = CATEGORICOS.map((p) => p.id);

/** Quase 100: a repartição é de inteiros e o resto se acomoda nas fatias. */
const TOLERANCIA = 0.001;

/* ------------------------------------------------------------------ *
 * 1. O envelope
 * ------------------------------------------------------------------ */

describe("as cinco formas respondem com envelope válido", () => {
  const schema: Record<string, unknown> = JSON.parse(
    readFileSync("contratos/painel.schema.json", "utf8"),
  ) as Record<string, unknown>;
  const validar = new Ajv({ allErrors: true, strict: false }).compile(schema);

  it("são 34 painéis nas cinco formas, contados e não escritos", () => {
    expect(CATEGORICOS).toHaveLength(34);
  });

  it.each(IDS)("%s valida contra o JSON Schema publicado", (id) => {
    const envelope = calcularPainel(id, BASE);
    const ok = validar(envelope);
    expect(ok, JSON.stringify(validar.errors?.slice(0, 3))).toBe(true);
  });

  it("os 34 desta tarefa sabem se desenhar", () => {
    /*
     * Era "os 65 de T-117 e T-118" até T-119 fechar a conta em 71. A afirmação
     * que continua sendo **desta** tarefa é sobre os 34 dela; a cobertura
     * total virou assunto do arquivo de T-119, onde ela é o tema.
     */
    const sabem = new Set(paineisComDesenho());
    const sem = IDS.filter((id) => !sabem.has(id));
    expect(sem).toEqual([]);
    expect(IDS).toHaveLength(34);
  });

  it("painel que não existe no registro recusa, nomeando o problema", () => {
    /*
     * Era "as quatro formas de T-119 continuam recusando" — e elas pararam de
     * recusar, porque T-119 as implementou. O que continua tendo de recusar é
     * um id que não existe: devolver envelope vazio ali faria um erro de
     * digitação parecer um recorte sem dado.
     */
    expect(() => calcularPainel("forma-que-nao-existe", BASE)).toThrowError(
      PainelDesconhecido,
    );
  });

  it.each(IDS)("%s traz a carga que a forma exige", (id) => {
    const e = calcularPainel(id, BASE);
    if (e.forma === "rosca") {
      expect(e.centro.rotulo.length, id).toBeGreaterThan(0);
      expect(Array.isArray(e.fatias), id).toBe(true);
    } else if (e.forma === "funil") {
      expect(e.passos.length, id).toBeGreaterThan(0);
    } else if (e.forma === "divisao") {
      expect(e.grupos.length, id).toBeGreaterThan(0);
      for (const grupo of e.grupos) {
        expect(grupo.nome.length, `${id} · grupo sem nome`).toBeGreaterThan(0);
      }
    } else if (e.forma === "estatisticas") {
      expect(e.estatisticas.length, id).toBeGreaterThan(0);
    } else {
      expect("categories" in e, id).toBe(true);
    }
  });

  it.each(IDS)("%s entrega uma série por série declarada", (id) => {
    /*
     * A guarda que faltava, e o defeito que ela pegou.
     *
     * `tov-area` e `rec-tempo` declaram uma linha de meta na origem e o desenho
     * só produzia a barra — a segunda série saía vazia, e o traço da meta
     * simplesmente não existiria na tela. Nada mais reprovava: o schema aceita
     * série vazia, e o painel "funcionava".
     *
     * Só vale para as formas com carga cartesiana; nas outras a declaração
     * descreve fatias, passos ou grupos, e a checagem é a de carga logo acima.
     */
    const e = calcularPainel(id, BASE);
    if (!("series" in e)) return;
    const origem = origemDoPainel(id);
    expect(e.series, id).toHaveLength(origem?.series.length ?? -1);
    for (const serie of e.series) {
      expect(serie.values.length, `${id} · ${serie.name}`).toBe(
        e.categories.length,
      );
    }
  });

  it("todo número de painel de estatísticas traz fórmula e unidade próprias", () => {
    /*
     * PR-3 vale por número. Num painel de estatísticas cada caixa é de uma
     * medida diferente — "vagas movimentadas" e "custo médio de contratação"
     * não compartilham nem fórmula nem unidade —, e herdar a do painel faria a
     * tela declarar uma procedência que não é a daquele número.
     */
    const deEstatistica = IDS.map((id) => calcularPainel(id, BASE)).filter(
      (e) => e.forma === "estatisticas",
    );
    expect(deEstatistica).toHaveLength(7);

    for (const e of deEstatistica) {
      for (const item of e.estatisticas) {
        expect(
          item.formula.trim().length,
          `${e.id} · ${item.rotulo}`,
        ).toBeGreaterThan(0);
        expect(item.rotulo.length, e.id).toBeGreaterThan(0);
      }
      // E as fórmulas são distintas entre si: uma única repetida seria a do
      // painel copiada em todas as caixas.
      const formulas = new Set(e.estatisticas.map((i) => i.formula));
      expect(formulas.size, e.id).toBe(e.estatisticas.length);
    }
  });
});

/* ------------------------------------------------------------------ *
 * 2. Recorte de uma área devolve uma categoria
 * ------------------------------------------------------------------ */

describe("sob recorte de uma área, o painel quebrado por área tem uma categoria", () => {
  const POR_AREA = IDS.filter((id) => origemDoPainel(id)?.eixo === "area");

  it("são oito painéis quebrados por área", () => {
    expect(POR_AREA).toHaveLength(8);
  });

  it.each(POR_AREA)("%s devolve as sete áreas no consolidado", (id) => {
    const e = calcularPainel(id, BASE);
    expect("categories" in e && e.categories.length, id).toBe(7);
  });

  it.each(POR_AREA)("%s devolve exatamente uma sob recorte de área", (id) => {
    /*
     * Uma, e não sete com seis zeradas.
     *
     * O zero seria mentira: não é que Operações não tenha quadro, é que
     * Operações não está no recorte. Desenhar a barra dela em zero afirma a
     * primeira coisa quando só se sabe a segunda.
     */
    const e = calcularPainel(id, { ...BASE, area: "tecnologia" });
    expect("categories" in e, id).toBe(true);
    if (!("categories" in e)) return;
    expect(e.categories, id).toEqual(["tecnologia"]);
    for (const serie of e.series) {
      expect(serie.values.length, `${id} · ${serie.name}`).toBe(1);
    }
  });

  it.each(POR_AREA)("%s muda de valor ao trocar de área", (id) => {
    const tec = JSON.stringify(
      calcularPainel(id, { ...BASE, area: "tecnologia" }),
    );
    const ops = JSON.stringify(
      calcularPainel(id, { ...BASE, area: "operacoes" }),
    );
    expect(tec).not.toBe(ops);
  });
});

/* ------------------------------------------------------------------ *
 * 3. As fatias somam o total declarado
 * ------------------------------------------------------------------ */

describe("as fatias somam o total declarado, em qualquer recorte", () => {
  const ROSCAS = IDS.filter(
    (id) => REGISTRO_DE_PAINEIS.find((p) => p.id === id)?.forma === "rosca",
  );
  const DIVISOES = IDS.filter(
    (id) => REGISTRO_DE_PAINEIS.find((p) => p.id === id)?.forma === "divisao",
  );

  const RECORTES: readonly (readonly [string, Query])[] = [
    ["consolidado", BASE],
    ["unidade de SP", { ...BASE, entidade: "unidade-sp" }],
    ["Tecnologia", { ...BASE, area: "tecnologia" }],
    ["remoto", { ...BASE, modalidade: "remoto" }],
    ["dezembro", { ...BASE, periodo: "dezembro" }],
  ];

  it.each(
    ROSCAS.flatMap((id) => RECORTES.map((r) => [id, r[0], r[1]] as const)),
  )("%s fecha em 100%% no recorte %s", (id, _rotulo, q) => {
    /*
     * O defeito do protótipo, e a razão deste caso existir.
     *
     * Lá a conta é `pct(valor, 1240)` — o quadro inteiro cravado no
     * denominador. Sob recorte de uma área, as fatias somam a participação
     * daquela área no total da empresa, e o anel fica com um buraco enorme
     * sem que nada avise. Aqui o denominador é a soma do que está na tela.
     */
    const e = calcularPainel(id, q);
    expect(e.forma, id).toBe("rosca");
    if (e.forma !== "rosca") return;
    if (e.fatias.length === 0) {
      expect(e.total, `${id} sem fatias deveria ter total nulo`).toBeNull();
      return;
    }
    const soma = e.fatias.reduce((a, f) => a + f.valor, 0);
    expect(Math.abs(soma - 100), `${id}: somou ${String(soma)}`).toBeLessThan(
      TOLERANCIA,
    );
    expect(e.total, id).toBe(100);
  });

  it.each(
    DIVISOES.flatMap((id) => RECORTES.map((r) => [id, r[0], r[1]] as const)),
  )("%s: cada grupo fecha em 100%% no recorte %s", (id, _rotulo, q) => {
    const e = calcularPainel(id, q);
    expect(e.forma, id).toBe("divisao");
    if (e.forma !== "divisao") return;
    for (const grupo of e.grupos) {
      if (grupo.partes.length === 0) continue;
      const soma = grupo.partes.reduce((a, p) => a + p.valor, 0);
      expect(
        Math.abs(soma - 100),
        `${id} · ${grupo.nome}: somou ${String(soma)}`,
      ).toBeLessThan(TOLERANCIA);
    }
  });

  it("o centro da rosca é uma das fatias, e não um número solto", () => {
    // O centro repete um número que já está no anel. Se ele viesse de outra
    // conta, a tela mostraria dois valores para a mesma fatia.
    for (const id of ROSCAS) {
      const e = calcularPainel(id, BASE);
      if (e.forma !== "rosca" || e.centro.valor === null) continue;
      const valores = e.fatias.map((f) => Math.round(f.valor * 1000));
      expect(valores, `${id}: centro ${String(e.centro.valor)}`).toContain(
        Math.round(e.centro.valor * 1000),
      );
    }
  });
});

/* ------------------------------------------------------------------ *
 * O funil
 * ------------------------------------------------------------------ */

describe("o funil de recrutamento", () => {
  it("cada passo é menor que o anterior — é isso que faz dele um funil", () => {
    const e = calcularPainel("rec-funil", BASE);
    expect(e.forma).toBe("funil");
    if (e.forma !== "funil") return;
    expect(e.passos).toHaveLength(5);
    for (let i = 1; i < e.passos.length; i += 1) {
      const antes = e.passos[i - 1]?.valor ?? 0;
      const agora = e.passos[i]?.valor ?? 0;
      expect(
        agora,
        `${e.passos[i]?.nome ?? ""} contra o passo anterior`,
      ).toBeLessThan(antes);
    }
  });

  it("o total é o topo, e não a soma dos passos", () => {
    // Somar candidatura com contratação contaria a mesma pessoa cinco vezes.
    const e = calcularPainel("rec-funil", BASE);
    if (e.forma !== "funil") return;
    expect(e.total).toBe(e.passos[0]?.valor);
  });
});
