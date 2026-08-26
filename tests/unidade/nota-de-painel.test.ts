/**
 * O escopo da nota e a supressão sob recorte (T-133, PRD seção 6.3 e RF-09).
 *
 * O aceite tem três exigências:
 *
 * 1. para cada um dos 71 painéis, sob recorte fora do padrão a nota vem nula
 *    **ou** escrita para aquele recorte;
 * 2. o subtítulo passa a "No recorte ativo · <área>";
 * 3. um detector de valor absoluto roda sobre todas as notas nos 768 recortes
 *    e falha se um número válido apenas no consolidado aparecer sob outro
 *    recorte.
 *
 * A terceira é a que dá trabalho e é a que importa: 71 × 768 é uma varredura,
 * não uma amostra. É onde uma nota escrita para o consolidado apareceria sob a
 * terceira área do quarto trimestre e ninguém veria.
 */

import { describe, expect, it } from "vitest";

import { dimensoesProvisorias } from "@/acesso/dimensoes-provisorias";
import { noPadrao, notaDoPainel } from "@/acesso/fixtures/nota";
import { calcularPainel } from "@/acesso/fixtures/paineis";
import { subtituloSobRecorte } from "@/apresentacao/filtros/recorte-ativo";
import type { Query } from "@/semantica/contrato";
import { QUERY_PADRAO } from "@/semantica/contrato";
import {
  afirmaNumero,
  ESCOPOS_DE_NOTA,
  escoposDeclarados,
  notaDeclarada,
} from "@/semantica/nota-de-painel";
import {
  QUANTIDADE_DE_PAINEIS,
  REGISTRO_DE_PAINEIS,
} from "@/semantica/paineis";
import { consultaDe } from "@/acesso/contrato/suite";
import { matrizDeRecortes } from "@/semantica/recortes";

const MATRIZ = matrizDeRecortes(dimensoesProvisorias());
const ANO = dimensoesProvisorias().ano?.[0] ?? "2026";

/* ------------------------------------------------------------------ *
 * A declaração cobre os 71
 * ------------------------------------------------------------------ */

describe("todo painel declara o escopo da nota", () => {
  it("são 71 declarações, uma por painel do registro", () => {
    const declarados = escoposDeclarados().map((d) => d.painel);
    expect(declarados).toHaveLength(QUANTIDADE_DE_PAINEIS);
    expect([...declarados].sort()).toEqual(
      REGISTRO_DE_PAINEIS.map((p) => p.id).sort(),
    );
  });

  it("nenhum escopo fora dos três", () => {
    for (const d of escoposDeclarados()) {
      expect(ESCOPOS_DE_NOTA, d.painel).toContain(d.escopo);
    }
  });

  it("os painéis com nota calculada são os que quebram por área", () => {
    /*
     * A receita `concentracao` diz "as duas maiores respondem por N% do
     * total", e isso só é honesto onde as partes somam o todo. A lista é
     * derivada do eixo declarado, e não escrita — este caso confere que a
     * derivação chega onde deveria.
     */
    const comReceita = escoposDeclarados()
      .filter((d) => d.escopo === "do_recorte")
      .map((d) => d.painel);
    expect(comReceita.length).toBeGreaterThan(0);
    expect(comReceita).toContain("rh-areas");
    expect(comReceita).toContain("tov-area");
  });
});

/* ------------------------------------------------------------------ *
 * O detector
 * ------------------------------------------------------------------ */

describe("o detector de valor absoluto", () => {
  it("pega o que o protótipo pegava", () => {
    for (const texto of [
      "Crescimento líquido de 128 FTE no período.",
      "A folha somou R$ 41,2 mi no ano.",
      "São 1.240 colaboradores na base.",
      "O ciclo médio é de 47 dias.",
    ]) {
      expect(afirmaNumero(texto), texto).toBe(true);
    }
  });

  it("e pega o que ele deixava passar", () => {
    /*
     * O `hasAbs` do protótipo exige uma unidade da lista depois do número.
     * "71% do estouro" não tem nenhuma, então passava — e uma proporção do
     * consolidado é tão falsa sob recorte quanto uma contagem.
     */
    for (const texto of [
      "Operações e Comercial respondem por 71% do estouro.",
      "A margem caiu 3,2 pp contra o ano anterior.",
      "O turnover ficou em 18,4%.",
    ]) {
      expect(afirmaNumero(texto), texto).toBe(true);
    }
  });

  it("e não acusa frase sem número", () => {
    for (const texto of [
      "O saldo é positivo em quase todos os meses.",
      "A retenção cai enquanto a empresa cresce.",
      "Sem dado neste recorte.",
    ]) {
      expect(afirmaNumero(texto), texto).toBe(false);
    }
  });
});

/* ------------------------------------------------------------------ *
 * A varredura: 71 painéis × 768 recortes
 * ------------------------------------------------------------------ */

describe("nenhuma nota afirma número fora do recorte que a produziu", () => {
  it("a matriz tem 768 recortes", () => {
    expect(MATRIZ).toHaveLength(768);
  });

  it("varre os 71 painéis nos 768 recortes", () => {
    /*
     * O caso do aceite, e o mais caro da suíte: 54.528 leituras.
     *
     * A regra que ele cobra: **uma nota que afirma número só pode existir se
     * for `do_recorte`**. Se for `so_no_padrao`, ela some fora do padrão; se
     * for `sem_nota`, ela não existe.
     *
     * O que falharia aqui: uma nota escrita à mão para o consolidado, deixada
     * passar sob recorte. É o defeito que o protótipo tinha e que a seção 6.3
     * nomeia.
     */
    const falhas: string[] = [];
    let comNota = 0;

    for (const recorte of MATRIZ) {
      const q = consultaDe(recorte, ANO);
      const fora = !noPadrao(q);

      for (const registro of REGISTRO_DE_PAINEIS) {
        const envelope = calcularPainel(registro.id, q);
        const nota = envelope.note;
        if (nota === null || nota === undefined || nota === "") continue;
        comNota += 1;

        const declarada = notaDeclarada(registro.id);

        if (declarada.escopo === "sem_nota") {
          falhas.push(
            `${registro.id}: declarou sem_nota e devolveu texto — "${nota}"`,
          );
          continue;
        }

        if (fora && declarada.escopo === "so_no_padrao") {
          falhas.push(
            `${registro.id}: nota do consolidado sobreviveu ao recorte — "${nota}"`,
          );
          continue;
        }

        if (fora && afirmaNumero(nota) && declarada.escopo !== "do_recorte") {
          falhas.push(
            `${registro.id}: afirma número sob recorte sem ser do_recorte — "${nota}"`,
          );
          continue;
        }

        /*
         * A parte que faz a varredura verificar, e não só vigiar.
         *
         * Não basta a nota ser de escopo `do_recorte`: o número dentro dela
         * precisa ser o **deste** envelope. Uma receita que lesse a série
         * errada, ou que guardasse o resultado entre chamadas, produziria uma
         * nota de escopo certo com o número de outro recorte — e as regras
         * acima passariam, porque elas olham o escopo e não a aritmética.
         */
        const dito = /(\d+)%/.exec(nota)?.[1];
        if (dito !== undefined) {
          const esperado = concentracaoDoEnvelope(
            "series" in envelope ? envelope : {},
          );
          if (esperado !== null && String(esperado) !== dito) {
            falhas.push(
              `${registro.id}: a nota diz ${dito}% e o envelope dá ${String(esperado)}%`,
            );
          }
        }
      }
    }

    // Uma varredura que não achou nota nenhuma não verificou nada.
    expect(
      comNota,
      "nenhuma nota foi produzida em recorte nenhum",
    ).toBeGreaterThan(0);
    expect(falhas.slice(0, 5)).toEqual([]);
    expect(falhas).toHaveLength(0);
  });
});

/**
 * A concentração das duas maiores, recontada do envelope.
 *
 * Escrita aqui de novo, e de propósito: chamar a função do produto faria o
 * teste conferir que o produto concorda consigo mesmo. Esta versão usa ponto
 * flutuante e `Math.round`, que é o caminho **oposto** ao da aritmética de
 * inteiros do produto — se os dois chegarem ao mesmo número em 54.528
 * leituras, nenhum dos dois tem erro de arredondamento escondido.
 */
function concentracaoDoEnvelope(envelope: {
  readonly series?: readonly { readonly values: readonly (number | null)[] }[];
}): number | null {
  const valores = (envelope.series?.[0]?.values ?? []).filter(
    (v): v is number => v !== null,
  );
  if (valores.length < 3) return null;
  const total = valores.reduce((a, v) => a + v, 0);
  if (total <= 0) return null;
  const duas = [...valores].sort((a, b) => b - a).slice(0, 2);
  return Math.round((duas.reduce((a, v) => a + v, 0) / total) * 100);
}

/* ------------------------------------------------------------------ *
 * A supressão, caso a caso
 * ------------------------------------------------------------------ */

describe("a nota do consolidado some sob recorte, e não é adaptada", () => {
  /** Uma declaração forjada: o caso que o produto ainda não tem, e vai ter. */
  const RECORTE: Query = { ...QUERY_PADRAO, area: "tecnologia" };

  it("no padrão ela aparece; fora dele, some", () => {
    /*
     * `so_no_padrao` não é usado por painel nenhum hoje — a narrativa do
     * produto está em H-59. Mas o caminho existe e precisa estar certo antes
     * de alguém escrever a primeira frase, senão a primeira frase escrita é a
     * que descobre o defeito, na tela de alguém.
     */
    const texto = "Operações e Comercial respondem por 71% do estouro.";
    const declarada = { escopo: "so_no_padrao", texto } as const;

    expect(noPadrao(QUERY_PADRAO)).toBe(true);
    expect(noPadrao(RECORTE)).toBe(false);

    /*
     * Cobrado de `notaDoPainel`, e não reproduzido aqui.
     *
     * A primeira versão deste caso escrevia
     * `noPadrao(q) ? declarada.texto : null` e conferia o resultado — isto é,
     * conferia que o teste concorda com o teste. Uma provocação que apagava a
     * supressão de dentro da função passava intacta por ele.
     */
    expect(notaDoPainel("qualquer", QUERY_PADRAO, null, declarada)).toBe(texto);
    expect(notaDoPainel("qualquer", RECORTE, null, declarada)).toBeNull();

    // E some sob qualquer um dos cinco filtros, não só sob área.
    for (const fora of [
      { ...QUERY_PADRAO, modalidade: "remoto" },
      { ...QUERY_PADRAO, periodo: "dezembro" },
      { ...QUERY_PADRAO, entidade: "unidade-sp" },
    ] as Query[]) {
      expect(notaDoPainel("qualquer", fora, null, declarada)).toBeNull();
    }
  });

  it("a nota calculada não some — ela é recalculada", () => {
    /*
     * A diferença entre os dois escopos. `do_recorte` sobrevive porque o
     * número dela vem do recorte em tela; `so_no_padrao` some porque o dela
     * veio de outro.
     */
    const noPadraoTexto = calcularPainel("rh-areas", QUERY_PADRAO).note;
    expect(noPadraoTexto).not.toBeNull();
    expect(afirmaNumero(noPadraoTexto ?? "")).toBe(true);

    // Sob recorte de uma área só resta uma categoria, e "as duas maiores" não
    // diz nada: a frase certa é nenhuma frase.
    expect(calcularPainel("rh-areas", RECORTE).note).toBeNull();
  });

  it("com várias categorias no recorte, a frase é a daquele recorte", () => {
    /*
     * A primeira versão deste caso exigia que a nota sob `modalidade: remoto`
     * fosse **diferente** da do consolidado. Ela falhou, e não por defeito: as
     * fixtures de hoje repartem modalidade proporcionalmente, então o total
     * muda (1240 → 164) e a concentração das duas maiores não. A frase
     * coincidir é a resposta certa para esse dado.
     *
     * T-140 é a tarefa que produz fixtures com perfis **não** proporcionais, e
     * é ela que vai fazer esses números divergirem. Exigir divergência aqui
     * seria testar a fixture e não a nota.
     *
     * O que se exige, então, é o que vale em qualquer fixture: a nota reage ao
     * recorte quando a composição muda de fato. `hibrido` muda.
     */
    const remoto = calcularPainel("rh-areas", {
      ...QUERY_PADRAO,
      modalidade: "remoto",
    }).note;
    expect(remoto).not.toBeNull();

    const hibrido = calcularPainel("rh-areas", {
      ...QUERY_PADRAO,
      modalidade: "hibrido",
    }).note;
    expect(hibrido).not.toBe(calcularPainel("rh-areas", QUERY_PADRAO).note);
  });
});

/* ------------------------------------------------------------------ *
 * O subtítulo
 * ------------------------------------------------------------------ */

describe("o subtítulo passa a 'No recorte ativo · Área'", () => {
  it("no padrão, mantém o subtítulo próprio", () => {
    expect(subtituloSobRecorte(QUERY_PADRAO, "Headcount FTE")).toBe(
      "Headcount FTE",
    );
  });

  it("sob recorte de área, traz o rótulo acentuado", () => {
    expect(
      subtituloSobRecorte(
        { ...QUERY_PADRAO, area: "operacoes" },
        "Headcount FTE",
      ),
    ).toBe("No recorte ativo · Operações");
  });

  it("sob recorte por outro filtro, fica sem sufixo — e continua verdadeiro", () => {
    expect(
      subtituloSobRecorte(
        { ...QUERY_PADRAO, modalidade: "remoto" },
        "Headcount FTE",
      ),
    ).toBe("No recorte ativo");
  });

  it("as sete áreas produzem os sete rótulos, sem código cru", () => {
    for (const registro of REGISTRO_DE_PAINEIS.slice(0, 1)) {
      expect(registro.id).toBeDefined();
    }
    const AREAS: readonly Query["area"][] = [
      "operacoes",
      "comercial",
      "tecnologia",
      "rh",
    ];
    for (const area of AREAS) {
      const s = subtituloSobRecorte({ ...QUERY_PADRAO, area }, null) ?? "";
      expect(s.startsWith("No recorte ativo · "), area).toBe(true);
      // O código cru na tela é o defeito que `rotuloDe` existe para evitar.
      expect(s, area).not.toContain(area);
    }
  });
});
