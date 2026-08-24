/**
 * O filtro dimensional do adaptador de fixtures (T-114).
 *
 * O aceite tem duas metades, e as duas são sobre o achado 3 do Anexo D:
 *
 * 1. **os multiplicadores do protótipo não existem no caminho de leitura** —
 *    recortar é escolher linhas, e escolher linhas não precisa de fator;
 * 2. **a aditividade fecha** — `soma(Unidade SP) + soma(Demais unidades)` é
 *    `soma(Consolidado)` e a soma das 7 áreas é `Todas`, nos 12 meses e nos 4
 *    períodos.
 *
 * A segunda metade é o que dá sentido à primeira. Com fator de escala a
 * aditividade também "fecha" — porque `0,62 + 0,38 = 1` — e é por isso que o
 * achado 4 diz que a reconciliação **parece** correta sem ser. Aqui ela fecha
 * porque são as mesmas linhas contadas de dois jeitos.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

import { linhasDe, somaNoRecorte, VIEWS } from "@/acesso/fixtures/adaptador";
import {
  AREAS_ARMAZENADAS,
  ENTIDADES_ARMAZENADAS,
} from "@/acesso/fixtures/eixos";
import {
  MESES_DO_PERIODO,
  mesesDoRecorte,
  PeriodoDesconhecido,
  quebrarPor,
  recortar,
  serieDeTaxa,
  serieSomada,
  somar,
} from "@/acesso/fixtures/recorte";
import { VW_FATO_FIN_MES } from "@/acesso/fixtures/fin";
import { VW_FATO_RH_MES } from "@/acesso/fixtures/rh";
import type { Query } from "@/semantica/contrato";
import { PERIODOS, QUERY_PADRAO } from "@/semantica/contrato";

const RAIZ = process.cwd();

/* ------------------------------------------------------------------ *
 * Metade 1 — o multiplicador não existe no caminho de leitura
 * ------------------------------------------------------------------ */

/**
 * Os arquivos onde uma fração de participação é legítima.
 *
 * A distinção não é retórica e cabe numa frase: **a fixture é o dado; o
 * adaptador é a leitura.** Dizer "62% das pessoas trabalham em SP" ao construir
 * as linhas é um fato sobre a empresa fictícia, e o resultado disso são linhas
 * de verdade, uma por entidade. Multiplicar um total por 0,62 na hora de ler é
 * o achado 3 — e é o que esta varredura procura.
 *
 * A lista é nominal e curta de propósito: se ela crescer, cresce no diff.
 */
const ONDE_A_FRACAO_E_DADO = [
  "src/acesso/fixtures/entidade.ts",
  "src/acesso/fixtures/referencia-rh.ts",
  "src/acesso/fixtures/referencia-fin.ts",
  "src/acesso/fixtures/rh.ts",
  "src/acesso/fixtures/fin.ts",
];

function todosOsArquivos(pasta: string): readonly string[] {
  const saida: string[] = [];
  for (const nome of readdirSync(pasta)) {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory())
      saida.push(...todosOsArquivos(caminho));
    else if (/\.tsx?$/.test(nome)) saida.push(caminho);
  }
  return saida;
}

/** Lê sem comentários: explicar o achado 3 por escrito não pode reprovar. */
function codigo(caminho: string): string {
  return readFileSync(join(RAIZ, caminho), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/**
 * O mesmo, sem os textos.
 *
 * `AindaNaoImplementado("getKpis", "T-115 e T-116")` tem dígitos e nenhum
 * número: são nomes de tarefa. Procurar literal numérico sem tirar os textos
 * antes confunde as duas coisas — e foi o que aconteceu na primeira versão
 * deste arquivo.
 */
function codigoSemTextos(caminho: string): string {
  return codigo(caminho)
    .replace(/"[^"]*"/g, '""')
    .replace(/'[^']*'/g, "''")
    .replace(/`[^`]*`/g, "``");
}

const ARQUIVOS = todosOsArquivos(join(RAIZ, "src")).map((c) =>
  relative(RAIZ, c).split(sep).join("/"),
);
const CAMINHO_DE_LEITURA = ARQUIVOS.filter(
  (c) => !ONDE_A_FRACAO_E_DADO.includes(c),
);

describe("os multiplicadores do protótipo não existem", () => {
  it("a varredura encontra arquivos — senão não prova nada", () => {
    expect(ARQUIVOS.length).toBeGreaterThan(20);
    expect(CAMINHO_DE_LEITURA.length).toBeGreaterThan(15);
  });

  it("0.62 e 0.38 não aparecem em lugar nenhum do caminho de leitura", () => {
    const infratores = CAMINHO_DE_LEITURA.filter((c) =>
      /\b0\.(62|38)\b/.test(codigo(c)),
    );
    expect(infratores).toEqual([]);
  });

  it("nenhuma fração literal aparece na camada de dados", () => {
    /*
     * Mais forte que procurar 0.62 e 0.38: um fator de escala é, por natureza,
     * uma fração. Trocar 0,62 por 0,615 escaparia da busca por valor e não
     * escapa desta. Inteiro não é fator de escala — 12 meses é uma janela, não
     * uma participação.
     *
     * A regra vale na **camada de dados**, e a primeira versão dela valia em
     * `src/` inteiro — onde pegou três `strokeWidth={0.75}`, que são espessura
     * de linha de grade. Fração em componente de gráfico é geometria, e quem
     * cuida de número solto lá é a regra de T-181. O achado 3 é um defeito de
     * dado, e é na camada de dados que ele moraria.
     */
    const daCamadaDeDados = CAMINHO_DE_LEITURA.filter(
      (c) => c.startsWith("src/acesso/") || c.startsWith("src/semantica/"),
    );
    expect(daCamadaDeDados.length).toBeGreaterThan(8);

    const infratores = daCamadaDeDados.filter((c) =>
      /(^|[^\w.])0\.\d+/.test(codigoSemTextos(c)),
    );
    expect(infratores).toEqual([]);
  });

  it("e o caminho de leitura não multiplica nada", () => {
    /*
     * O caso mais direto, nos dois arquivos onde o achado 3 moraria: escalar é
     * multiplicar, e aqui não há multiplicação nenhuma. Recortar é escolher
     * linhas; somar é somar.
     *
     * Uma primeira versão procurava "nenhum dígito", e reprovava em
     * `linhas.length === 0` — que é conferência de vazio, não fator. Procurar o
     * operador diz o que se quer dizer.
     */
    for (const arquivo of [
      "src/acesso/fixtures/adaptador.ts",
      "src/acesso/fixtures/recorte.ts",
    ]) {
      const fonte = codigoSemTextos(arquivo);
      expect(fonte, `${arquivo} multiplica`).not.toMatch(/[^*]\*[^*/]/);
      expect(fonte, `${arquivo} tem fração`).not.toMatch(/(^|[^\w.])0\.\d+/);
    }
  });

  it("a lista de onde a fração é dado tem cinco arquivos, e todos existem", () => {
    // A guarda contra a lista virar um lugar onde qualquer coisa cabe.
    expect(ONDE_A_FRACAO_E_DADO).toHaveLength(5);
    for (const c of ONDE_A_FRACAO_E_DADO) expect(ARQUIVOS).toContain(c);
  });
});

/* ------------------------------------------------------------------ *
 * Metade 2 — a aditividade fecha
 * ------------------------------------------------------------------ */

/** Uma `Query` no consolidado, com um campo trocado. */
function com(mudanca: Partial<Query>): Query {
  return { ...QUERY_PADRAO, ...mudanca };
}

/** As medidas aditivas de RH que precisam fechar. */
const MEDIDAS_DE_RH: ReadonlyArray<
  [string, (l: (typeof VW_FATO_RH_MES)[number]) => number]
> = [
  ["admissoes", (l) => l.admissoes],
  ["desligamentos", (l) => l.desligamentos],
  ["folha", (l) => l.folhaReais],
  ["headcount", (l) => l.headcountFte],
  ["horasPrevistas", (l) => l.horasPrevistas],
  ["respondentes", (l) => l.respondentes],
];

describe("soma(Unidade SP) + soma(Demais unidades) = soma(Consolidado)", () => {
  it.each(PERIODOS)("no período %s", (periodo) => {
    const falhas: string[] = [];
    for (const [nome, medida] of MEDIDAS_DE_RH) {
      const consolidado = somaNoRecorte(
        "vw_fato_rh_mes",
        com({ periodo }),
        medida,
      );
      const partes = ENTIDADES_ARMAZENADAS.map(
        (entidade) =>
          somaNoRecorte(
            "vw_fato_rh_mes",
            com({ periodo, entidade: entidade as Query["entidade"] }),
            medida,
          ) ?? 0,
      );
      const soma = partes.reduce((a, b) => a + b, 0);
      if (soma !== consolidado) {
        falhas.push(`${nome}: ${soma} ≠ ${consolidado}`);
      }
    }
    expect(falhas).toEqual([]);
  });

  it("e mês a mês, nos doze", () => {
    const falhas: string[] = [];
    for (const mes of mesesDoRecorte(QUERY_PADRAO)) {
      for (const [nome, medida] of MEDIDAS_DE_RH) {
        const doMes = VW_FATO_RH_MES.filter((l) => l.mes === mes);
        const consolidado = somar(doMes, medida);
        const partes = ENTIDADES_ARMAZENADAS.map((e) =>
          somar(
            doMes.filter((l) => l.entidade === e),
            medida,
          ),
        );
        const soma = partes.reduce((a, b) => a + b, 0);
        if (soma !== consolidado) falhas.push(`${mes}/${nome}`);
      }
    }
    expect(falhas).toEqual([]);
  });
});

describe("a soma das 7 áreas = 'Todas'", () => {
  it.each(PERIODOS)("no período %s", (periodo) => {
    const falhas: string[] = [];
    for (const [nome, medida] of MEDIDAS_DE_RH) {
      const todas = somaNoRecorte("vw_fato_rh_mes", com({ periodo }), medida);
      const partes = AREAS_ARMAZENADAS.map(
        (area) =>
          somaNoRecorte(
            "vw_fato_rh_mes",
            com({ periodo, area: area as Query["area"] }),
            medida,
          ) ?? 0,
      );
      const soma = partes.reduce((a, b) => a + b, 0);
      if (soma !== todas) falhas.push(`${nome}: ${soma} ≠ ${todas}`);
    }
    expect(falhas).toEqual([]);
  });

  it("e a soma das 3 modalidades também", () => {
    const falhas: string[] = [];
    for (const [nome, medida] of MEDIDAS_DE_RH) {
      const todas = somaNoRecorte("vw_fato_rh_mes", QUERY_PADRAO, medida);
      const partes = (["presencial", "hibrido", "remoto"] as const).map(
        (modalidade) =>
          somaNoRecorte("vw_fato_rh_mes", com({ modalidade }), medida) ?? 0,
      );
      const soma = partes.reduce((a, b) => a + b, 0);
      if (soma !== todas) falhas.push(nome);
    }
    expect(falhas).toEqual([]);
  });

  it("recortar por área e por entidade ao mesmo tempo também fecha", () => {
    // O cruzamento é onde um fator de escala se denuncia: com multiplicador,
    // recortar duas dimensões multiplica dois fatores e o total encolhe duas
    // vezes. Com linhas, a partição continua sendo partição.
    const total = somaNoRecorte(
      "vw_fato_rh_mes",
      QUERY_PADRAO,
      (l) => l.folhaReais,
    );
    let soma = 0;
    for (const entidade of ENTIDADES_ARMAZENADAS) {
      for (const area of AREAS_ARMAZENADAS) {
        soma +=
          somaNoRecorte(
            "vw_fato_rh_mes",
            com({
              entidade: entidade as Query["entidade"],
              area: area as Query["area"],
            }),
            (l) => l.folhaReais,
          ) ?? 0;
      }
    }
    expect(soma).toBe(total);
  });
});

/* ------------------------------------------------------------------ *
 * O período
 * ------------------------------------------------------------------ */

describe("o período é uma janela de meses, não um fator", () => {
  it.each(Object.entries(MESES_DO_PERIODO))(
    "%s pega %i meses, terminando em dezembro",
    (periodo, quantos) => {
      const meses = mesesDoRecorte(
        com({ periodo: periodo as Query["periodo"] }),
      );
      expect(meses).toHaveLength(quantos);
      expect(meses.at(-1)).toBe("2026-12");
    },
  );

  it("recortes menores devolvem valores menores, e não escalados", () => {
    const doAno = somaNoRecorte(
      "vw_fato_rh_mes",
      QUERY_PADRAO,
      (l) => l.admissoes,
    );
    const doMes = somaNoRecorte(
      "vw_fato_rh_mes",
      com({ periodo: "dezembro" }),
      (l) => l.admissoes,
    );
    // Dezembro tem 16 admissões das 241 do ano — o número do mês, não 1/12 do ano.
    expect(doMes).toBe(16);
    expect(doAno).toBe(241);
  });

  it("período fora do vocabulário lança em vez de cair em 12 meses", () => {
    expect(() =>
      mesesDoRecorte(com({ periodo: "semestre" as Query["periodo"] })),
    ).toThrow(PeriodoDesconhecido);
  });
});

/* ------------------------------------------------------------------ *
 * A dimensão que não se aplica
 * ------------------------------------------------------------------ */

describe("filtrar por área o que não tem área", () => {
  it("devolve 'não se aplica', e não o consolidado", () => {
    /*
     * A saída errada seria devolver tudo: a receita consolidada apareceria sob
     * o recorte de Operações, que é o "valor remanescente" que RF-01 proíbe.
     */
    const r = recortar(VW_FATO_FIN_MES, com({ area: "operacoes" }));
    expect(r.aplicavel).toBe(false);
    if (!r.aplicavel) expect(r.dimensao).toBe("area");
  });

  it("e o consolidado por área continua se aplicando", () => {
    // `todas` não é recorte: é "não recorte por aqui".
    const r = recortar(VW_FATO_FIN_MES, QUERY_PADRAO);
    expect(r.aplicavel).toBe(true);
  });

  it("mas por entidade se aplica, porque Financeiro tem entidade", () => {
    const r = recortar(VW_FATO_FIN_MES, com({ entidade: "unidade-sp" }));
    expect(r.aplicavel).toBe(true);
    if (r.aplicavel) expect(r.linhas.length).toBeGreaterThan(0);
  });

  it("a soma no recorte devolve null, e nunca zero", () => {
    // Zero afirmaria que a empresa não faturou. `null` diz que a pergunta não
    // se aplica — e são estados diferentes da seção 6.4.
    expect(
      somaNoRecorte(
        "vw_fato_fin_mes",
        com({ area: "operacoes" }),
        (l) => l.receitaLiquida,
      ),
    ).toBeNull();
  });
});

/* ------------------------------------------------------------------ *
 * Séries
 * ------------------------------------------------------------------ */

describe("as séries mensais", () => {
  it("têm um ponto por mês do recorte", () => {
    const s = serieSomada(VW_FATO_RH_MES, QUERY_PADRAO, (l) => l.admissoes);
    expect(s).toHaveLength(12);
    expect(s.map((p) => p.valor)).toEqual([
      18, 22, 25, 16, 28, 20, 12, 26, 24, 20, 14, 16,
    ]);
  });

  it("mês sem linha devolve null, e não zero (PR-4)", () => {
    const s = serieSomada([], QUERY_PADRAO, () => 1);
    expect(s.every((p) => p.valor === null)).toBe(true);
  });

  it("a taxa carrega numerador e denominador, nunca o resultado pronto", () => {
    const s = serieDeTaxa(
      VW_FATO_RH_MES,
      QUERY_PADRAO,
      (l) => l.horasAusentes,
      (l) => l.horasPrevistas,
    );
    expect(s).toHaveLength(12);
    for (const p of s) {
      expect(p.numerador).not.toBeNull();
      expect(p.denominador).not.toBeNull();
    }
    // E somar os dois lados e dividir uma vez dá o absenteísmo do ano, que não
    // é a média das doze divisões mensais.
    const n = s.reduce((a, p) => a + (p.numerador ?? 0), 0);
    const d = s.reduce((a, p) => a + (p.denominador ?? 0), 0);
    const mediaDasMedias = s.reduce((a, p) => a + (p.valor ?? 0), 0) / s.length;
    expect(n / d).not.toBe(mediaDasMedias);
  });

  it("quebrar por área devolve partes que somam o total", () => {
    const partes = quebrarPor(
      VW_FATO_RH_MES,
      QUERY_PADRAO,
      "area",
      AREAS_ARMAZENADAS,
      (l) => l.desligamentos,
    );
    expect(partes).toHaveLength(7);
    expect(partes.reduce((a, p) => a + (p.valor ?? 0), 0)).toBe(145);
  });
});

/* ------------------------------------------------------------------ *
 * O adaptador
 * ------------------------------------------------------------------ */

describe("o adaptador publica as views da seção 10.1", () => {
  it("as sete views existem e nenhuma está vazia", () => {
    for (const [nome, linhas] of Object.entries(VIEWS)) {
      expect(linhas.length, nome).toBeGreaterThan(0);
    }
  });

  it("linhasDe devolve só o que está no recorte", () => {
    const linhas = linhasDe("vw_fato_rh_mes", com({ periodo: "dezembro" }));
    expect(new Set(linhas.map((l) => l.mes))).toEqual(new Set(["2026-12"]));
  });
});
