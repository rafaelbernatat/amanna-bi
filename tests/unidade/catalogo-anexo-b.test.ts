/**
 * O catálogo contra o Anexo B do PRD (T-113).
 *
 * O aceite: as 21 entradas trazem os nove campos preenchidos, com decisão
 * presente nas métricas discutidas, e **um teste cruza catálogo × Anexo B** que
 * falha se faltar métrica, se o destino não for uma das 13 telas ou se o painel
 * destacado não constar do registro dos 71 painéis.
 *
 * O Anexo B é lido **do PRD.md**, e não copiado para cá. É o mesmo princípio
 * dos outros registros: acrescentar uma intenção ao PRD faz a suíte avisar, em
 * vez de o catálogo ficar para trás em silêncio.
 *
 * ## O bloco que não estava no aceite
 *
 * O último `describe` confere que nenhuma entrada **afirma uma aprovação**. As
 * 21 foram escritas pela Engenharia sob a decisão de modo mockup, e a linha que
 * essa decisão não move é: inventar um número é permitido, inventar uma
 * assinatura não. Sem esse teste, a diferença entre "provisório" e "aprovado"
 * fica só na prosa do cabeçalho do YAML — e prosa não reprova build.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parse } from "yaml";
import { describe, expect, it } from "vitest";

import { MODULOS } from "@/apresentacao/navegacao/telas";
import { REGISTRO_DE_PAINEIS } from "@/semantica/paineis";
import { carregarCatalogo, type Metrica } from "@/semantica/catalogo";
import { ORIGEM_DOS_KPIS_CONSTANTES } from "@/semantica/origem-de-kpi";

const RAIZ = process.cwd();

/* ------------------------------------------------------------------ *
 * As duas fontes
 * ------------------------------------------------------------------ */

const CATALOGO: readonly Metrica[] = [
  ...carregarCatalogo(
    parse(readFileSync(resolve(RAIZ, "catalogo", "metricas.yaml"), "utf8")),
  ).values(),
];

/** Uma linha do Anexo B: a intenção, a métrica, o destino e o painel. */
type IntencaoDoAnexoB = {
  readonly numero: number;
  readonly intencao: string;
  readonly metrica: string;
  readonly destino: string;
  readonly painel: string;
};

function anexoB(): readonly IntencaoDoAnexoB[] {
  const prd = readFileSync(resolve(RAIZ, "PRD.md"), "utf8");
  const inicio = prd.indexOf("## Anexo B");
  const trecho = prd.slice(inicio, prd.indexOf("## Anexo C", inicio));
  const linhas: IntencaoDoAnexoB[] = [];
  for (const linha of trecho.split("\n")) {
    const m =
      /^\| (\d+) \| ([^|]+?) \| `([^`]+)` \| `([^`]+)` \| `([^`]+)` \|$/.exec(
        linha,
      );
    if (m === null) continue;
    linhas.push({
      numero: Number(m[1]),
      intencao: (m[2] ?? "").trim(),
      metrica: m[3] ?? "",
      destino: m[4] ?? "",
      painel: m[5] ?? "",
    });
  }
  return linhas;
}

const ANEXO_B = anexoB();

/** As 13 rotas do registro de navegação, sem a barra inicial. */
const TELAS = MODULOS.flatMap((mo) =>
  mo.telas.map((t) => `${mo.id}/${t.slug}`),
);
const PAINEIS = new Set(REGISTRO_DE_PAINEIS.map((p) => p.id));

describe("as duas fontes foram lidas — senão o resto não prova nada", () => {
  it("o Anexo B tem 21 intenções, numeradas de 1 a 21", () => {
    expect(ANEXO_B).toHaveLength(21);
    expect(ANEXO_B.map((i) => i.numero)).toEqual(
      Array.from({ length: 21 }, (_, i) => i + 1),
    );
  });

  it("o catálogo tem as 21 do Anexo B, e mais as do achado 5", () => {
    // Eram 21 quando T-113 as escreveu. T-148 acrescentou as do achado 5, e
    // este arquivo continua sendo sobre o Anexo B: o que importa aqui é que
    // as 21 estejam lá, não que nada mais esteja.
    expect(CATALOGO.length).toBeGreaterThanOrEqual(21);
  });

  it("e existem 13 telas e 71 painéis para cruzar contra", () => {
    expect(TELAS).toHaveLength(13);
    expect(PAINEIS.size).toBe(71);
  });
});

/* ------------------------------------------------------------------ *
 * O cruzamento que o aceite pede
 * ------------------------------------------------------------------ */

describe("catálogo × Anexo B", () => {
  it("nenhuma métrica do Anexo B falta no catálogo", () => {
    const ids = new Set(CATALOGO.map((m) => m.id));
    const faltando = ANEXO_B.filter((i) => !ids.has(i.metrica)).map(
      (i) => `${i.numero}. ${i.intencao} → ${i.metrica}`,
    );
    expect(faltando).toEqual([]);
  });

  it("e toda métrica fora do Anexo B é do achado 5 — nenhuma órfã", () => {
    /*
     * Este caso conferia "nada além do Anexo B", e o catálogo cresceu com
     * T-148. A versão forte da mesma preocupação: uma métrica que não é do
     * Anexo B **nem** do achado 5 não é alcançável por pergunta nenhuma e não
     * abre nenhum KPI — existe só no arquivo, e ninguém vai encontrá-la.
     */
    const doAnexo = new Set(ANEXO_B.map((i) => i.metrica));
    const doAchado = new Set(ORIGEM_DOS_KPIS_CONSTANTES.map((o) => o.metrica));

    /*
     * Uma terceira categoria, com um membro só e nomeado.
     *
     * `mediana_salarial` não abre KPI nenhum — é texto de **nota** do painel
     * `sal-faixas`, e por isso não está no registro de origens, que é de KPI.
     * Nota com número declara fórmula do mesmo jeito (PR-3, RF-09), então ela
     * pertence ao catálogo. Nomear a exceção em vez de abrir uma classe faz a
     * segunda aparecer no diff.
     */
    const DE_NOTA = new Set(["mediana_salarial"]);

    const orfas = CATALOGO.filter(
      (m) => !doAnexo.has(m.id) && !doAchado.has(m.id) && !DE_NOTA.has(m.id),
    ).map((m) => m.id);
    expect(orfas).toEqual([]);
  });

  it.each(ANEXO_B)(
    "$numero. $intencao: o destino é uma das 13 telas",
    ({ destino }) => {
      expect(TELAS).toContain(destino);
    },
  );

  it.each(ANEXO_B)(
    "$numero. $intencao: o painel destacado está no registro dos 71",
    ({ painel }) => {
      expect(PAINEIS.has(painel), painel).toBe(true);
    },
  );

  it("o painel destacado pertence à tela de destino", () => {
    /*
     * O aceite não pede isto com estas palavras, e sem isto o cruzamento passa
     * com um painel válido na tela errada — a IA navegaria para `fin/fat` e
     * destacaria um painel de `rh/visao`, que não está lá para ser destacado.
     */
    const fora = ANEXO_B.filter((i) => {
      const p = REGISTRO_DE_PAINEIS.find((x) => x.id === i.painel);
      return p !== undefined && p.tela !== i.destino;
    }).map(
      (i) => `${i.metrica}: ${i.painel} está em outra tela, não ${i.destino}`,
    );
    expect(fora).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * Os nove campos
 * ------------------------------------------------------------------ */

describe("as 21 entradas trazem os nove campos", () => {
  const OBRIGATORIOS = [
    "rotulo",
    "fonte",
    "formula",
    "unidade",
    "agg",
    "sentido",
    "grao_minimo",
    "sinonimos",
  ] as const;

  it.each(OBRIGATORIOS)("%s está preenchido nas 21", (campo) => {
    const vazios = CATALOGO.filter((m) => {
      const v = m[campo];
      if (v === undefined || v === null) return true;
      if (Array.isArray(v)) return v.length === 0;
      return String(v).trim() === "";
    }).map((m) => m.id);
    expect(vazios).toEqual([]);
  });

  it("o nono campo é `meta`, e ausência é decisão, não esquecimento", () => {
    // Meta é alvo acordado. Vinte não têm, e é correto: nenhum foi acordado.
    // A única presente é a de turnover, que o próprio PRD escreve na 9.4.
    const comMeta = CATALOGO.filter((m) => m.meta !== null).map((m) => m.id);
    expect(comMeta).toEqual(["turnover_12m"]);
    expect(CATALOGO.find((m) => m.id === "turnover_12m")?.meta).toBe(14.0);
  });

  it("toda fonte nomeia uma view da seção 10.1", () => {
    /*
     * A seção 10.1 lista seis views de fato mais `vw_dim_*`. Uma fonte que não
     * está lá é uma métrica que não tem de onde sair quando o banco chegar.
     *
     * `receita_por_fte` nomeia duas, separadas por vírgula: é a única que cruza
     * views, e é o módulo de Integração inteiro em uma métrica.
     */
    const prd = readFileSync(resolve(RAIZ, "PRD.md"), "utf8");
    const secao = prd.slice(prd.indexOf("### 10.1"), prd.indexOf("### 10.2"));
    const declaradas = new Set(
      [...secao.matchAll(/`(vw_[a-z_*]+)`/g)].map((m) => m[1] ?? ""),
    );
    expect(declaradas.size).toBeGreaterThan(5);

    const fora: string[] = [];
    for (const m of CATALOGO) {
      for (const v of m.fonte.split(",").map((x) => x.trim())) {
        // `vw_dim_*` cobre a família inteira de dimensões.
        const ok =
          declaradas.has(v) ||
          (declaradas.has("vw_dim_*") && v.startsWith("vw_dim_"));
        if (!ok) fora.push(`${m.id}: ${v}`);
      }
    }
    expect(fora).toEqual([]);
  });

  it("nenhuma unidade não-somável está declarada com agg sum", () => {
    // A regra 4 da seção 9.2, do lado do catálogo. O carregador já recusa isto;
    // aqui se confirma que nenhuma das 21 tropeçou nela.
    const NAO_SOMAVEIS = ["pct", "pp", "pontos", "anos"];
    const erradas = CATALOGO.filter(
      (m) => NAO_SOMAVEIS.includes(m.unidade) && m.agg === "sum",
    ).map((m) => m.id);
    expect(erradas).toEqual([]);
  });

  it("todo grão declarado respeita o piso da seção 11", () => {
    const PERMITIDAS = new Set([
      "area",
      "mes",
      "entidade",
      "centro_custo",
      "faixa",
      "modalidade",
      "uf",
    ]);
    const fora = CATALOGO.flatMap((m) =>
      m.grao_minimo
        .filter((d) => !PERMITIDAS.has(d))
        .map((d) => `${m.id}: ${d}`),
    );
    expect(fora).toEqual([]);
    // E todo grão cita o mês: não existe métrica sem tempo neste produto.
    const semMes = CATALOGO.filter((m) => !m.grao_minimo.includes("mes")).map(
      (m) => m.id,
    );
    expect(semMes).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * Nenhuma entrada afirma uma aprovação
 * ------------------------------------------------------------------ */

describe("as 21 são provisórias, e dizem isso", () => {
  it("toda entrada tem decisão escrita", () => {
    // Todas foram discutidas — pela Engenharia, ao escolher fórmula e sentido.
    // O campo é onde a escolha fica registrada para não voltar do zero.
    const sem = CATALOGO.filter(
      (m) => m.decisao === null || m.decisao.trim() === "",
    ).map((m) => m.id);
    expect(sem).toEqual([]);
  });

  it("toda decisão se declara provisória e cita a decisão que a autoriza", () => {
    const fora = CATALOGO.filter(
      (m) => !/PROVISORIO \(D-H03/.test(m.decisao ?? ""),
    ).map((m) => m.id);
    expect(fora).toEqual([]);
  });

  it("nenhuma decisão afirma que alguém aprovou", () => {
    /*
     * A linha que o modo mockup não move.
     *
     * Inventar um número é permitido; inventar uma assinatura não. A palavra
     * "aprovado" só pode aparecer negada — como em `turnover_12m`, que explica
     * que a aprovação citada no exemplo da seção 9.4 do PRD **não aconteceu**.
     */
    const suspeitas = CATALOGO.filter((m) => {
      const d = m.decisao ?? "";
      if (!/aprovad|assinad|homologad/i.test(d)) return false;
      // Negado é o uso legítimo: "Nao aprovado por", "aprovacao nao aconteceu".
      return !/(nao|não)\s+(aprovad|foi aprovad)|aprovacao nao aconteceu/i.test(
        d,
      );
    }).map((m) => m.id);
    expect(suspeitas).toEqual([]);
  });

  it("o exemplo da seção 9.4 do PRD não virou afirmação", () => {
    /*
     * A seção 9.4 escreve, como exemplo de preenchimento, "Aprovado por RH e
     * Controladoria em 2026-08". T-112 transcreveu o exemplo inteiro para o
     * catálogo — e ali ele deixa de ser ilustração e vira alegação. A seção 18
     * do mesmo PRD lista P2 como **pendente**, e H-06 continua aberto.
     */
    const turnover = CATALOGO.find((m) => m.id === "turnover_12m");
    expect(turnover?.decisao).toMatch(/H-06/);
    expect(turnover?.decisao).not.toMatch(/^Transferencia interna NAO conta/);

    const prd = readFileSync(resolve(RAIZ, "PRD.md"), "utf8");
    expect(prd).toContain("Aprovado por RH e Controladoria em 2026-08");
    expect(prd).toContain(
      "| P2 | Transferência interna conta como desligamento?",
    );
  });
});
