/**
 * O controle negativo da suíte, e o perfil não proporcional que o sustenta
 * (T-140).
 *
 * ## As duas metades são a mesma tarefa
 *
 * A suíte de contrato percorre 768 recortes e volta verde. Verde sobre o quê?
 * Se ela passasse igual num adaptador que reproduz o `fctx()` do protótipo — ler
 * o consolidado e multiplicar por um fator — o verde não estaria dizendo "o
 * dado reconcilia", estaria dizendo "a suíte não olha".
 *
 * E ela **só** consegue notar a diferença se o dado tiver perfis diferentes por
 * medida. Num dataset onde a Unidade SP tem 62% de tudo, multiplicar por 0,62 e
 * somar as linhas dão o mesmo resultado, e o controle negativo passaria. Por
 * isso o aceite pede as duas coisas na mesma tarefa: sem o perfil variado o
 * controle não prova nada, e sem o controle o perfil variado não está provando
 * nada.
 *
 * ## O que este arquivo afirma
 *
 * 1. as fatias de entidade e de área diferem **entre medidas** e **entre
 *    meses** — Unidade SP tem 62,7% do quadro e 68,0% da folha; Tecnologia tem
 *    13,2% do quadro e 22,0% da folha;
 * 2. a fonte real passa a suíte nos recortes escolhidos — o controle positivo,
 *    sem o qual "o mutante reprova" não significa nada;
 * 3. o mutante **reprova** em entidade, área e modalidade;
 * 4. e o que **ainda não** é verdade está escrito como caso que passa hoje e
 *    vai reprovar quando for tratado.
 *
 * ## Sobre os casos que afirmam um defeito
 *
 * Os dois últimos blocos afirmam que a modalidade ainda se reparte por
 * proporção, que a folha ainda é constante nos doze meses, e que a suíte ainda
 * não distingue recortar de escalar no período e no ano. São medições do estado
 * de hoje, não desejos.
 *
 * Escritos assim porque a alternativa é pior: um `skip` some do relatório, e um
 * comentário não reprova nada. Quando T-140.2 der perfil sazonal às fixtures e
 * T-152 trouxer o ano de 2025, estes casos ficam **vermelhos** — e quem estiver
 * mexendo é obrigado a vir aqui apertar a afirmação, em vez de descobrir meses
 * depois que a suíte estava cega numa dimensão.
 */

import { describe, expect, it } from "vitest";

import { criarFonteDeFixtures } from "@/acesso/fixtures/adaptador";
import { VW_FATO_FIN_MES } from "@/acesso/fixtures/fin";
import { VW_FATO_RH_MES } from "@/acesso/fixtures/rh";
import { criarFonteDeMutacao } from "@/acesso/contrato/mutacao";
import "@/acesso/contrato/registrar";
import { rodarSuite } from "@/acesso/contrato/suite";
import type { Falha } from "@/acesso/contrato/suite";
import type { Recorte } from "@/semantica/recortes";

const ANO = "2026";

/* ------------------------------------------------------------------ *
 * O perfil não proporcional
 * ------------------------------------------------------------------ */

type Linha = Record<string, string | number>;

/** A fatia de um valor de dimensão numa medida, mês a mês. */
function fatiaPorMes(
  linhas: readonly Linha[],
  dimensao: string,
  valor: string,
  medida: string,
): readonly number[] {
  const meses = [...new Set(linhas.map((l) => String(l["mes"])))].sort();
  return meses
    .map((mes) => {
      const doMes = linhas.filter((l) => l["mes"] === mes);
      const total = doMes.reduce((a, l) => a + Number(l[medida] ?? 0), 0);
      const parte = doMes
        .filter((l) => l[dimensao] === valor)
        .reduce((a, l) => a + Number(l[medida] ?? 0), 0);
      return total === 0 ? Number.NaN : parte / total;
    })
    .filter((v) => !Number.isNaN(v));
}

/**
 * A fatia no ano: soma da parte sobre soma do total.
 *
 * E nao a media das fatias mensais. As duas parecem a mesma coisa e nao sao: em
 * medida de contagem pequena — admissoes tem 15 a 25 por mes na empresa
 * inteira — a fatia de um mes pula de 0,08 a 0,20 por causa de uma pessoa, e a
 * media desses pulos carrega esse ruido para dentro da comparacao.
 *
 * Aqui isso importava de verdade: pela media, a modalidade parecia divergir 2,9
 * pontos entre medidas; pela razao anual, diverge 0,6. A segunda e a que
 * responde a pergunta que o aceite faz — se um fator fixo por dimensao
 * reproduz o perfil —, porque e o perfil do ano que o fator tentaria imitar.
 *
 * A variacao entre meses continua sendo medida, e no bloco proprio dela.
 */
function fatiaAnual(
  linhas: readonly Linha[],
  dimensao: string,
  valor: string,
  medida: string,
): number {
  const total = linhas.reduce((a, l) => a + Number(l[medida] ?? 0), 0);
  const parte = linhas
    .filter((l) => l[dimensao] === valor)
    .reduce((a, l) => a + Number(l[medida] ?? 0), 0);
  return total === 0 ? Number.NaN : parte / total;
}

function amplitude(valores: readonly number[]): number {
  return Math.max(...valores) - Math.min(...valores);
}

const RH = VW_FATO_RH_MES as readonly Linha[];
const FIN = VW_FATO_FIN_MES as readonly Linha[];

/**
 * Quanto duas medidas precisam divergir para o fator único errar de forma
 * visível.
 *
 * Um ponto percentual. Abaixo disso a diferença some no arredondamento de um
 * painel em milhões, e o controle negativo passaria a depender de sorte.
 */
const DIVERGENCIA_MINIMA = 0.01;

/**
 * Quanto a fatia precisa variar ao longo do ano.
 *
 * Meio ponto percentual entre o menor e o maior mês. É pouco em proporção e é
 * o bastante para a soma de doze meses não ser o total vezes uma constante —
 * que é o que separa "recortar" de "escalar".
 */
const VARIACAO_MINIMA_ENTRE_MESES = 0.005;

describe("as fatias diferem entre medidas", () => {
  const CASOS = [
    {
      nome: "entidade · Unidade SP no quadro e na folha",
      dimensao: "entidade",
      valor: "unidade-sp",
      medidas: ["headcountFte", "salarios"],
    },
    {
      nome: "entidade · Unidade SP no quadro e nas admissões",
      dimensao: "entidade",
      valor: "unidade-sp",
      medidas: ["headcountFte", "admissoes"],
    },
    {
      nome: "área · Tecnologia no quadro e na folha",
      dimensao: "area",
      valor: "tecnologia",
      medidas: ["headcountFte", "salarios"],
    },
    {
      nome: "área · Tecnologia no quadro e nos desligamentos",
      dimensao: "area",
      valor: "tecnologia",
      medidas: ["headcountFte", "desligamentos"],
    },
  ] as const;

  it.each(CASOS)("$nome", ({ dimensao, valor, medidas }) => {
    const [uma, outra] = medidas;
    const a = fatiaAnual(RH, dimensao, valor, uma);
    const b = fatiaAnual(RH, dimensao, valor, outra);

    expect(
      Math.abs(a - b),
      `${valor} tem a mesma fatia em ${uma} (${String(a)}) e em ${outra} (${String(b)})`,
    ).toBeGreaterThan(DIVERGENCIA_MINIMA);
  });

  it("o ranking de áreas muda conforme a medida", () => {
    const porMedida = (medida: string): readonly string[] => {
      const areas = [...new Set(RH.map((l) => String(l["area"])))];
      return areas
        .map((area) => ({
          area,
          v: RH.filter((l) => l["area"] === area).reduce(
            (a, l) => a + Number(l[medida] ?? 0),
            0,
          ),
        }))
        .sort((x, y) => y.v - x.v)
        .map((x) => x.area);
    };

    // Tecnologia é a 3ª em quadro e a 2ª em folha: paga mais por cabeça.
    expect(porMedida("headcountFte")).not.toEqual(porMedida("salarios"));
  });
});

describe("as fatias diferem entre meses", () => {
  const CASOS = [
    {
      nome: "entidade no quadro",
      d: "entidade",
      v: "unidade-sp",
      m: "headcountFte",
    },
    {
      nome: "entidade nas admissões",
      d: "entidade",
      v: "unidade-sp",
      m: "admissoes",
    },
    {
      nome: "entidade nos desligamentos",
      d: "entidade",
      v: "unidade-sp",
      m: "desligamentos",
    },
    { nome: "área no quadro", d: "area", v: "tecnologia", m: "headcountFte" },
    {
      nome: "área nos desligamentos",
      d: "area",
      v: "tecnologia",
      m: "desligamentos",
    },
  ] as const;

  it.each(CASOS)("$nome varia ao longo do ano", ({ d, v, m }) => {
    const serie = fatiaPorMes(RH, d, v, m);
    expect(serie.length).toBeGreaterThan(1);
    expect(
      amplitude(serie),
      `a fatia de ${v} em ${m} é a mesma nos 12 meses`,
    ).toBeGreaterThan(VARIACAO_MINIMA_ENTRE_MESES);
  });
});

describe("o que a repartição de hoje ainda deixa plano", () => {
  /*
   * `repartirMatriz` respeita as duas margens distribuindo o interior por
   * independência: `célula = linha × coluna / total`. É a solução proporcional,
   * e proporcional é justamente o que não distingue recortar de escalar. Dar
   * perfil sazonal ao interior é T-140.2.
   */

  it("a modalidade se reparte igual em toda medida — T-140.2", () => {
    const fatias = ["headcountFte", "salarios", "desligamentos", "admissoes"]
      .map((m) => fatiaAnual(RH, "modalidade", "remoto", m))
      .filter((v) => !Number.isNaN(v));

    expect(
      amplitude(fatias),
      "a modalidade deixou de ser proporcional: aperte este caso e mova-o para o bloco de cima",
    ).toBeLessThan(DIVERGENCIA_MINIMA);
  });

  it("a folha reparte-se por constante nos doze meses — T-140.2", () => {
    const serie = fatiaPorMes(RH, "entidade", "unidade-sp", "salarios");
    expect(
      amplitude(serie),
      "a folha passou a variar entre meses: aperte este caso",
    ).toBeLessThan(VARIACAO_MINIMA_ENTRE_MESES);
  });

  it("a receita também — T-140.2", () => {
    const serie = fatiaPorMes(FIN, "entidade", "unidade-sp", "receitaLiquida");
    expect(
      amplitude(serie),
      "a receita passou a variar entre meses: aperte este caso",
    ).toBeLessThan(VARIACAO_MINIMA_ENTRE_MESES);
  });
});

/* ------------------------------------------------------------------ *
 * O controle
 * ------------------------------------------------------------------ */

/**
 * Um recorte por dimensão, mais o consolidado.
 *
 * A matriz inteira tem 768 recortes e a suíte leva dezenas de segundos nela — o
 * que é certo para `npm run contrato` e caro para um caso de unidade. O aceite
 * pede "pelo menos um recorte de cada uma das cinco dimensões", e é isto:
 * recortes que mexem numa dimensão cada, e o padrão como referência.
 */
const PADRAO: Recorte = {
  periodo: "12-meses",
  ano: ANO,
  entidade: "consolidado",
  area: "todas",
  modalidade: "todas",
};

const VISTAS: readonly {
  readonly dimensao: string;
  readonly recorte: Recorte;
}[] = [
  { dimensao: "entidade", recorte: { ...PADRAO, entidade: "unidade-sp" } },
  { dimensao: "area", recorte: { ...PADRAO, area: "tecnologia" } },
  { dimensao: "modalidade", recorte: { ...PADRAO, modalidade: "remoto" } },
];

const CEGAS: readonly {
  readonly dimensao: string;
  readonly recorte: Recorte;
  readonly quemTrata: string;
}[] = [
  {
    dimensao: "periodo",
    recorte: { ...PADRAO, periodo: "6-meses" },
    quemTrata: "T-140.2",
  },
  { dimensao: "ano", recorte: { ...PADRAO, ano: "2025" }, quemTrata: "T-152" },
];

const FIXTURES = criarFonteDeFixtures();
const MUTANTE = criarFonteDeMutacao(FIXTURES);

/** Só as falhas de regra: percurso quebrado é outro defeito, e não este. */
function falhasDeRegra(falhas: readonly Falha[]): readonly Falha[] {
  return falhas.filter((f) => f.regra > 0);
}

describe("controle positivo: a fonte real passa", () => {
  it.each([{ dimensao: "padrão", recorte: PADRAO }, ...VISTAS])(
    "a suíte não acha falha de regra no recorte de $dimensao",
    async ({ recorte }) => {
      const r = await rodarSuite(FIXTURES, "fixtures", [recorte], ANO);
      expect(r.verificacoes).toBeGreaterThan(0);
      expect(falhasDeRegra(r.falhas)).toEqual([]);
    },
  );
});

describe("controle negativo: o mutante reprova", () => {
  it("o consolidado passa também no mutante, e é isso que o torna traiçoeiro", async () => {
    /*
     * No recorte padrão o fator é 1: o mutante lê o consolidado e devolve o
     * consolidado. Se a suíte reprovasse aqui, ela estaria acusando o adaptador
     * pelo motivo errado, e os casos abaixo não provariam nada sobre recorte.
     */
    const r = await rodarSuite(MUTANTE, "mutacao", [PADRAO], ANO);
    expect(falhasDeRegra(r.falhas)).toEqual([]);
  });

  it.each(VISTAS)(
    "a suíte reprova o mutante no recorte de $dimensao",
    async ({ dimensao, recorte }) => {
      const r = await rodarSuite(MUTANTE, "mutacao", [recorte], ANO);
      expect(
        falhasDeRegra(r.falhas).length,
        `o mutante passou no recorte de ${dimensao} — a suíte não distingue recortar de escalar nesta dimensão`,
      ).toBeGreaterThan(0);
    },
  );
});

describe("as dimensões em que a suíte ainda não distingue recorte de escala", () => {
  /*
   * Medição do estado de hoje, com a tarefa que trata cada uma escrita ao lado.
   *
   * **Período** — a fatia de cada dimensão é constante nos doze meses, então
   * somar seis meses de um recorte e escalar o consolidado dão o mesmo número.
   * Passa a ser distinguível quando T-140.2 der perfil sazonal ao interior.
   *
   * **Ano** — só 2026 existe nas fixtures. Um recorte de 2025 volta vazio nos
   * dois adaptadores, e vazio igual não distingue nada. T-152 traz 2025.
   */
  it.each(CEGAS)(
    "o mutante ainda passa no recorte de $dimensao — $quemTrata",
    async ({ dimensao, recorte, quemTrata }) => {
      const r = await rodarSuite(MUTANTE, "mutacao", [recorte], ANO);
      expect(
        falhasDeRegra(r.falhas),
        `a suíte passou a enxergar ${dimensao}: ${quemTrata} entregou, e este caso precisa virar uma exigência no bloco de cima`,
      ).toEqual([]);
    },
  );

  it("três das cinco dimensões já estão cobertas", () => {
    // A contagem escrita é o que obriga a decisão a passar por aqui quando a
    // quarta entrar, em vez de a lista crescer sozinha e ninguém notar.
    expect(VISTAS).toHaveLength(3);
    expect(CEGAS).toHaveLength(2);
  });
});
