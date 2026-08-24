/**
 * As fixtures dimensionais de RH (T-110).
 *
 * O aceite, em duas metades:
 *
 * 1. **as três views existem com uma linha por combinação** — grão completo,
 *    sem buraco e sem linha a mais;
 * 2. **somar todas as linhas de 2026 reproduz o Anexo C** — 1.240 FTE em
 *    dezembro, 241 admissões, 145 desligamentos, folha R$ 186 mi e 21.400 horas
 *    de treinamento.
 *
 * E mais três coisas que o aceite não pede com estas palavras e sem as quais a
 * fixture não serve para o que ela existe:
 *
 * - **nenhum agregado é linha.** `consolidado` e `todas` são soma, não dado. É
 *   a correção do achado 3 do Anexo D, e sem ela a reconciliação de RF-03
 *   continua parecendo correta sem ser.
 * - **a identidade contábil fecha em todo grão**, não só no total.
 * - **os perfis não são proporcionais entre si.** Um dataset onde toda medida
 *   se distribui igual não distingue um adaptador correto de um que multiplica
 *   tudo pelo mesmo fator.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  AGREGADO_DE_AREA,
  AGREGADO_DE_ENTIDADE,
  AREAS_ARMAZENADAS,
  ENTIDADES_ARMAZENADAS,
  MODALIDADES_ARMAZENADAS,
  mesesDe,
} from "@/acesso/fixtures/eixos";
import {
  ABSENTEISMO_MENSAL,
  ADMISSOES_MENSAL,
  FATIA_DA_UNIDADE_SP,
  DESLIGAMENTOS_MENSAL,
  DESLIGAMENTOS_POR_TIPO,
  ENGAJAMENTO_MENSAL,
  ENPS_MENSAL,
  HEADCOUNT_MENSAL,
  HEADCOUNT_POR_MODALIDADE,
  MODALIDADES_DE_TREINAMENTO,
  PERFIL_POR_AREA,
  SALDO_DE_ABERTURA,
} from "@/acesso/fixtures/referencia-rh";
import {
  ANO_DA_FIXTURE,
  VW_FATO_RH_MES,
  VW_FATO_TREINAMENTO,
  VW_FATO_VAGAS,
  VW_FATO_VAGAS_FONTE,
} from "@/acesso/fixtures/rh";

const MESES = mesesDe(ANO_DA_FIXTURE);
const DEZEMBRO = MESES.at(-1) ?? "";
const CEM = 100;

const soma = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

/**
 * Arredonda para uma casa decimal **sem** `toFixed`.
 *
 * T-125 reserva `toFixed` ao módulo de formatação, e um teste de arquitetura
 * reprova quem o usar fora de lá — inclusive aqui, o que é correto: a regra
 * existe para que a formatação tenha um lugar só, e abrir exceção para teste
 * seria o primeiro passo para ela deixar de valer.
 */
const DEZ = 10;
const umaCasa = (x: number) => Math.round(x * DEZ) / DEZ;
const somaPor = <T>(linhas: readonly T[], f: (l: T) => number) =>
  soma(linhas.map(f));

function agrupar<T>(
  linhas: readonly T[],
  chave: (l: T) => string,
  valor: (l: T) => number,
): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const l of linhas)
    mapa.set(chave(l), (mapa.get(chave(l)) ?? 0) + valor(l));
  return mapa;
}

/* ------------------------------------------------------------------ *
 * A metade que o aceite escreve
 * ------------------------------------------------------------------ */

describe("as três views existem com uma linha por combinação", () => {
  it("vw_fato_rh_mes: mês × entidade × área × modalidade", () => {
    const esperado =
      MESES.length *
      ENTIDADES_ARMAZENADAS.length *
      AREAS_ARMAZENADAS.length *
      MODALIDADES_ARMAZENADAS.length;
    expect(VW_FATO_RH_MES).toHaveLength(esperado);
    expect(esperado).toBe(504);
  });

  it("vw_fato_vagas: mês × área", () => {
    expect(VW_FATO_VAGAS).toHaveLength(MESES.length * AREAS_ARMAZENADAS.length);
  });

  it("vw_fato_treinamento: mês × área × trilha × modalidade de trilha", () => {
    const trilhas = new Set(VW_FATO_TREINAMENTO.map((l) => l.trilha)).size;
    expect(VW_FATO_TREINAMENTO).toHaveLength(
      MESES.length *
        AREAS_ARMAZENADAS.length *
        trilhas *
        MODALIDADES_DE_TREINAMENTO.length,
    );
  });

  it("nenhuma combinação está repetida nem faltando", () => {
    // Uma linha a mais soma duas vezes; uma a menos some do total. As duas
    // passariam despercebidas numa conferência só de soma.
    const chaves = VW_FATO_RH_MES.map(
      (l) => `${l.mes}|${l.entidade}|${l.area}|${l.modalidade}`,
    );
    expect(new Set(chaves).size).toBe(chaves.length);
  });
});

describe("somar todas as linhas de 2026 reproduz o Anexo C", () => {
  const dezembro = VW_FATO_RH_MES.filter((l) => l.mes === DEZEMBRO);

  it("1.240 FTE em dezembro", () => {
    expect(somaPor(dezembro, (l) => l.headcountFte)).toBe(1240);
  });

  it("241 admissões no ano", () => {
    expect(somaPor(VW_FATO_RH_MES, (l) => l.admissoes)).toBe(241);
  });

  it("145 desligamentos no ano", () => {
    expect(somaPor(VW_FATO_RH_MES, (l) => l.desligamentos)).toBe(145);
    // E o mesmo 145 aparece na quebra por tipo do protótipo.
    expect(soma(DESLIGAMENTOS_POR_TIPO.map((d) => d.total))).toBe(145);
  });

  it("folha de R$ 186 mi no ano", () => {
    const UM_MILHAO = 1_000_000;
    expect(somaPor(VW_FATO_RH_MES, (l) => l.folhaReais)).toBe(186 * UM_MILHAO);
  });

  it("21.400 horas de treinamento no ano", () => {
    expect(somaPor(VW_FATO_TREINAMENTO, (l) => l.horas)).toBe(21_400);
  });
});

/* ------------------------------------------------------------------ *
 * O agregado nunca é linha (achado 3)
 * ------------------------------------------------------------------ */

describe("consolidado e todas são soma, nunca dado", () => {
  it("nenhuma linha carrega um código agregado", () => {
    const intrusas = VW_FATO_RH_MES.filter(
      (l) =>
        l.entidade === AGREGADO_DE_ENTIDADE ||
        l.area === AGREGADO_DE_AREA ||
        l.modalidade === AGREGADO_DE_AREA,
    );
    expect(intrusas).toEqual([]);
  });

  it("os eixos armazenados são o vocabulário menos o agregado", () => {
    // A guarda contra o teste acima passar por vacuidade: se a filtragem em
    // `eixos.ts` não removesse nada, não haveria intrusa a encontrar porque o
    // agregado seria um valor legítimo.
    expect(ENTIDADES_ARMAZENADAS).not.toContain(AGREGADO_DE_ENTIDADE);
    expect(AREAS_ARMAZENADAS).not.toContain(AGREGADO_DE_AREA);
    expect(ENTIDADES_ARMAZENADAS).toHaveLength(2);
    expect(AREAS_ARMAZENADAS).toHaveLength(7);
    expect(MODALIDADES_ARMAZENADAS).toHaveLength(3);
  });

  it("soma das entidades e soma das áreas dão o mesmo total", () => {
    /*
     * O que o achado 3 quebrava. No protótipo `Unidade SP` é o consolidado
     * vezes 0,62 e `Demais unidades` é o consolidado vezes 0,38 — a soma fecha
     * porque 0,62 + 0,38 = 1, e não porque são as mesmas pessoas contadas de
     * dois jeitos. Aqui fecha porque é a mesma soma feita duas vezes.
     */
    const total = somaPor(VW_FATO_RH_MES, (l) => l.folhaReais);
    const porEntidade = agrupar(
      VW_FATO_RH_MES,
      (l) => l.entidade,
      (l) => l.folhaReais,
    );
    const porArea = agrupar(
      VW_FATO_RH_MES,
      (l) => l.area,
      (l) => l.folhaReais,
    );
    expect(soma([...porEntidade.values()])).toBe(total);
    expect(soma([...porArea.values()])).toBe(total);
  });
});

/* ------------------------------------------------------------------ *
 * A identidade contábil
 * ------------------------------------------------------------------ */

describe("o headcount é o fluxo acumulado, em todo grão", () => {
  it("o saldo de abertura é 1.144 — e não os 1.150 do Anexo C", () => {
    expect(SALDO_DE_ABERTURA).toBe(1144);
  });

  it("hc[m] = hc[m-1] + admissões - desligamentos nos doze meses", () => {
    let anterior = SALDO_DE_ABERTURA;
    const falhas: string[] = [];
    for (const mes of MESES) {
      const doMes = VW_FATO_RH_MES.filter((l) => l.mes === mes);
      const esperado =
        anterior +
        somaPor(doMes, (l) => l.admissoes) -
        somaPor(doMes, (l) => l.desligamentos);
      const obtido = somaPor(doMes, (l) => l.headcountFte);
      if (obtido !== esperado) falhas.push(`${mes}: ${obtido} ≠ ${esperado}`);
      anterior = obtido;
    }
    expect(falhas).toEqual([]);
  });

  it("e vale também dentro de cada área, não só no total", () => {
    // A diferença: o total poderia fechar com as áreas erradas se compensassem
    // entre si. É o que faz o painel de saldo líquido fechar sob recorte.
    const falhas: string[] = [];
    for (const area of AREAS_ARMAZENADAS) {
      const daArea = VW_FATO_RH_MES.filter((l) => l.area === area);
      let saldo = somaPor(
        daArea.filter((l) => l.mes === MESES[0]),
        (l) => l.headcountFte,
      );
      for (const mes of MESES.slice(1)) {
        const doMes = daArea.filter((l) => l.mes === mes);
        saldo +=
          somaPor(doMes, (l) => l.admissoes) -
          somaPor(doMes, (l) => l.desligamentos);
        const obtido = somaPor(doMes, (l) => l.headcountFte);
        if (obtido !== saldo) falhas.push(`${area}/${mes}`);
      }
    }
    expect(falhas).toEqual([]);
  });

  it("nenhuma célula tem quadro negativo", () => {
    expect(VW_FATO_RH_MES.filter((l) => l.headcountFte < 0)).toEqual([]);
  });

  it("a série mensal reproduz a do protótipo", () => {
    const porMes = MESES.map((mes) =>
      somaPor(
        VW_FATO_RH_MES.filter((l) => l.mes === mes),
        (l) => l.headcountFte,
      ),
    );
    expect(porMes).toEqual([...HEADCOUNT_MENSAL]);
  });
});

/* ------------------------------------------------------------------ *
 * As taxas voltam dos componentes
 * ------------------------------------------------------------------ */

describe("taxa nenhuma está armazenada — todas se recalculam", () => {
  it("absenteísmo = horas ausentes / horas previstas, mês a mês", () => {
    const obtido = MESES.map((mes) => {
      const doMes = VW_FATO_RH_MES.filter((l) => l.mes === mes);
      const taxa =
        (somaPor(doMes, (l) => l.horasAusentes) /
          somaPor(doMes, (l) => l.horasPrevistas)) *
        CEM;
      return umaCasa(taxa);
    });
    expect(obtido).toEqual([...ABSENTEISMO_MENSAL]);
  });

  it("eNPS = (promotores - detratores) / respondentes", () => {
    const obtido = MESES.map((mes) => {
      const doMes = VW_FATO_RH_MES.filter((l) => l.mes === mes);
      const p = somaPor(doMes, (l) => l.promotores);
      const d = somaPor(doMes, (l) => l.detratores);
      const r = somaPor(doMes, (l) => l.respondentes);
      return Math.round(((p - d) / r) * CEM);
    });
    expect(obtido).toEqual([...ENPS_MENSAL]);
  });

  it("promotores + neutros + detratores = respondentes", () => {
    const ruins = VW_FATO_RH_MES.filter(
      (l) => l.promotores + l.neutros + l.detratores !== l.respondentes,
    );
    expect(ruins).toEqual([]);
  });

  it("engajamento = pontos somados / respondentes", () => {
    const obtido = MESES.map((mes) => {
      const doMes = VW_FATO_RH_MES.filter((l) => l.mes === mes);
      return Math.round(
        somaPor(doMes, (l) => l.pontosDeEngajamento) /
          somaPor(doMes, (l) => l.respondentes),
      );
    });
    expect(obtido).toEqual([...ENGAJAMENTO_MENSAL]);
  });

  it("a taxa de um recorte é a do recorte, e não a do total", () => {
    /*
     * A prova de que guardar componentes serve para alguma coisa. Se as taxas
     * estivessem armazenadas prontas, o recorte de Tecnologia mostraria o
     * absenteísmo da empresa inteira.
     */
    const daArea = VW_FATO_RH_MES.filter((l) => l.area === "tecnologia");
    const doTotal = VW_FATO_RH_MES;
    const taxa = (linhas: typeof VW_FATO_RH_MES) =>
      somaPor(linhas, (l) => l.horasAusentes) /
      somaPor(linhas, (l) => l.horasPrevistas);
    expect(taxa(daArea)).toBeGreaterThan(0);
    expect(taxa(daArea)).not.toBe(taxa(doTotal));
  });
});

/* ------------------------------------------------------------------ *
 * Os perfis não são proporcionais entre si
 * ------------------------------------------------------------------ */

describe("cada medida tem o seu próprio perfil", () => {
  const dezembro = VW_FATO_RH_MES.filter((l) => l.mes === DEZEMBRO);

  it("dezembro por área reproduz o perfil do protótipo", () => {
    const porArea = agrupar(
      dezembro,
      (l) => l.area,
      (l) => l.headcountFte,
    );
    for (const p of PERFIL_POR_AREA) {
      expect(porArea.get(p.codigo), p.codigo).toBe(p.headcount);
    }
  });

  it("dezembro por modalidade reproduz 604 / 472 / 164", () => {
    const porModalidade = agrupar(
      dezembro,
      (l) => l.modalidade,
      (l) => l.headcountFte,
    );
    for (const m of HEADCOUNT_POR_MODALIDADE) {
      expect(porModalidade.get(m.codigo), m.codigo).toBe(m.headcount);
    }
  });

  it("a área com mais gente não é a com mais folha por pessoa", () => {
    /*
     * O controle que T-140 vai endurecer. Tecnologia tem 13,5% do quadro e 22%
     * da folha. Um adaptador que multiplique tudo por um fator só acerta uma
     * das duas e erra a outra — e é justamente isso que o achado 3 descreve e
     * que o protótipo não distingue.
     */
    const custoPorFte = (area: string) => {
      const doAno = VW_FATO_RH_MES.filter((l) => l.area === area);
      const hcDez = somaPor(
        dezembro.filter((l) => l.area === area),
        (l) => l.headcountFte,
      );
      return somaPor(doAno, (l) => l.folhaReais) / hcDez;
    };
    expect(custoPorFte("tecnologia")).toBeGreaterThan(custoPorFte("operacoes"));
    expect(custoPorFte("logistica")).toBeLessThan(custoPorFte("financeiro"));
  });

  it("a fatia da Unidade SP muda de medida para medida", () => {
    const fatia = (f: (l: (typeof VW_FATO_RH_MES)[number]) => number) => {
      const sp = somaPor(
        VW_FATO_RH_MES.filter((l) => l.entidade === "unidade-sp"),
        f,
      );
      return sp / somaPor(VW_FATO_RH_MES, f);
    };
    const daFolha = fatia((l) => l.folhaReais);
    const doQuadro = fatia((l) => l.headcountFte);
    const dasAdmissoes = fatia((l) => l.admissoes);

    // Três medidas, três fatias. Se fossem iguais, um fator único explicaria
    // o dataset inteiro e o controle negativo de T-140 não teria o que pegar.
    expect(new Set([daFolha, doQuadro, dasAdmissoes]).size).toBe(3);
    expect(daFolha).toBeGreaterThan(doQuadro);
    expect(dasAdmissoes).toBeLessThan(doQuadro);
  });

  it("e cada fatia chega perto da que foi declarada", () => {
    /*
     * O teste acima confere o **ranking** entre as fatias; este confere o
     * **nível**. A diferença pegou dois defeitos de verdade:
     *
     * - a inclinação de entidade aplicada duas vezes, que punha 78% da folha em
     *   SP onde estão declarados 68%;
     * - o viés de ordem da repartição mensal, que punha 72% dos desligamentos em
     *   SP onde estão declarados 66%, só porque a sobra de cada mês ia sempre
     *   para as primeiras células do vetor.
     *
     * Os dois passavam pelo teste de ranking, e nenhum dos dois mexia numa soma.
     */
    const UM_PONTO = 0.011;
    const fatia = (f: (l: (typeof VW_FATO_RH_MES)[number]) => number) =>
      somaPor(
        VW_FATO_RH_MES.filter((l) => l.entidade === "unidade-sp"),
        f,
      ) / somaPor(VW_FATO_RH_MES, f);

    const declarado: ReadonlyArray<
      [string, (l: (typeof VW_FATO_RH_MES)[number]) => number, number]
    > = [
      [
        "headcount",
        (l) => l.headcountFte,
        FATIA_DA_UNIDADE_SP["headcount"] ?? 0,
      ],
      ["admissoes", (l) => l.admissoes, FATIA_DA_UNIDADE_SP["admissoes"] ?? 0],
      [
        "desligamentos",
        (l) => l.desligamentos,
        FATIA_DA_UNIDADE_SP["desligamentos"] ?? 0,
      ],
      ["folha", (l) => l.folhaReais, FATIA_DA_UNIDADE_SP["folha"] ?? 0],
    ];

    const fora = declarado
      .map(([nome, f, alvo]) => ({ nome, obtido: fatia(f), alvo }))
      .filter((x) => Math.abs(x.obtido - x.alvo) > UM_PONTO);
    expect(fora).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * Vagas e treinamento
 * ------------------------------------------------------------------ */

describe("vagas e funil", () => {
  it("96 vagas fechadas e 96 contratados no ano — o funil fecha", () => {
    expect(somaPor(VW_FATO_VAGAS, (l) => l.fechadas)).toBe(96);
    expect(somaPor(VW_FATO_VAGAS, (l) => l.contratados)).toBe(96);
    expect(somaPor(VW_FATO_VAGAS_FONTE, (l) => l.contratados)).toBe(96);
  });

  it("o funil só encolhe, etapa a etapa", () => {
    const etapas = [
      somaPor(VW_FATO_VAGAS, (l) => l.candidaturas),
      somaPor(VW_FATO_VAGAS, (l) => l.triagem),
      somaPor(VW_FATO_VAGAS, (l) => l.entrevistas),
      somaPor(VW_FATO_VAGAS, (l) => l.propostas),
      somaPor(VW_FATO_VAGAS, (l) => l.contratados),
    ];
    expect(etapas).toEqual([4820, 1180, 412, 128, 96]);
    for (let i = 1; i < etapas.length; i += 1) {
      expect(etapas[i]).toBeLessThan(etapas[i - 1] ?? 0);
    }
  });

  it("o tempo de fechamento se recalcula de dias somados / fechadas", () => {
    const dias =
      somaPor(VW_FATO_VAGAS, (l) => l.diasSomados) /
      somaPor(VW_FATO_VAGAS, (l) => l.fechadas);
    // Entre o menor e o maior perfil de área do protótipo.
    expect(dias).toBeGreaterThan(26);
    expect(dias).toBeLessThan(61);
  });
});

describe("treinamento", () => {
  it("as horas fecham por área e por modalidade de trilha", () => {
    const porArea = agrupar(
      VW_FATO_TREINAMENTO,
      (l) => l.area,
      (l) => l.horas,
    );
    for (const p of PERFIL_POR_AREA) {
      expect(porArea.get(p.codigo), p.codigo).toBe(p.horasTreinamento);
    }

    const porModalidade = agrupar(
      VW_FATO_TREINAMENTO,
      (l) => l.modalidadeDeTrilha,
      (l) => l.horas,
    );
    for (const m of MODALIDADES_DE_TREINAMENTO) {
      expect(porModalidade.get(m.codigo), m.codigo).toBe(m.horas);
    }
  });

  it("a modalidade da trilha não é a modalidade de trabalho", () => {
    // Duas dimensões com nomes parecidos. `online` só existe na trilha;
    // `remoto` só existe no trabalho. Confundi-las é erro de reunião.
    const daTrilha = new Set(
      VW_FATO_TREINAMENTO.map((l) => l.modalidadeDeTrilha),
    );
    expect(daTrilha).toContain("online");
    expect(daTrilha).not.toContain("remoto");
    expect(MODALIDADES_ARMAZENADAS).toContain("remoto");
    expect(MODALIDADES_ARMAZENADAS).not.toContain("online");
  });

  it("conclusão nunca passa de iniciadas", () => {
    const ruins = VW_FATO_TREINAMENTO.filter(
      (l) => l.trilhasConcluidas > l.trilhasIniciadas,
    );
    expect(ruins).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * O que o Anexo C ainda diz de errado
 * ------------------------------------------------------------------ */

describe("as divergências registradas em D-H03 continuam lá", () => {
  /*
   * Estes dois casos parecem estranhos: eles afirmam que o PRD está errado.
   *
   * A razão de existirem é que a escolha da fixture depende disso. No dia em
   * que H-03 for resolvido e o Anexo C for corrigido, eles ficam vermelhos — e
   * é o sinal certo, porque nesse dia a fixture precisa ser reconferida contra
   * o texto novo em vez de continuar contra o antigo em silêncio.
   */
  const prd = readFileSync(resolve(process.cwd(), "PRD.md"), "utf8");

  it("o Anexo C ainda escreve 1.150 onde a conta pede 1.144", () => {
    expect(prd).toContain("1.150 + 241 admissões - 145 saídas");
    expect(1150 + 241 - 145).not.toBe(1240);
    expect(SALDO_DE_ABERTURA + 241 - 145).toBe(1240);
  });

  it("o turnover de 18,4% do Anexo C não sai dos 145 desligamentos", () => {
    expect(prd).toContain("18,4%");
    const medio = soma([...HEADCOUNT_MENSAL]) / HEADCOUNT_MENSAL.length;
    const derivado = (soma([...DESLIGAMENTOS_MENSAL]) / medio) * CEM;
    expect(umaCasa(derivado)).toBe(12.1);
  });

  it("mas as demais linhas do Anexo C fecham", () => {
    expect(soma([...ADMISSOES_MENSAL])).toBe(241);
    expect(soma([...DESLIGAMENTOS_MENSAL])).toBe(145);
    expect(52 + 75 - 51).toBe(76);
    expect(1412 - 212).toBe(1200);
  });
});
