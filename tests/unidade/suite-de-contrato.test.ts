/**
 * O arnês da suíte de contrato (T-121).
 *
 * O aceite pede quatro coisas, e três delas são sobre **não se enganar**:
 *
 * 1. o comando roda em `--source=fixtures` e `--source=warehouse` sobre o mesmo
 *    arquivo de casos;
 * 2. um arquivo versionado enumera as 768 combinações, marcando exaustivas e
 *    amostradas;
 * 3. a tolerância por unidade está fixada em código;
 * 4. o relatório identifica painel × recorte × regra em cada falha.
 *
 * As regras em si não estão aqui — chegam com T-122 e T-159. O que este arquivo
 * verifica é o arnês: que ele roda, que recusa rodar vazio, e que o relatório
 * diz onde doeu.
 */

import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse } from "yaml";

import {
  conferirIgual,
  consultaDe,
  type Falha,
  limparRegras,
  recorteEmTexto,
  registrarRegra,
  regrasRegistradas,
  relatorioEmTexto,
  rodarSuite,
  SuiteSemRegra,
} from "@/acesso/contrato/suite";
import { dimensoesProvisorias } from "@/acesso/dimensoes-provisorias";
import { UNIDADES, type DataSource, type Unidade } from "@/semantica/contrato";
import { contarRecortes, matrizDeRecortes } from "@/semantica/recortes";
import {
  dentroDaTolerancia,
  TOLERANCIA,
  unidadesComTolerancia,
} from "@/semantica/tolerancia";

/** As casas decimais que a apresentação usa. Ver o teste que as compara. */
const CASAS_EXIBIDAS: Readonly<Record<Unidade, number>> = {
  BRL_mi: 1,
  pct: 1,
  pp: 1,
  dias: 0,
  FTE: 0,
  horas: 1,
  contagem: 0,
  pontos: 0,
  anos: 1,
};

const MATRIZ_YAML = "tests/contrato/matriz-recortes.yaml";

type LinhaDaMatriz = {
  readonly periodo: string;
  readonly ano?: string;
  readonly entidade: string;
  readonly area: string;
  readonly modalidade: string;
  readonly cobertura: string;
};

type ArquivoDaMatriz = {
  readonly total: number;
  readonly exaustivas: number;
  readonly amostradas: number;
  readonly amostragem: readonly unknown[];
  readonly recortes: readonly LinhaDaMatriz[];
};

const arquivo = parse(readFileSync(MATRIZ_YAML, "utf8")) as ArquivoDaMatriz;

/* ------------------------------------------------------------------ *
 * 2. A matriz versionada
 * ------------------------------------------------------------------ */

describe("a matriz versionada enumera as 768", () => {
  it("tem 768 combinações, e a contagem bate com a contada do código", () => {
    /*
     * O defeito que T-004 corrigiu: 768 era constante literal nos critérios de
     * aceite. Aqui as três contagens têm de concordar — a do arquivo, a do
     * campo `total` dentro dele, e a que o código calcula das dimensões.
     */
    const dasDimensoes = contarRecortes(dimensoesProvisorias());
    expect(arquivo.recortes).toHaveLength(768);
    expect(arquivo.total).toBe(768);
    expect(dasDimensoes).toBe(768);
  });

  it("cada combinação declara a cobertura", () => {
    const semCobertura = arquivo.recortes.filter(
      (r) => r.cobertura !== "exaustiva" && r.cobertura !== "amostrada",
    );
    expect(semCobertura).toEqual([]);
  });

  it("nada está amostrado, e a seção de justificativa está vazia", () => {
    /*
     * Não é preguiça de amostrar: amostragem exige justificativa com
     * responsável e data, e o item H-05 — que aprova a matriz — está aberto.
     *
     * Quando ele fechar, este caso muda junto com o arquivo, e é isso que o
     * torna útil: encolher a cobertura passa a exigir mexer aqui, o que aparece
     * no diff para quem assinou.
     */
    const amostradas = arquivo.recortes.filter(
      (r) => r.cobertura === "amostrada",
    );
    expect(amostradas).toEqual([]);
    expect(arquivo.amostradas).toBe(0);
    expect(arquivo.exaustivas).toBe(arquivo.total);
    expect(arquivo.amostragem).toEqual([]);
  });

  it("o arquivo e a função geram exatamente as mesmas combinações", () => {
    /*
     * O comando roda a partir do ARQUIVO, e não da função — o arquivo é o que
     * alguém assina. Este caso é o que impede os dois de divergirem: sem ele,
     * a assinatura descreveria uma cobertura e a execução usaria outra.
     */
    const doCodigo = matrizDeRecortes(dimensoesProvisorias()).map((r) =>
      recorteEmTexto(r),
    );
    const doArquivo = arquivo.recortes.map((r) =>
      recorteEmTexto({
        periodo: r.periodo,
        ...(r.ano === undefined ? {} : { ano: r.ano }),
        entidade: r.entidade,
        area: r.area,
        modalidade: r.modalidade,
      }),
    );
    expect(doArquivo).toEqual(doCodigo);
  });
});

/* ------------------------------------------------------------------ *
 * 3. A tolerância
 * ------------------------------------------------------------------ */

describe("a tolerância por unidade está fixada em código", () => {
  it("cobre as nove unidades, sem sobra e sem falta", () => {
    expect([...unidadesComTolerancia()].sort()).toEqual([...UNIDADES].sort());
    expect(Object.keys(TOLERANCIA).sort()).toEqual([...UNIDADES].sort());
  });

  it.each(UNIDADES)(
    "%s tolera no máximo meio dígito do que a tela mostra",
    (unidade) => {
      /*
       * O critério, verificado em vez de prometido.
       *
       * A tolerância existe para deixar passar o que **não aparece** na tela.
       * Se ela fosse maior que meio dígito exibido, deixaria passar divergência
       * visível — um lado escrevendo 12,4 e o outro 12,5 — que é exatamente o
       * caso que faz alguém perguntar qual está certo numa reunião.
       *
       * As casas decimais moram na apresentação e a tolerância na semântica; as
       * duas camadas não se importam, e é aqui, no teste, que elas se encontram.
       */
      const casas = CASAS_EXIBIDAS[unidade];
      const meioDigito = 0.5 * Math.pow(10, -casas);
      expect(TOLERANCIA[unidade]).toBeLessThanOrEqual(meioDigito);
    },
  );

  it("contagem não tolera nada: contar não tem meio-termo", () => {
    expect(TOLERANCIA.contagem).toBe(0);
    expect(dentroDaTolerancia(179, 180, "contagem")).toBe(false);
    expect(dentroDaTolerancia(179, 179, "contagem")).toBe(true);
  });

  it("nulo só é igual a nulo", () => {
    /*
     * "Sem dado neste recorte" e "zero" são estados diferentes (PR-4). Tratá-los
     * como equivalentes aqui apagaria a distinção que a regra 3 existe para
     * proteger — e apagaria em silêncio, dentro da própria suíte que deveria
     * defendê-la.
     */
    expect(dentroDaTolerancia(null, null, "BRL_mi")).toBe(true);
    expect(dentroDaTolerancia(null, 0, "BRL_mi")).toBe(false);
    expect(dentroDaTolerancia(0, null, "BRL_mi")).toBe(false);
  });

  it("aceita o que a tela esconde e reprova o que ela mostra", () => {
    // 12,44 e 12,4 escrevem "12,4" — invisível. 12,46 escreve "12,5".
    expect(dentroDaTolerancia(12.4, 12.44, "BRL_mi")).toBe(true);
    expect(dentroDaTolerancia(12.4, 12.46, "BRL_mi")).toBe(false);
  });
});

/* ------------------------------------------------------------------ *
 * 1 e 4. O arnês roda, e o relatório diz onde doeu
 * ------------------------------------------------------------------ */

/** Uma fonte forjada: o arnês não a chama, porque a regra é forjada também. */
const FONTE_FORJADA = {
  getMeta: () => Promise.reject(new Error("não usado")),
  getKpis: () => Promise.reject(new Error("não usado")),
  getPanel: () => Promise.reject(new Error("não usado")),
  getMetric: () => Promise.reject(new Error("não usado")),
} as unknown as DataSource;

const MATRIZ_CURTA = matrizDeRecortes(dimensoesProvisorias()).slice(0, 3);

describe("o arnês roda a suíte", () => {
  beforeEach(() => {
    limparRegras();
  });
  afterEach(() => {
    limparRegras();
  });

  it("recusa rodar sem regra registrada", async () => {
    /*
     * Zero regras sobre 768 recortes devolve zero falhas, e zero falhas se
     * parece muito com sucesso. Verde que não verificou nada é pior que
     * vermelho, porque ninguém vai investigar.
     */
    await expect(
      rodarSuite(FONTE_FORJADA, "fixtures", MATRIZ_CURTA, "2026"),
    ).rejects.toThrowError(SuiteSemRegra);
  });

  it("roda cada regra em cada recorte, e conta as verificações", async () => {
    let vezes = 0;
    registrarRegra({
      numero: 1,
      nome: "forjada",
      rodar: () => {
        vezes += 1;
        return Promise.resolve([]);
      },
    });

    const r = await rodarSuite(FONTE_FORJADA, "fixtures", MATRIZ_CURTA, "2026");
    expect(vezes).toBe(MATRIZ_CURTA.length);
    expect(r.verificacoes).toBe(MATRIZ_CURTA.length);
    expect(r.falhas).toEqual([]);
    expect(r.recortes).toBe(MATRIZ_CURTA.length);
  });

  it("recusa duas implementações da mesma regra", () => {
    // A segunda nunca rodaria, e uma regra que existe e não roda é pior que
    // uma que não existe: ela dá a impressão de cobertura.
    const forjada = {
      numero: 1,
      nome: "a",
      rodar: () => Promise.resolve([]),
    };
    registrarRegra(forjada);
    expect(() => {
      registrarRegra({ ...forjada, nome: "b" });
    }).toThrowError(/já está registrada/);
  });

  it("as regras rodam na ordem da seção 9.2", () => {
    registrarRegra({ numero: 4, nome: "d", rodar: () => Promise.resolve([]) });
    registrarRegra({ numero: 1, nome: "a", rodar: () => Promise.resolve([]) });
    registrarRegra({ numero: 3, nome: "c", rodar: () => Promise.resolve([]) });
    expect(regrasRegistradas().map((r) => r.numero)).toEqual([1, 3, 4]);
  });

  it("o mesmo arnês roda igual, seja qual for a fonte", async () => {
    /*
     * O RF-21 em forma de teste: **a suíte passa idêntica nos dois modos**.
     *
     * A mesma regra, a mesma matriz e o mesmo arquivo de casos, com a fonte
     * trocada, produzem o mesmo relatório — só o nome da fonte muda. Se o
     * arnês se comportasse diferente por fonte, "idêntica" seria promessa sem
     * como ser cobrada.
     */
    registrarRegra({
      numero: 1,
      nome: "forjada",
      rodar: (ctx) =>
        Promise.resolve(
          ctx.recorte.area === "todas"
            ? []
            : [
                {
                  assunto: "painel-forjado",
                  recorte: ctx.recorte,
                  regra: 1,
                  mensagem: "divergiu",
                },
              ],
        ),
    });

    const comFixtures = await rodarSuite(
      FONTE_FORJADA,
      "fixtures",
      MATRIZ_CURTA,
      "2026",
    );
    const comWarehouse = await rodarSuite(
      FONTE_FORJADA,
      "warehouse",
      MATRIZ_CURTA,
      "2026",
    );

    expect(comWarehouse.falhas).toEqual(comFixtures.falhas);
    expect(comWarehouse.verificacoes).toBe(comFixtures.verificacoes);
    expect(comFixtures.fonte).toBe("fixtures");
    expect(comWarehouse.fonte).toBe("warehouse");
  });
});

describe("o relatório identifica painel × recorte × regra", () => {
  const FALHA: Falha = {
    assunto: "rh-headcount",
    recorte: {
      periodo: "12-meses",
      ano: "2026",
      entidade: "unidade-sp",
      area: "tecnologia",
      modalidade: "remoto",
    },
    regra: 1,
    mensagem: "o KPI e o painel não somam o mesmo total",
    esperado: 1240,
    obtido: 1238,
  };

  it("traz os três campos do aceite na mesma linha", () => {
    /*
     * "A reconciliação falhou" manda quem investiga reproduzir 768 recortes à
     * mão. Com os três campos, a pessoa copia a linha, monta a `Query` e
     * reproduz — a diferença entre um relatório e um aviso.
     */
    const texto = relatorioEmTexto({
      fonte: "fixtures",
      recortes: 768,
      regras: [1],
      falhas: [FALHA],
      verificacoes: 768,
    });

    expect(texto).toContain("rh-headcount");
    expect(texto).toContain("unidade-sp");
    expect(texto).toContain("tecnologia");
    expect(texto).toContain("remoto");
    expect(texto).toContain("12-meses");
    expect(texto).toContain("regra 1");
    expect(texto).toContain("1240");
    expect(texto).toContain("1238");
  });

  it("sem falha, diz que não houve divergência — e não fica mudo", () => {
    const texto = relatorioEmTexto({
      fonte: "fixtures",
      recortes: 768,
      regras: [1],
      falhas: [],
      verificacoes: 768,
    });
    expect(texto).toContain("nenhuma divergência");
    // E diz quantas verificações rodaram: um verde sem número não distingue
    // "conferi 768" de "não conferi nada".
    expect(texto).toContain("768 verificações");
  });
});

/* ------------------------------------------------------------------ *
 * A comparação que as regras usam
 * ------------------------------------------------------------------ */

describe("conferirIgual", () => {
  const RECORTE = {
    periodo: "12-meses",
    ano: "2026",
    entidade: "consolidado",
    area: "todas",
    modalidade: "todas",
  };

  it("cala quando os dois números são o mesmo dentro da tolerância", () => {
    expect(
      conferirIgual(12.4, 12.44, "BRL_mi", {
        assunto: "x",
        recorte: RECORTE,
        regra: 1,
        mensagem: "não deveria aparecer",
      }),
    ).toEqual([]);
  });

  it("devolve a falha com os dois números, quando divergem", () => {
    const falhas = conferirIgual(12.4, 12.9, "BRL_mi", {
      assunto: "x",
      recorte: RECORTE,
      regra: 1,
      mensagem: "divergiu",
    });
    expect(falhas).toHaveLength(1);
    expect(falhas[0]?.esperado).toBe(12.4);
    expect(falhas[0]?.obtido).toBe(12.9);
  });
});

describe("consultaDe", () => {
  it("um recorte da matriz vira a Query que as portas entendem", () => {
    const q = consultaDe(
      {
        periodo: "6-meses",
        ano: "2025",
        entidade: "unidade-sp",
        area: "rh",
        modalidade: "remoto",
      },
      "2026",
    );
    expect(q).toEqual({
      periodo: "6-meses",
      ano: "2025",
      entidade: "unidade-sp",
      area: "rh",
      modalidade: "remoto",
    });
  });

  it("recorte sem ano usa o padrão, e não fica sem ano", () => {
    // A saída *c* de D-P8 tira o ano do recorte. A `Query` continua exigindo
    // um — deixá-lo vazio faria a leitura cair num ano indefinido.
    const q = consultaDe(
      {
        periodo: "12-meses",
        entidade: "consolidado",
        area: "todas",
        modalidade: "todas",
      },
      "2026",
    );
    expect(q.ano).toBe("2026");
  });
});
