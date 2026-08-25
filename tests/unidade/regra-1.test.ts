/**
 * A regra 1: reconciliação entre KPI e painel (T-122).
 *
 * O aceite pede duas coisas:
 *
 * 1. a suíte compara o painel e o KPI nos **768 recortes** para cada par
 *    mapeado, e falha em delta acima da tolerância;
 * 2. sob recorte de uma única área, o painel quebrado por área devolve
 *    **exatamente uma** categoria, e nunca a lista inteira.
 *
 * A segunda é a que pega o achado 4 do Anexo D — um painel que ignora o filtro
 * mostra o total certo e o gráfico errado, e nenhuma comparação de número o
 * pegaria.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  conferirQuebraPorArea,
  paresConferidos,
  REGRA_1,
} from "@/acesso/contrato/regra-1";
import {
  RECONCILIACAO,
  reconciliacaoDe,
  valorDoPainel,
} from "@/acesso/contrato/reconciliacao";
import { consultaDe, type Falha } from "@/acesso/contrato/suite";
import { calcularPainel } from "@/acesso/fixtures/paineis";
import { dimensoesProvisorias } from "@/acesso/dimensoes-provisorias";
import { podeSomar } from "@/semantica/agregacao";
import type { DataSource } from "@/semantica/contrato";
import { REGISTRO_DE_KPIS } from "@/semantica/kpis";
import { origemDoPainel } from "@/semantica/origem-de-painel";
import { REGISTRO_DE_PAINEIS } from "@/semantica/paineis";
import { matrizDeRecortes, type Recorte } from "@/semantica/recortes";

/** A regra não usa a fonte: lê pelas funções da fixture, como o produto. */
const FONTE = {} as unknown as DataSource;

const MATRIZ = matrizDeRecortes(dimensoesProvisorias());
const ANO = dimensoesProvisorias().ano?.[0] ?? "2026";

async function rodarEm(recorte: Recorte): Promise<readonly Falha[]> {
  return REGRA_1.rodar({
    fonte: FONTE,
    recorte,
    consulta: consultaDe(recorte, ANO),
  });
}

/* ------------------------------------------------------------------ *
 * A declaração cobre todos os pares
 * ------------------------------------------------------------------ */

describe("todo par mapeado tem forma de reconciliação declarada", () => {
  const MAPEADOS = REGISTRO_DE_KPIS.filter((k) => k.detalhadoPor !== null);

  it("são 60 pares no registro, e 60 declarações", () => {
    expect(MAPEADOS).toHaveLength(60);
    expect(RECONCILIACAO).toHaveLength(60);
  });

  it.each(MAPEADOS.map((k) => [k.id, k.detalhadoPor ?? ""]))(
    "%s → %s está declarado",
    (kpi, painel) => {
      /*
       * A diferença que importa é entre "não comparo porque decidi" e "não
       * comparo porque esqueci". Sem esta checagem, um par novo entraria no
       * registro e a suíte simplesmente não o veria — passando verde por
       * omissão.
       */
      const declarado = reconciliacaoDe(kpi);
      expect(declarado, `${kpi} sem declaração`).toBeDefined();
      expect(declarado?.painel).toBe(painel);
    },
  );

  it("nenhuma declaração aponta para par que não existe", () => {
    const doRegistro = new Set(
      REGISTRO_DE_KPIS.filter((k) => k.detalhadoPor !== null).map((k) => k.id),
    );
    const orfas = RECONCILIACAO.filter((p) => !doRegistro.has(p.kpi));
    expect(orfas.map((p) => p.kpi)).toEqual([]);
  });

  it("todo par que não reconcilia diz por quê, e não em uma palavra", () => {
    /*
     * "Não reconcilia" sem motivo é indistinguível de defeito escondido. A
     * exigência de tamanho existe porque um `porque: "n/a"` passaria numa
     * checagem de presença e não explicaria nada a quem lê daqui a um ano.
     */
    const MINIMO = 40;
    const fracas = RECONCILIACAO.filter(
      (p) =>
        p.forma.tipo === "nao_reconcilia" &&
        p.forma.porque.trim().length < MINIMO,
    ).map((p) => p.kpi);
    expect(fracas).toEqual([]);
  });

  it("treze não reconciliam, e o resto é comparado", () => {
    // A conta fixada: se um par deixar de ser comparado, alguém precisa
    // mexer aqui — e explicar por quê no diff.
    const naoReconciliam = RECONCILIACAO.filter(
      (p) => p.forma.tipo === "nao_reconcilia",
    );
    expect(naoReconciliam).toHaveLength(13);
    expect(paresConferidos()).toBe(47);
  });

  it("nenhuma declaração soma uma unidade que não se soma", () => {
    /*
     * A regra 4 do contrato proíbe somar taxa ao longo do período, e uma suíte
     * que o fizesse contradiria o contrato que ela defende.
     *
     * O caso não é hipotético: um classificador automático casou
     * `rh-visao-turnover-12m` com a soma de doze taxas mensais, que por
     * construção se aproxima da taxa de doze meses. Passaria hoje e verificaria
     * a coisa errada para sempre.
     */
    const somandoTaxa = RECONCILIACAO.filter((p) => {
      if (p.forma.tipo !== "soma_da_serie") return false;
      const kpi = REGISTRO_DE_KPIS.find((k) => k.id === p.kpi);
      return kpi?.unidade != null && !podeSomar(kpi.unidade);
    }).map((p) => p.kpi);
    expect(somandoTaxa).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * 1. A comparação nos 768 recortes
 * ------------------------------------------------------------------ */

describe("a reconciliação fecha nos 768 recortes", () => {
  it("a matriz tem 768, sem amostragem", () => {
    expect(MATRIZ).toHaveLength(768);
  });

  it("nenhuma divergência em recorte nenhum", async () => {
    /*
     * O teste que a tarefa existe para produzir.
     *
     * Ele já pagou: rodando pela primeira vez acusou 515 divergências em
     * `tov-custo`, e a causa era o cartão e o painel lendo **fontes
     * diferentes** para a mesma medida — o cartão em duas colunas de
     * `vw_fato_rh_mes` que a seção 10.1 nem declara, o painel na view que
     * T-118.1 publicou. O cartão reagia a modalidade e o painel não.
     *
     * Divergência assim não aparece no consolidado: aparece quando alguém
     * filtra, que é justamente quando ninguém está olhando os dois números
     * lado a lado.
     */
    const falhas: Falha[] = [];
    for (const recorte of MATRIZ) {
      falhas.push(...(await rodarEm(recorte)));
    }

    const amostra = falhas
      .slice(0, 5)
      .map(
        (f) =>
          `${f.assunto}: esperado ${String(f.esperado)}, obtido ${String(f.obtido)}`,
      );
    expect(falhas.length, amostra.join(" | ")).toBe(0);
  });

  it("cada recorte compara os 47 pares", async () => {
    // Zero falhas com zero comparações seria verde sem conteúdo. Aqui a
    // contagem prova que a passagem verificou algo.
    const primeiro = MATRIZ[0];
    expect(primeiro).toBeDefined();
    expect(paresConferidos()).toBe(47);
    if (primeiro !== undefined) expect(await rodarEm(primeiro)).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * 2. Sob recorte de uma área, uma categoria
 * ------------------------------------------------------------------ */

describe("sob recorte de uma área, o painel mostra só aquela área", () => {
  const QUEBRADOS_POR_AREA = REGISTRO_DE_PAINEIS.filter(
    (p) => origemDoPainel(p.id)?.eixo === "area",
  ).map((p) => p.id);

  it("há painéis quebrados por área para conferir", () => {
    expect(QUEBRADOS_POR_AREA.length).toBeGreaterThan(5);
  });

  it.each(QUEBRADOS_POR_AREA)(
    "%s devolve uma categoria, e é a pedida",
    (id) => {
      /*
       * O achado 4 do Anexo D: no protótipo, filtrar por área mudava a escala das
       * barras e mantinha as sete. O gráfico parecia responder ao filtro e não
       * respondia — pior que não filtrar, porque parece certo.
       */
      for (const area of ["tecnologia", "operacoes", "rh"]) {
        const envelope = calcularPainel(id, {
          entidade: "consolidado",
          area,
          modalidade: "todas",
          periodo: "12-meses",
          ano: "2026",
        } as Parameters<typeof calcularPainel>[1]);
        expect("categories" in envelope, id).toBe(true);
        if (!("categories" in envelope)) continue;
        expect(envelope.categories, `${id} sob ${area}`).toEqual([area]);
      }
    },
  );

  it("a regra ACUSA um painel que ignora o filtro de área", () => {
    /*
     * A guarda que faltava, e o defeito que ela pegou.
     *
     * Os casos acima conferem a propriedade nos painéis. Uma provocação que
     * apagava a checagem de dentro da regra não derrubava nenhum deles: a
     * propriedade continuava verdadeira, e a regra simplesmente não a cobrava
     * mais. É o pior tipo de falso verde — o teste certo sobre o objeto errado.
     *
     * Aqui o painel é forjado para devolver as sete áreas sob recorte de uma, e
     * o que se exige é que a REGRA reclame.
     */
    const forjado = (id: string) =>
      ({
        id,
        title: id,
        unit: "FTE",
        formula: "forjada",
        total: 0,
        note: null,
        asOf: "2026-12-31",
        forma: "barras-horizontais",
        categories: [
          "operacoes",
          "comercial",
          "tecnologia",
          "logistica",
          "financeiro",
          "marketing",
          "rh",
        ],
        series: [],
      }) as unknown as ReturnType<typeof calcularPainel>;

    const recorte = {
      periodo: "12-meses",
      ano: "2026",
      entidade: "consolidado",
      area: "tecnologia",
      modalidade: "todas",
    };
    const falhas = conferirQuebraPorArea(
      { fonte: FONTE, recorte, consulta: consultaDe(recorte, ANO) },
      forjado,
    );

    expect(falhas.length).toBeGreaterThan(0);
    expect(falhas[0]?.mensagem).toContain("7 categorias");
    expect(falhas[0]?.regra).toBe(1);
  });

  it("e a regra CHAMA essa checagem — não basta ela existir", () => {
    /*
     * A guarda de fonte, e por que ela é a única possível aqui.
     *
     * O caso acima prova que `conferirQuebraPorArea` funciona. Não prova que
     * `REGRA_1` a chama: apagar a chamada de dentro de `rodar` deixa o helper
     * intacto, os painéis continuam corretos, e nenhum teste de comportamento
     * percebe — a regra simplesmente para de cobrar, em silêncio.
     *
     * Um teste de comportamento exigiria injetar um painel quebrado através da
     * regra inteira, o que mudaria a interface de `Regra` para acomodar um
     * teste. Ler a fonte custa menos e diz a mesma coisa: se a chamada sumir
     * do corpo de `rodar`, isto reprova.
     */
    const fonte = readFileSync("src/acesso/contrato/regra-1.ts", "utf8");
    const corpoDoRodar = fonte.slice(fonte.indexOf("export const REGRA_1"));
    expect(corpoDoRodar).toContain("conferirQuebraPorArea(ctx)");
  });

  it("e não acusa nada no consolidado, onde as sete são o certo", () => {
    const recorte = {
      periodo: "12-meses",
      ano: "2026",
      entidade: "consolidado",
      area: "todas",
      modalidade: "todas",
    };
    expect(
      conferirQuebraPorArea({
        fonte: FONTE,
        recorte,
        consulta: consultaDe(recorte, ANO),
      }),
    ).toEqual([]);
  });

  it("no consolidado, os mesmos painéis mostram as sete", () => {
    // O contraste: sem ele, um painel que devolvesse sempre uma categoria
    // passaria no caso de cima e estaria igualmente quebrado.
    for (const id of QUEBRADOS_POR_AREA) {
      const envelope = calcularPainel(id, {
        entidade: "consolidado",
        area: "todas",
        modalidade: "todas",
        periodo: "12-meses",
        ano: "2026",
      } as Parameters<typeof calcularPainel>[1]);
      if (!("categories" in envelope)) continue;
      expect(envelope.categories.length, id).toBe(7);
    }
  });
});

/* ------------------------------------------------------------------ *
 * A leitura do envelope: vazio não é declaração errada
 * ------------------------------------------------------------------ */

describe("carga vazia é ausência de dado, não forma errada", () => {
  const RECORTE_SEM_DADO = {
    entidade: "consolidado",
    area: "todas",
    modalidade: "todas",
    periodo: "12-meses",
    ano: "2025",
  } as Parameters<typeof calcularPainel>[1];

  it("a régua sem faixas devolve nulo, e não 'forma inexistente'", () => {
    /*
     * A distinção custou 3.456 falsos vermelhos na primeira execução.
     *
     * Sob os 384 recortes do ano sem dado, a régua devolve zero faixas, a
     * cascata zero degraus e a divisão zero partes. A primeira versão lia isso
     * como declaração errada e acusava nove pares corretos. Carga vazia é
     * ausência; carga cheia sem o alvo declarado é que é erro de declaração.
     */
    const envelope = calcularPainel("ct-ciclo", RECORTE_SEM_DADO);
    const valor = valorDoPainel(
      envelope,
      { tipo: "largura_da_faixa", faixa: "Recebimento (PMR)" },
      "dias",
    );
    expect(valor).toBeNull();
  });

  it("mas faixa inexistente numa régua cheia continua sendo erro", () => {
    const envelope = calcularPainel("ct-ciclo", {
      ...RECORTE_SEM_DADO,
      ano: "2026",
    });
    const valor = valorDoPainel(
      envelope,
      { tipo: "largura_da_faixa", faixa: "Faixa que não existe" },
      "dias",
    );
    expect(valor).toBeUndefined();
  });

  it("o mosaico sem dado não conta zero estados", () => {
    // Zero afirmaria que a empresa não opera em lugar nenhum; o que se sabe é
    // que não há dado neste recorte.
    const envelope = calcularPainel("col-mapa", RECORTE_SEM_DADO);
    const valor = valorDoPainel(
      envelope,
      { tipo: "contagem_de_celulas_com_dado" },
      "contagem",
    );
    expect(valor).toBeNull();
  });

  it("somar série de unidade não somável é recusado na leitura", () => {
    // O cinto da declaração: mesmo que alguém escreva `soma_da_serie` numa
    // taxa, a leitura devolve `undefined` e o relatório aponta a declaração.
    const envelope = calcularPainel("fin-margens", {
      ...RECORTE_SEM_DADO,
      ano: "2026",
    });
    const valor = valorDoPainel(
      envelope,
      { tipo: "soma_da_serie", serie: "Bruta" },
      "pct",
    );
    expect(valor).toBeUndefined();
  });
});
