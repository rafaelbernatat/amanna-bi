/**
 * `getPanel` para as quatro formas compostas — os 6 de T-119.
 *
 * E o fecho da conta: com T-117, T-118 e T-119, os **71** painéis do Anexo A.1
 * respondem. É este arquivo que faz "existe painel que ninguém sabe alimentar?"
 * deixar de ser uma pergunta sobre parte do produto e passar a ser sobre o
 * produto inteiro.
 */

import Ajv from "ajv";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { calcularPainel, paineisComDesenho } from "@/acesso/fixtures/paineis";
import { UFS_DO_MOSAICO } from "@/acesso/fixtures/paineis-compostos";
import { PONTE_DA_DRE } from "@/acesso/fixtures/referencia-fin";
import type { Query } from "@/semantica/contrato";
import { FORMAS_COMPOSTAS, origemDoPainel } from "@/semantica/origem-de-painel";
import { REGISTRO_DE_PAINEIS } from "@/semantica/paineis";

const BASE: Query = {
  entidade: "consolidado",
  area: "todas",
  modalidade: "todas",
  periodo: "12-meses",
  ano: "2026",
};

/**
 * Estreita o envelope à forma esperada, falando quando não é.
 *
 * A primeira versão destes testes escrevia `if (e.forma !== "cascata") return;`
 * — e um `return` mudo faz o caso passar justamente quando o painel devolve a
 * forma errada, que é o defeito mais grave possível aqui. O guarda abaixo falha
 * com uma frase.
 */
function daForma<F extends string>(
  id: string,
  q: Query,
  forma: F,
): Extract<ReturnType<typeof calcularPainel>, { forma: F }> {
  const envelope = calcularPainel(id, q);
  if (envelope.forma !== forma) {
    throw new Error(
      `${id} devolveu forma '${envelope.forma}' onde o teste espera '${forma}'`,
    );
  }
  return envelope as Extract<ReturnType<typeof calcularPainel>, { forma: F }>;
}

const COMPOSTOS = REGISTRO_DE_PAINEIS.filter((p) =>
  FORMAS_COMPOSTAS.some((f) => f === p.forma),
);
const IDS = COMPOSTOS.map((p) => p.id);

/** Reais de tolerância na cascata: a ponte é montada em milhões. */
const SEM_RESIDUO = 0.0001;

/* ------------------------------------------------------------------ *
 * A cobertura fecha em 71
 * ------------------------------------------------------------------ */

describe("os três lotes de getPanel cobrem exatamente os 71 painéis", () => {
  it("são seis painéis nas quatro formas compostas", () => {
    expect(COMPOSTOS).toHaveLength(6);
  });

  it("os 71 do registro sabem se desenhar, sem sobra e sem falta", () => {
    /*
     * Os dois sentidos, e é o segundo que costuma faltar.
     *
     * "Todo painel desenha" pega o painel esquecido. "Todo desenho é de um
     * painel" pega o contrário: um id que sobrou de uma renomeação e continua
     * no mapa, desenhando algo que a tela não pede mais.
     */
    const doRegistro = REGISTRO_DE_PAINEIS.map((p) => p.id);
    const sabem = paineisComDesenho();

    expect(doRegistro).toHaveLength(71);
    expect([...sabem].sort()).toEqual([...doRegistro].sort());
  });

  it("nenhum painel desenha duas vezes, por dois lotes diferentes", () => {
    // Um id em dois mapas seria desenhado pelo primeiro que o despacho
    // encontrasse, e o outro desenho ficaria morto sem ninguém notar.
    const sabem = paineisComDesenho();
    expect(new Set(sabem).size).toBe(sabem.length);
  });

  it("todo painel do registro tem origem declarada", () => {
    const sem = REGISTRO_DE_PAINEIS.filter(
      (p) => origemDoPainel(p.id) === undefined,
    ).map((p) => p.id);
    expect(sem).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * O envelope
 * ------------------------------------------------------------------ */

describe("as quatro formas compostas respondem com envelope válido", () => {
  const schema: Record<string, unknown> = JSON.parse(
    readFileSync("contratos/painel.schema.json", "utf8"),
  ) as Record<string, unknown>;
  const validar = new Ajv({ allErrors: true, strict: false }).compile(schema);

  it.each(IDS)("%s valida contra o JSON Schema publicado", (id) => {
    const envelope = calcularPainel(id, BASE);
    const ok = validar(envelope);
    expect(ok, JSON.stringify(validar.errors?.slice(0, 3))).toBe(true);
  });

  it.each(IDS)("%s valida também sob recorte de unidade e de área", (id) => {
    for (const q of [
      { ...BASE, entidade: "unidade-sp" } as Query,
      { ...BASE, area: "tecnologia" } as Query,
      { ...BASE, periodo: "dezembro" } as Query,
    ]) {
      const ok = validar(calcularPainel(id, q));
      expect(ok, `${id}: ${JSON.stringify(validar.errors?.slice(0, 2))}`).toBe(
        true,
      );
    }
  });
});

/* ------------------------------------------------------------------ *
 * A cascata fecha
 * ------------------------------------------------------------------ */

describe("a cascata fecha sem resíduo", () => {
  it("a ponte da DRE vai da receita líquida ao lucro líquido", () => {
    const e = daForma("fin-dre", BASE, "cascata");

    const nomes = e.passos.map((p) => p.nome);
    expect(nomes[0]).toBe("Receita líquida");
    expect(nomes.at(-1)).toBe("Lucro líquido");
    expect(nomes).toContain("EBITDA");

    /*
     * O que "sem resíduo" quer dizer, verificado degrau a degrau.
     *
     * Cada total tem de ser a soma corrente do que veio antes dele. Conferir só
     * o último esconderia uma ponte que erra no meio e acerta no fim por
     * compensação — e é justamente no meio que está a leitura: o EBITDA de 200
     * consumido por D&A e juros até virar prejuízo.
     */
    let corrente = 0;
    e.passos.forEach((passo, i) => {
      if (i === 0) {
        corrente = passo.valor;
        return;
      }
      if (passo.ehTotal) {
        expect(
          Math.abs(passo.valor - corrente),
          `${passo.nome}: ${String(passo.valor)} contra ${String(corrente)}`,
        ).toBeLessThan(SEM_RESIDUO);
        return;
      }
      corrente += passo.valor;
    });

    expect(e.total).toBe(e.passos.at(-1)?.valor);
  });

  it("os degraus são os da ponte declarada, e não quaisquer degraus", () => {
    /*
     * Fechar não basta. Uma ponte com D&A zerado continua fechando — some um
     * degrau, o lucro sobe, e a soma bate. O que ela deixa de fazer é
     * descrever a empresa: o EBITDA de 200 consumido por depreciação e juros é
     * a leitura inteira deste painel.
     *
     * Por isso cada degrau é conferido contra a ponte declarada em
     * `PONTE_DA_DRE`, e não só contra os vizinhos.
     */
    const e = daForma("fin-dre", BASE, "cascata");
    const degrau = (nome: string) =>
      Math.abs(e.passos.find((p) => p.nome === nome)?.valor ?? 0);

    expect(degrau("Receita líquida")).toBeCloseTo(
      PONTE_DA_DRE.receitaLiquida,
      6,
    );
    expect(degrau("CMV")).toBeCloseTo(PONTE_DA_DRE.cmv, 6);
    expect(degrau("Despesas operacionais")).toBeCloseTo(
      PONTE_DA_DRE.despesasOperacionais,
      6,
    );
    expect(degrau("EBITDA")).toBeCloseTo(PONTE_DA_DRE.ebitda, 6);
    expect(degrau("D&A")).toBeCloseTo(PONTE_DA_DRE.depreciacaoEAmortizacao, 6);
    expect(degrau("Resultado financeiro")).toBeCloseTo(
      PONTE_DA_DRE.resultadoFinanceiro,
      6,
    );
    expect(degrau("Lucro líquido")).toBeCloseTo(
      Math.abs(PONTE_DA_DRE.lucroLiquido),
      6,
    );
  });

  it("os degraus que consomem receita entram negativos", () => {
    // Sem sinal, a cascata desenharia CMV subindo — e a leitura seria a
    // oposta da verdadeira.
    const e = daForma("fin-dre", BASE, "cascata");
    const cmv = e.passos.find((p) => p.nome === "CMV");
    expect(cmv?.valor ?? 0).toBeLessThan(0);
  });

  it("a ponte do caixa vai do saldo inicial ao saldo final", () => {
    const e = daForma("cx-ponte", BASE, "cascata");
    expect(e.passos[0]?.nome).toBe("Saldo inicial");
    expect(e.passos.at(-1)?.nome).toBe("Saldo final");

    const inicio = e.passos[0]?.valor ?? 0;
    const movimento = e.passos
      .filter((p) => !p.ehTotal)
      .reduce((a, p) => a + p.valor, 0);
    expect(Math.abs(inicio + movimento - (e.total ?? 0))).toBeLessThan(
      SEM_RESIDUO,
    );
  });

  it("o saldo final da ponte é o mesmo saldo que o painel de caixa mostra", () => {
    /*
     * Duas telas, um número. `cx-saldo` desenha a série do saldo e `cx-ponte`
     * explica como se chegou nele; se divergirem, quem olhar as duas na mesma
     * tela não tem como saber qual seguir.
     */
    const ponte = daForma("cx-ponte", BASE, "cascata");
    const serie = daForma("cx-saldo", BASE, "linha");
    expect(ponte.total).toBeCloseTo(serie.total ?? 0, 6);
  });
});

/* ------------------------------------------------------------------ *
 * A régua devolve os quatro
 * ------------------------------------------------------------------ */

describe("a régua de ciclo devolve PMR, PME, PMP e o ciclo", () => {
  it("os três prazos aparecem, cada um como uma faixa nomeada", () => {
    const e = daForma("ct-ciclo", BASE, "regua-de-ciclo");

    const rotulos = e.faixas.map((f) => f.rotulo).join(" · ");
    expect(rotulos).toContain("PMP");
    expect(rotulos).toContain("PME");
    expect(rotulos).toContain("PMR");
    expect(rotulos).toContain("Ciclo");
  });

  it("o ciclo é a distância entre pagar e receber, e fecha na fórmula", () => {
    const e = daForma("ct-ciclo", BASE, "regua-de-ciclo");

    const faixa = (parte: string) =>
      e.faixas.find((f) => f.rotulo.includes(parte));
    const pmp = faixa("PMP");
    const pme = faixa("PME");
    const pmr = faixa("PMR");
    const ciclo = faixa("Ciclo");

    const dias = (f: { de: number; ate: number } | undefined) =>
      f === undefined ? 0 : f.ate - f.de;

    /*
     * Duas maneiras de chegar ao mesmo número, e elas têm de concordar.
     *
     * Geometricamente, o ciclo é o vão entre o dia do pagamento e o dia do
     * recebimento. Aritmeticamente, é PMR + PME − PMP. Se a régua fosse
     * desenhada a partir da fórmula e o total lido de outro lugar, os dois
     * poderiam divergir sem que nada avisasse — e um gráfico que discorda de
     * si mesmo é pior que um gráfico ausente.
     */
    expect(dias(ciclo)).toBeCloseTo(dias(pmr) + dias(pme) - dias(pmp), 6);
    expect(e.total).toBeCloseTo(dias(ciclo), 6);

    /*
     * E a faixa do ciclo tem de estar ANCORADA nos marcos.
     *
     * A comparação de cima passava com a faixa desenhada de 0 até o valor da
     * fórmula — mesmo tamanho, lugar errado: o desenho mostraria o ciclo
     * começando na compra, e não no pagamento ao fornecedor. A régua estaria
     * dizendo uma coisa e o número, outra.
     */
    const marco = (parte: string) =>
      e.marcos.find((m) => m.rotulo.includes(parte))?.dia;
    expect(ciclo?.de).toBeCloseTo(marco("PMP") ?? -1, 6);
    expect(ciclo?.ate).toBeCloseTo(marco("PMR") ?? -1, 6);
  });

  it("os marcos estão em ordem no tempo", () => {
    const e = daForma("ct-ciclo", BASE, "regua-de-ciclo");
    const dias = e.marcos.map((m) => m.dia);
    expect([...dias].sort((a, b) => a - b)).toEqual(dias);
    expect(e.marcos[0]?.dia).toBe(0);
  });

  it("toda faixa declara se crescer é bom ou ruim", () => {
    // Prazo de fornecedor maior é caixa no bolso; ciclo maior é capital de
    // giro preso. Sem o sentido, a apresentação pintaria os dois da mesma cor.
    const e = daForma("ct-ciclo", BASE, "regua-de-ciclo");
    const sentidos = new Set(e.faixas.map((f) => f.sentido));
    expect(sentidos.size).toBeGreaterThan(1);
    expect(e.faixas.find((f) => f.rotulo.includes("fornecedor"))?.sentido).toBe(
      "maior_melhor",
    );
    expect(e.faixas.find((f) => f.rotulo.includes("Ciclo"))?.sentido).toBe(
      "menor_melhor",
    );
  });
});

/* ------------------------------------------------------------------ *
 * Dispersão e mosaico
 * ------------------------------------------------------------------ */

describe("a dispersão", () => {
  it("fat-margem tem um ponto por cliente, com os dois eixos declarados", () => {
    const e = daForma("fat-margem", BASE, "dispersao");
    expect(e.pontos).toHaveLength(10);
    expect(e.eixoX.unidade).toBe("BRL_mi");
    expect(e.eixoY.unidade).toBe("pct");
    for (const p of e.pontos) {
      expect(p.rotulo.length).toBeGreaterThan(0);
      expect(p.y).toBeGreaterThan(0);
    }
  });

  it("int-scatter tem um ponto por área, e uma sob recorte de área", () => {
    expect(daForma("int-scatter", BASE, "dispersao").pontos).toHaveLength(7);

    const daArea = daForma(
      "int-scatter",
      { ...BASE, area: "tecnologia" },
      "dispersao",
    );
    expect(daArea.pontos).toHaveLength(1);
    expect(daArea.pontos[0]?.rotulo).toBe("tecnologia");
  });

  it("o tamanho do ponto é grandeza, e não raio em pixels", () => {
    /*
     * O protótipo calcula `4 + receita / 22` — geometria de desenho dentro do
     * dado. Aqui o envelope entrega a grandeza e a apresentação decide o raio:
     * regra 2 da seção 9.2. Trocar a escala do desenho deixa de exigir tocar
     * no número.
     */
    const e = daForma("fat-margem", BASE, "dispersao");
    const maior = e.pontos.reduce((a, p) => (p.x > a.x ? p : a));
    expect(maior.tamanho).toBe(maior.x);
  });
});

describe("o mosaico geográfico", () => {
  it("tem uma célula por UF do cadastro, e soma o quadro", () => {
    const e = daForma("col-mapa", BASE, "mosaico-geografico");
    expect(e.celulas.map((c) => c.uf)).toEqual([...UFS_DO_MOSAICO]);
    expect(e.total).toBe(1240);
  });

  it("zero é medida, e aparece sob recorte estreito", () => {
    /*
     * A primeira versão deste caso afirmava que UF sem quadro vinha **nula**, e
     * passava sem provar nada: `vw_fato_rh_perfil` materializa todas as
     * combinações, então nenhuma célula é nula em recorte nenhum, e a provocação
     * que trocava o nulo por zero não derrubava o teste.
     *
     * O que o dado de fato faz é produzir **zero** — que é medida, e não
     * ausência: sabe-se que não há ninguém daquela área naquele estado. É isso
     * que se afirma agora, e a contagem torna a afirmação verificável.
     */
    const estreito = daForma(
      "col-mapa",
      { ...BASE, area: "marketing", modalidade: "remoto" },
      "mosaico-geografico",
    );
    const zeradas = estreito.celulas.filter((c) => c.valor === 0);
    expect(zeradas.length).toBeGreaterThan(0);
    expect(estreito.celulas.every((c) => c.valor !== null)).toBe(true);

    /*
     * E nenhuma célula é negativa, em recorte nenhum.
     *
     * Parece óbvio — quadro não é negativo —, e é justamente por isso que
     * precisa estar escrito: um valor de sentinela posto no lugar da ausência
     * (o clássico `?? -1`) passaria por todas as checagens acima e pintaria o
     * mapa com um estado impossível.
     */
    for (const q of [BASE, { ...BASE, area: "marketing" } as Query]) {
      const e = daForma("col-mapa", q, "mosaico-geografico");
      for (const celula of e.celulas) {
        expect(celula.valor === null || celula.valor >= 0, celula.uf).toBe(
          true,
        );
      }
    }
  });

  it("e o total do mosaico é a soma do que ele desenha", () => {
    // Se o total viesse de outro lugar, o mapa poderia somar 1.100 enquanto o
    // número do canto diz 1.240, e não haveria como saber qual está certo.
    for (const q of [
      BASE,
      { ...BASE, area: "tecnologia" } as Query,
      { ...BASE, entidade: "unidade-sp" } as Query,
    ]) {
      const e = daForma("col-mapa", q, "mosaico-geografico");
      const soma = e.celulas.reduce((a, c) => a + (c.valor ?? 0), 0);
      expect(e.total, JSON.stringify(q)).toBe(soma);
    }
  });

  it("o mosaico responde ao recorte de área", () => {
    const todas = calcularPainel("col-mapa", BASE);
    const tec = calcularPainel("col-mapa", { ...BASE, area: "tecnologia" });
    expect(JSON.stringify(todas)).not.toBe(JSON.stringify(tec));
  });
});
