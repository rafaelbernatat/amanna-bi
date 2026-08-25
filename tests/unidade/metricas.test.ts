/**
 * `getMetric` — o catálogo respondendo por número (T-120).
 *
 * O aceite pede duas coisas:
 *
 * 1. **valor, unidade, fórmula e série** nas 21 métricas do Anexo B × 4
 *    períodos × 3 entidades — 252 combinações;
 * 2. **métrica fora do catálogo devolve recusa tipada** com ao menos duas
 *    métricas próximas.
 *
 * O Anexo B é lido **do PRD.md**, e não copiado para cá — mesmo princípio do
 * teste de T-113: uma lista transcrita concorda com o documento no dia em que
 * foi escrita e nunca mais.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  calcularMetrica,
  MetricaDesconhecida,
  metricasDoCatalogo,
  metricasProximas,
} from "@/acesso/fixtures/metricas";
import { metricasComCalculo } from "@/acesso/fixtures/kpis";
import { MESES_DO_PERIODO } from "@/acesso/fixtures/recorte";
import { CATALOGO_GERADO } from "@/semantica/catalogo-gerado";
import type { Query } from "@/semantica/contrato";

const BASE: Query = {
  entidade: "consolidado",
  area: "todas",
  modalidade: "todas",
  periodo: "12-meses",
  ano: "2026",
};

const PERIODOS = ["12-meses", "6-meses", "4-trimestre", "dezembro"] as const;
const ENTIDADES = ["consolidado", "unidade-sp", "demais-unidades"] as const;

/**
 * As métricas do Anexo B, lidas do PRD.
 *
 * A tabela do anexo tem uma linha por intenção, e a métrica é a segunda coluna
 * entre crases. Ler daqui em vez de copiar é o que faz este teste continuar
 * verdadeiro quando o anexo mudar.
 */
function metricasDoAnexoB(): readonly string[] {
  const prd = readFileSync("PRD.md", "utf8");
  const inicio = prd.indexOf("## Anexo B");
  expect(inicio, "Anexo B não encontrado no PRD").toBeGreaterThan(0);

  const bloco = prd.slice(inicio, prd.indexOf("\n## ", inicio + 1));
  const doCatalogo = new Set(metricasDoCatalogo());
  const encontradas: string[] = [];

  for (const achado of bloco.matchAll(/`([a-z0-9_]+)`/g)) {
    const id = achado[1] ?? "";
    if (doCatalogo.has(id) && !encontradas.includes(id)) encontradas.push(id);
  }
  return encontradas;
}

const ANEXO_B = metricasDoAnexoB();

/* ------------------------------------------------------------------ *
 * As 21 × 4 × 3
 * ------------------------------------------------------------------ */

describe("as 21 métricas do Anexo B respondem", () => {
  it("são 21, lidas do PRD e não copiadas", () => {
    expect(ANEXO_B).toHaveLength(21);
  });

  it.each(
    ANEXO_B.flatMap((id) =>
      PERIODOS.flatMap((periodo) =>
        ENTIDADES.map((entidade) => [id, periodo, entidade] as const),
      ),
    ),
  )(
    "%s em %s · %s traz valor, unidade, fórmula e série",
    (id, periodo, entidade) => {
      const m = calcularMetrica(id, { ...BASE, periodo, entidade });
      const doCatalogo = CATALOGO_GERADO[id];

      expect(m.id).toBe(id);
      expect(m.unit).toBe(doCatalogo?.unidade);
      expect(m.formula).toBe(doCatalogo?.formula);
      expect(m.agg).toBe(doCatalogo?.agg);
      expect(m.sentido).toBe(doCatalogo?.sentido);
      expect(m.formula.trim().length).toBeGreaterThan(0);

      // A série tem um ponto por mês da janela — a mesma construção do sparkline
      // do cartão e das categorias do painel.
      expect(m.serie.values).toHaveLength(MESES_DO_PERIODO[periodo] ?? -1);
      expect(m.serie.name).toBe(doCatalogo?.rotulo);

      // E o número existe: nenhuma das 21 fica sem valor nestes recortes.
      expect(m.value, `${id} · ${periodo} · ${entidade}`).not.toBeNull();
    },
  );

  it("o valor responde ao recorte de entidade", () => {
    /*
     * A checagem que o laço acima não faz: ele confere que há valor, não que o
     * valor muda. Sem isto, uma métrica que ignora o filtro passaria nas 252
     * combinações.
     *
     * Nem todas mudam — as de Financeiro sob área, por exemplo, não têm por
     * onde (H-04). Mas sob **entidade** todas as views têm a chave, e ficar
     * igual seria defeito.
     */
    const iguais = ANEXO_B.filter((id) => {
      const todos = calcularMetrica(id, BASE).value;
      const sp = calcularMetrica(id, { ...BASE, entidade: "unidade-sp" }).value;
      return todos === sp;
    });

    /*
     * As cinco que sobram, e por que cada grupo sobra.
     *
     * **Razões que escalam junto:** `crescimento_yoy` e `inadimplencia` têm
     * numerador e denominador divididos pela mesma fatia de entidade, e uma
     * razão não muda quando os dois lados escalam junto. É limitação da
     * fixture, não do contrato — com dado real a inadimplência de SP difere.
     *
     * **Views sem a chave:** `horas_treinamento` sai do LMS,
     * `tempo_fechamento` e `vagas_status` saem do ATS, e nenhuma das duas views
     * carrega entidade (seção 10.1). Filtrar por unidade não tem o que filtrar,
     * e mostrar o total é mais honesto que mostrar zero.
     *
     * A lista é fixada, e não derivada, de propósito: se uma métrica NOVA
     * parar de reagir ao filtro, ela aparece aqui e o teste reprova. Derivar a
     * lista do próprio resultado faria o teste concordar com qualquer coisa.
     */
    expect(iguais.sort()).toEqual(
      [
        "crescimento_yoy",
        "horas_treinamento",
        "inadimplencia",
        "tempo_fechamento",
        "vagas_status",
      ].sort(),
    );
  });

  it("o valor responde ao recorte de período", () => {
    // Métrica de fluxo em três meses tem de ser menor que em doze. É o teste
    // que pega o filtro que existe na barra e não chega ao dado (achado 6).
    const doze = calcularMetrica("folha_total", BASE).value ?? 0;
    const tri = calcularMetrica("folha_total", {
      ...BASE,
      periodo: "4-trimestre",
    }).value;
    expect(tri ?? 0).toBeLessThan(doze);
    expect(tri ?? 0).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ *
 * O catálogo inteiro, e não só o Anexo B
 * ------------------------------------------------------------------ */

describe("o catálogo não promete o que não entrega", () => {
  it("toda métrica do catálogo sabe se calcular", () => {
    /*
     * Seis não sabiam antes de T-120 — as três distribuições, o perfil do
     * quadro, a margem EBITDA e a mediana salarial. Nenhuma delas vira cartão,
     * e foi por isso que faltaram: `CALCULO` cresceu junto com os KPIs.
     *
     * `getMetric` responde ao catálogo inteiro, então a lacuna deixou de ser
     * teórica: era uma pergunta legítima do chat batendo em erro.
     */
    const com = new Set(metricasComCalculo());
    const sem = metricasDoCatalogo().filter((id) => !com.has(id));
    expect(sem).toEqual([]);
  });

  it.each(metricasDoCatalogo())("%s responde no recorte padrão", (id) => {
    const m = calcularMetrica(id, BASE);
    expect(m.id).toBe(id);
    expect(m.serie.values).toHaveLength(12);
  });

  it("o módulo derivado tem as mesmas métricas que o YAML", () => {
    /*
     * `npm run catalogo:check` compara byte a byte na build. Aqui a checagem é
     * mais grossa e serve a outro propósito: garantir que o módulo carregado
     * pelo produto é o mesmo conjunto que o resto da suíte lê do YAML — se
     * alguém trocar o gerador por uma cópia manual, isto reprova.
     */
    const doYaml = readFileSync("catalogo/metricas.yaml", "utf8");
    for (const id of metricasDoCatalogo()) {
      expect(doYaml, `${id} não está no YAML`).toContain(`\n${id}:`);
    }
  });
});

/* ------------------------------------------------------------------ *
 * A recusa
 * ------------------------------------------------------------------ */

describe("métrica fora do catálogo recusa, com saída", () => {
  it("a recusa é tipada, e não um erro genérico", () => {
    expect(() => calcularMetrica("nao_existe", BASE)).toThrowError(
      MetricaDesconhecida,
    );
  });

  it("carrega ao menos duas métricas próximas", () => {
    try {
      calcularMetrica("nao_existe", BASE);
      expect.unreachable("deveria ter recusado");
    } catch (erro) {
      expect(erro).toBeInstanceOf(MetricaDesconhecida);
      if (!(erro instanceof MetricaDesconhecida)) return;
      expect(erro.proximas.length).toBeGreaterThanOrEqual(2);
      expect(erro.pedida).toBe("nao_existe");
      // E as sugestões existem de verdade — sugerir o que não existe seria
      // mandar a pessoa bater na mesma porta.
      const doCatalogo = new Set(metricasDoCatalogo());
      for (const p of erro.proximas) expect(doCatalogo.has(p)).toBe(true);
    }
  });

  it("a mensagem nomeia o que foi pedido e o que sugerir", () => {
    // Recusa que não diz o que se pediu obriga a pessoa a adivinhar se o
    // sistema entendeu a pergunta.
    try {
      calcularMetrica("rotatividade", BASE);
      expect.unreachable("deveria ter recusado");
    } catch (erro) {
      expect(String(erro)).toContain("rotatividade");
      expect(String(erro)).toContain("turnover_12m");
    }
  });

  /*
   * O caso que faz os sinônimos valerem a pena.
   *
   * `rotatividade` não tem uma letra em comum com `turnover_12m`. Uma busca
   * por proximidade de texto sobre os ids erraria em português — e é para isso
   * que a seção 9.4 exige o campo `sinonimos` em toda métrica.
   */
  it.each([
    ["rotatividade", "turnover_12m"],
    ["quem sai", "turnover_12m"],
    ["quem fica", "retencao_12m"],
    ["folha", "folha_total"],
    ["quadro", "headcount_fte"],
  ])("%s sugere %s em primeiro lugar", (pedido, esperado) => {
    expect(metricasProximas(pedido)[0]).toBe(esperado);
  });

  it("id exato do catálogo não é sugestão: é resposta", () => {
    // O contraste. Se `turnover_12m` caísse na busca por proximidade, o chat
    // perguntaria "você quis dizer turnover_12m?" para quem digitou
    // turnover_12m.
    expect(() => calcularMetrica("turnover_12m", BASE)).not.toThrow();
  });
});
