/**
 * Divisor zero como estado próprio (T-182, seção 13).
 *
 * Antes desta tarefa, denominador zero devolvia `sem_dado_no_recorte`. Passava
 * no princípio PR-4 — não era zero nem `NaN` — mas contava a história errada:
 *
 * | Motivo | O que aconteceu | O que a pessoa deve fazer |
 * |---|---|---|
 * | `sem_dado_no_recorte` | a consulta é válida e não veio linha | ampliar o recorte |
 * | `denominador_zero` | veio linha, e o divisor é zero | nada — a taxa não existe aqui |
 *
 * "Turnover da área com zero pessoas no quadro" tem numerador legítimo e
 * nenhuma base sobre a qual dividir. Ampliar o recorte não resolve, e sugerir
 * isso manda tentar de novo o que não vai dar certo — o pior tipo de mensagem
 * de erro.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parse } from "yaml";
import { describe, expect, it } from "vitest";

import { agregar, type Ponto } from "@/semantica/agregacao";
import { carregarCatalogo } from "@/semantica/catalogo";
import {
  dividir,
  MOTIVOS_DE_VAZIO,
  temValor,
  type MotivoDeVazio,
} from "@/semantica/vazio";

describe("o enum fechado cresceu por decisão", () => {
  it("tem cinco motivos, e `denominador_zero` é um deles", () => {
    expect(MOTIVOS_DE_VAZIO.length).toBe(5);
    expect(MOTIVOS_DE_VAZIO).toContain("denominador_zero");
  });
});

describe("dividir", () => {
  it("divisor zero devolve `denominador_zero`, não `sem_dado_no_recorte`", () => {
    const r = dividir(5, 0);
    expect(r.vazio).toBe(true);
    if (r.vazio) expect(r.motivo).toBe("denominador_zero");
  });

  it("nunca devolve Infinity, NaN nem 0", () => {
    // A seção 13 é explícita: nunca há divisão por zero visível. Os três
    // valores abaixo são os três jeitos de ela ficar visível.
    for (const [n, d] of [
      [5, 0],
      [-5, 0],
      [0, 0],
      [5, Number.NaN],
      [5, Number.POSITIVE_INFINITY],
    ]) {
      const r = dividir(n as number, d as number);
      expect(r.vazio).toBe(true);
      if (!r.vazio) {
        expect(Number.isFinite(r.valor)).toBe(true);
      }
    }
  });

  it("numerador corrompido culpa a fonte, não o divisor", () => {
    // `NaN / 4` não é divisão por zero: é dado estragado chegando do
    // adaptador. Atribuir isso a `denominador_zero` mandaria quem depura
    // olhar o divisor, que está perfeito.
    const r = dividir(Number.NaN, 4);
    expect(r.vazio).toBe(true);
    if (r.vazio) expect(r.motivo).toBe("fonte_indisponivel");
  });

  it("divisão normal continua devolvendo valor", () => {
    // Sem isto, uma função que sempre devolvesse vazio passaria em tudo acima.
    const r = dividir(3, 4);
    expect(temValor(r)).toBe(true);
    if (temValor(r)) expect(r.valor).toBe(0.75);
  });

  it("o motivo continua podendo ser sobrescrito por quem sabe mais", () => {
    // A camada de perfil precisa devolver `fora_do_perfil` mesmo quando o
    // cálculo por baixo foi uma divisão.
    const r = dividir(1, 0, "fora_do_perfil");
    if (r.vazio) expect(r.motivo).toBe("fora_do_perfil");
  });
});

describe("agregação ratio com denominador zero", () => {
  it("devolve `denominador_zero` quando a soma dos divisores é zero", () => {
    const pontos: readonly Ponto[] = [
      { mes: "out", valor: null, numerador: 5, denominador: 0 },
      { mes: "nov", valor: null, numerador: 3, denominador: 0 },
    ];
    const r = agregar(pontos, "ratio", "pct");
    expect(r.vazio).toBe(true);
    if (r.vazio) expect(r.motivo).toBe("denominador_zero");
  });

  it("distingue de 'não veio ponto nenhum'", () => {
    // Os dois casos devolvem vazio; a diferença é o que a tela vai dizer.
    const semPonto = agregar([], "ratio", "pct");
    if (semPonto.vazio) expect(semPonto.motivo).toBe("sem_dado_no_recorte");
  });

  it("denominadores que somam diferente de zero continuam dividindo", () => {
    const pontos: readonly Ponto[] = [
      { mes: "out", valor: null, numerador: 5, denominador: 0 },
      { mes: "nov", valor: null, numerador: 3, denominador: 100 },
    ];
    const r = agregar(pontos, "ratio", "pct");
    expect(temValor(r)).toBe(true);
    // 8 / 100 — uma divisão só, no fim, e não a média das divisões mensais.
    if (temValor(r)) expect(r.valor).toBeCloseTo(0.08, 10);
  });
});

describe("toda métrica ratio do catálogo, com divisor zero", () => {
  /**
   * O aceite pede que a suíte percorra **todas** as métricas `ratio`.
   *
   * Hoje o catálogo tem uma — as outras 35 esperam H-08. Percorrê-lo em vez de
   * testar `turnover_12m` por nome é o que faz este teste crescer sozinho
   * quando o catálogo crescer, em vez de continuar cobrindo uma métrica só
   * enquanto o resto entra sem rede.
   */
  const catalogo = carregarCatalogo(
    parse(
      readFileSync(
        resolve(__dirname, "..", "..", "catalogo", "metricas.yaml"),
        "utf8",
      ),
    ),
  );

  const ratios = [...catalogo.values()].filter((m) => m.agg === "ratio");

  it("há ao menos uma para percorrer", () => {
    // Guarda contra o vácuo: `it.each([])` não roda nada e não falha.
    expect(ratios.length).toBeGreaterThan(0);
  });

  it.each(ratios.map((m) => m.id))(
    "%s: divisor zero devolve vazio com motivo, nunca 0",
    (id) => {
      const m = catalogo.get(id);
      expect(m).toBeDefined();

      const r = agregar(
        [{ mes: "dez", valor: null, numerador: 12, denominador: 0 }],
        "ratio",
        m!.unidade,
      );

      expect(r.vazio).toBe(true);
      if (r.vazio) expect(r.motivo).toBe("denominador_zero");
      // O ponto do PR-4: o valor não é 0, e não existe caminho que o produza.
      expect(Object.hasOwn(r, "valor")).toBe(false);
    },
  );
});

describe("o estado de tela do divisor zero", () => {
  /**
   * O texto vive em `SemDado` (T-130). Aqui se prova a regra que não dá para
   * ver olhando o componente: que todo motivo do enum tem texto próprio.
   */
  it("todo motivo do enum tem entrada em SemDado", async () => {
    // Se um motivo novo entrar sem texto, o `tsc` já reprova — o `Record` é
    // fechado sobre `MotivoDeVazio`. Este teste é a rede para o dia em que
    // alguém trocar o `Record` por um mapa parcial.
    const mod: Record<string, unknown> =
      await import("@/apresentacao/graficos/SemDado");
    expect(mod["SemDado"]).toBeTypeOf("function");

    const fonte = readFileSync(
      resolve(
        __dirname,
        "..",
        "..",
        "src",
        "apresentacao",
        "graficos",
        "SemDado.tsx",
      ),
      "utf8",
    );
    for (const motivo of MOTIVOS_DE_VAZIO satisfies readonly MotivoDeVazio[]) {
      expect(fonte).toContain(`${motivo}:`);
    }
  });

  it("nem 0 nem traço mudo aparecem como texto de vazio", () => {
    const fonte = readFileSync(
      resolve(
        __dirname,
        "..",
        "..",
        "src",
        "apresentacao",
        "graficos",
        "SemDado.tsx",
      ),
      "utf8",
    );
    // O aceite: "nunca 0, nunca traço mudo". Um título que fosse só "—" ou
    // "0" é exatamente o que faz a pessoa ler ausência como zero.
    expect(fonte).not.toMatch(/titulo:\s*"[-–—0\s]*"/);
  });

  it("divisor zero não oferece o atalho de ampliar recorte", () => {
    // Ampliar não faz o divisor deixar de ser zero. Oferecer o atalho manda
    // tentar de novo o que não vai dar certo.
    const fonte = readFileSync(
      resolve(
        __dirname,
        "..",
        "..",
        "src",
        "apresentacao",
        "graficos",
        "SemDado.tsx",
      ),
      "utf8",
    );
    expect(fonte).toContain("SEM_ATALHO_DE_AMPLIAR");
    expect(fonte).toMatch(/SEM_ATALHO_DE_AMPLIAR[\s\S]{0,120}denominador_zero/);
  });
});
