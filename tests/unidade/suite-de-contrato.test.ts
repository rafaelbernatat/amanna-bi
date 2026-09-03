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

import { REGRA_1 } from "@/acesso/contrato/regra-1";
import { reconciliacaoDe } from "@/acesso/contrato/reconciliacao";
import {
  conferirIgual,
  consultaDe,
  type Falha,
  limparRegras,
  recorteEmTexto,
  type Regra,
  registrarRegra,
  regrasRegistradas,
  relatorioEmTexto,
  rodarSuite,
  SuiteSemRegra,
} from "@/acesso/contrato/suite";
import { dimensoesProvisorias } from "@/acesso/dimensoes-provisorias";
import { criarFonteDeFixtures } from "@/acesso/fixtures/adaptador";
import { UNIDADES, type DataSource, type Unidade } from "@/semantica/contrato";
import { REGISTRO_DE_KPIS } from "@/semantica/kpis";
import { ORIGEM_DOS_PAINEIS } from "@/semantica/origem-de-painel";
import { QUANTIDADE_DE_PAINEIS } from "@/semantica/paineis";
import {
  contarRecortes,
  matrizDeRecortes,
  type Recorte,
} from "@/semantica/recortes";
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
  vezes: 1,
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
  it("cobre as dez unidades, sem sobra e sem falta", () => {
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

/**
 * Uma fonte forjada para os casos que só olham o arnês.
 *
 * `getPanel` responde de verdade, e as outras três portas não. A assimetria é
 * deliberada: desde T-123 o arnês percorre os 71 painéis por essa porta antes
 * de chamar qualquer regra, e uma fonte que a recusasse encheria estes casos de
 * falhas de percurso que não têm nada a ver com o que eles verificam.
 *
 * Antes deste comentário havia outro, dizendo "o arnês não a chama". Era
 * verdade quando foi escrito, e deixou de ser sem que ninguém o corrigisse — o
 * teste é que avisou.
 */
const FONTE_FORJADA = {
  getMeta: () => Promise.reject(new Error("não usado")),
  getKpis: () => Promise.reject(new Error("não usado")),
  getPanel: (id: string, q: never) => criarFonteDeFixtures().getPanel(id, q),
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

  /** Cobertura de exemplo: estes dois casos olham o texto da falha, não ela. */
  const COBERTURA = {
    declarados: ["rh-headcount", "rh-turnover"],
    percorridos: ["rh-headcount", "rh-turnover"],
    verificados: ["rh-headcount"],
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
      cobertura: COBERTURA,
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
      cobertura: COBERTURA,
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

/* ------------------------------------------------------------------ *
 * O percurso e a cobertura (T-123)
 * ------------------------------------------------------------------ */

describe("a suíte percorre os 71 painéis pelas portas", () => {
  /** Um recorte só: o percurso é por painel, não por recorte. */
  const UM: readonly Recorte[] = [
    {
      entidade: "consolidado",
      area: "todas",
      modalidade: "todas",
      periodo: "12-meses",
    } as Recorte,
  ];

  /**
   * Uma regra que não confere nada, só para o arnês aceitar rodar.
   *
   * O arnês recusa suíte sem regra — e com razão. Aqui o que está sob teste é
   * o percurso, que roda antes das regras e independe delas.
   */
  const MUDA: Regra = {
    numero: 9,
    nome: "não confere nada, só deixa o arnês rodar",
    rodar: () => Promise.resolve([]),
  };

  beforeEach(() => {
    limparRegras();
    registrarRegra(MUDA);
  });

  afterEach(() => {
    limparRegras();
  });

  it("declara os 71, e percorre os 71", async () => {
    const r = await rodarSuite(criarFonteDeFixtures(), "fixtures", UM, "2026");

    expect(r.cobertura.declarados).toHaveLength(QUANTIDADE_DE_PAINEIS);
    expect(r.cobertura.percorridos).toHaveLength(QUANTIDADE_DE_PAINEIS);
    expect(r.falhas).toEqual([]);
  });

  it("acusa o painel que lança, e não o conta como percorrido", async () => {
    /*
     * O defeito que só o percurso pega: um painel que quebra não produz
     * divergência nenhuma, porque não produz número nenhum. Num relatório que
     * só contasse divergências, ele sairia como silêncio — e silêncio, num
     * relatório verde, lê-se como "está tudo certo".
     */
    const fonte = criarFonteDeFixtures();
    const quebrada: DataSource = {
      ...fonte,
      getPanel: (id, q) =>
        id === "rh-headcount"
          ? Promise.reject(new Error("view não declarada"))
          : fonte.getPanel(id, q),
    };

    const r = await rodarSuite(quebrada, "fixtures", UM, "2026");

    expect(r.cobertura.percorridos).toHaveLength(QUANTIDADE_DE_PAINEIS - 1);
    expect(r.cobertura.percorridos).not.toContain("rh-headcount");
    expect(r.falhas).toHaveLength(1);
    expect(r.falhas[0]?.assunto).toBe("rh-headcount");
    expect(r.falhas[0]?.mensagem).toContain("view não declarada");
  });

  it("acusa o painel que devolve o envelope de outro", async () => {
    const fonte = criarFonteDeFixtures();
    const trocada: DataSource = {
      ...fonte,
      getPanel: (id, q) =>
        fonte.getPanel(id === "rh-turnover" ? "rh-headcount" : id, q),
    };

    const r = await rodarSuite(trocada, "fixtures", UM, "2026");

    expect(r.cobertura.percorridos).not.toContain("rh-turnover");
    expect(r.falhas).toHaveLength(1);
    expect(r.falhas[0]?.mensagem).toContain("rh-headcount");
  });

  it("a falha de percurso não se confunde com regra da 9.2", async () => {
    /*
     * A seção 9.2 numera as regras de 1 a 5. Percurso não é uma delas: é a
     * leitura que precede qualquer regra. Se as duas dividissem numeração,
     * "regra 1 falhou" passaria a significar duas coisas diferentes no mesmo
     * relatório.
     */
    const fonte = criarFonteDeFixtures();
    const quebrada: DataSource = {
      ...fonte,
      getPanel: (id, q) =>
        id === "rh-headcount"
          ? Promise.reject(new Error("qualquer coisa"))
          : fonte.getPanel(id, q),
    };

    const r = await rodarSuite(quebrada, "fixtures", UM, "2026");
    expect(r.falhas[0]?.regra).toBe(0);
  });
});

describe("a cobertura é medida, e não afirmada", () => {
  afterEach(() => {
    limparRegras();
  });

  it("a regra 1 declara exatamente o que confere", () => {
    /*
     * A declaração e o que a regra olha de fato precisam ser a mesma coisa.
     * Uma `cobre` escrita à mão viraria propaganda: diria 71 enquanto a regra
     * olha 40, e o relatório repetiria a propaganda com ar de medição.
     */
    const declarado = [...(REGRA_1.cobre?.() ?? [])].sort();

    const dosPares = REGISTRO_DE_KPIS.flatMap((k) => {
      if (k.detalhadoPor === null) return [];
      const par = reconciliacaoDe(k.id);
      if (par === undefined || par.forma.tipo === "nao_reconcilia") return [];
      return [k.detalhadoPor];
    });
    const porArea = ORIGEM_DOS_PAINEIS.filter((o) => o.eixo === "area").map(
      (o) => o.painel,
    );
    const esperado = [...new Set([...dosPares, ...porArea])].sort();

    expect(declarado).toEqual(esperado);
  });

  it("e o que ela confere é menos que os 71 — dito, não escondido", () => {
    /*
     * 40 de 71 hoje. Os 31 restantes não têm cartão que os detalhe nem eixo de
     * área, e é pelas regras 2 a 5 (T-159) que eles passam a ser conferidos.
     *
     * Este caso existe para que o dia em que o número mudar seja um dia em que
     * alguém decidiu que ele mudasse.
     */
    const quantos = REGRA_1.cobre?.().length ?? 0;
    expect(quantos).toBe(40);
    expect(quantos).toBeLessThan(QUANTIDADE_DE_PAINEIS);
  });

  it("o relatório nomeia os painéis sem regra, e não só os conta", async () => {
    limparRegras();
    registrarRegra(REGRA_1);

    const texto = relatorioEmTexto({
      fonte: "fixtures",
      recortes: 1,
      regras: [1],
      falhas: [],
      verificacoes: 1,
      cobertura: {
        declarados: ["a", "b", "c"],
        percorridos: ["a", "b", "c"],
        verificados: ["a"],
      },
    });

    expect(texto).toContain("3 de 3 painéis percorridos");
    expect(texto).toContain("1 de 3 verificados");
    // Nomeados: "2 sem regra" deixaria quem lê supondo quais são os dois.
    expect(texto).toContain("b, c");
  });
});

/* ------------------------------------------------------------------ *
 * O job de CI (T-123)
 * ------------------------------------------------------------------ */

describe("o CI tem um job próprio para a suíte de contrato", () => {
  type Passo = {
    readonly name?: string;
    readonly run?: string;
    readonly uses?: string;
    readonly if?: string;
    readonly with?: Record<string, string>;
  };
  type Job = { readonly name?: string; readonly steps?: readonly Passo[] };

  const WORKFLOW = parse(
    readFileSync("./.github/workflows/ci.yml", "utf8"),
  ) as {
    readonly env?: Record<string, string>;
    readonly jobs: Record<string, Job>;
  };

  const CONTRATO = WORKFLOW.jobs["contrato"];

  it("o job existe, e com esse nome", () => {
    /*
     * O nome importa duas vezes: é o que aparece na lista de checagens do pull
     * request, e é o que precisa estar marcado como required status check no
     * ruleset de `main` (H-58). Renomear aqui sem renomear lá faz o portão
     * apontar para um job que não existe mais, e ele para de reprovar em
     * silêncio.
     */
    expect(CONTRATO).toBeDefined();
    expect(CONTRATO?.name).toBe("contrato");
  });

  it("roda a suíte, e tira a fonte de DATA_SOURCE", () => {
    /*
     * `--source=$DATA_SOURCE`, e não `--source=fixtures`. Repetir o literal
     * criaria duas verdades no mesmo job: trocar a variável deixaria o job
     * rodando fixtures com nome de warehouse, que é a única coisa que o RF-21
     * não pode deixar acontecer.
     */
    const comando = CONTRATO?.steps?.find((e) =>
      e.run?.includes("run contrato"),
    );
    expect(comando, "nenhum passo roda a suíte").toBeDefined();
    expect(comando?.run).toContain("$DATA_SOURCE");
    expect(comando?.run).not.toContain("--source=fixtures");
    expect(WORKFLOW.env?.["DATA_SOURCE"]).toBe("fixtures");
  });

  it("arquiva o relatório SEMPRE, e não só quando falha", () => {
    /*
     * O relatório de uma rodada verde é o que diz quanto ela verificou. É
     * comparando duas rodadas verdes que se descobre que a cobertura encolheu
     * — um artefato que só existe no vermelho responde "o que quebrou" e nunca
     * "o que deixou de ser olhado".
     */
    const arquivo = CONTRATO?.steps?.find((e) =>
      e.uses?.startsWith("actions/upload-artifact"),
    );
    expect(arquivo, "o job não arquiva o relatório").toBeDefined();
    expect(arquivo?.if).toBe("always()");
    expect(arquivo?.with?.["path"]).toContain("relatorios/contrato");
  });
});
