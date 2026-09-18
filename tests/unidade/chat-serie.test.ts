import { beforeAll, describe, expect, it } from "vitest";

import { mesesDoRecorte } from "@/acesso/calculo/recorte";
import { lerMetrica } from "@/acesso/leitura";
import { formatarValor } from "@/apresentacao/formato/formato";
import { resumirPainel } from "@/chat/grafico";
import { divergencias } from "@/chat/perguntar";
import { resolver } from "@/chat/resolver";
import {
  idDoPainelDeSerie,
  JANELA_DO_GRAFICO,
  painelDaSerie,
} from "@/chat/serie";
import { SO_NO_CHAT } from "@/chat/so-no-chat";
import { QUERY_PADRAO } from "@/semantica/contrato";

/**
 * Um gráfico para toda resposta (T-432).
 *
 * Setenta e sete métricas não têm cartão na tela, e a resposta delas saía só
 * em texto. A série mensal por trás de qualquer métrica já existe em
 * `MetricValue.serie`; o painel de linha é montagem, e o que se prova aqui é
 * que a montagem não inventa: eixo e valores alinham, série nula não vira
 * gráfico, e os pontos só passam no verificador junto do rótulo.
 */

beforeAll(() => {
  process.env["DATA_SOURCE"] = "fixtures";
  process.env["AUTH_PROVIDER"] = "fixtures";
});

describe("a série sintética (T-432)", () => {
  it("uma métrica sem cartão responde com a própria série de doze meses", async () => {
    const r = await resolver("roe", QUERY_PADRAO);
    expect(r.painel).not.toBeNull();
    if (r.painel === null) return;
    expect(r.painel.id).toBe(idDoPainelDeSerie("roe"));
    expect(r.painel.forma).toBe("linha");
    if (r.painel.forma !== "linha") return;
    expect(r.painel.categories).toEqual(mesesDoRecorte(QUERY_PADRAO));
    expect(r.painel.series[0]?.values).toHaveLength(r.painel.categories.length);
    // Não há painel na tela para destacar: a ação continua vazia.
    expect(r.acoes.painel).toBeNull();
    // A série sintética não é composição: nada entra como "o que foi
    // considerado" por causa dela.
    expect(r.consideracoes.every((c) => c.origem === "apoio")).toBe(true);
  });

  it("com o período em dezembro, o gráfico tem doze meses e o valor é o de dezembro", async () => {
    const dezembro = { ...QUERY_PADRAO, periodo: "dezembro" as const };
    const r = await resolver("juros_pagos", dezembro);
    const lido = await lerMetrica("juros_pagos", dezembro);
    expect(r.valor).toBe(lido.value);
    expect(r.painel?.forma).toBe("linha");
    if (r.painel?.forma !== "linha") return;
    expect(r.painel.categories).toEqual(
      mesesDoRecorte({ ...dezembro, periodo: JANELA_DO_GRAFICO }),
    );
  });

  it("série toda nula, ou desalinhada do recorte, não vira gráfico", async () => {
    const base = await lerMetrica("roe", QUERY_PADRAO);
    const nula = {
      ...base,
      serie: { ...base.serie, values: base.serie.values.map(() => null) },
    };
    expect(painelDaSerie("roe", nula, QUERY_PADRAO)).toBeNull();
    const curta = {
      ...base,
      serie: { ...base.serie, values: base.serie.values.slice(1) },
    };
    expect(painelDaSerie("roe", curta, QUERY_PADRAO)).toBeNull();
  });

  it("os pontos da série sintética só passam no verificador junto do rótulo", async () => {
    const r = await resolver("roe", QUERY_PADRAO);
    if (r.painel === null || r.valor === null)
      throw new Error("esperava painel");
    const resumo = resumirPainel(r.painel);
    const principal = formatarValor(r.valor, r.unidade);
    const livres = new Set(resumo.destaques.map((d) => d.ponto.formatado));
    const ponto = resumo.pontos.find(
      (p) =>
        p.formatado !== null &&
        p.formatado !== principal &&
        !livres.has(p.formatado),
    );
    if (ponto?.formatado === null || ponto === undefined) {
      throw new Error("esperava um ponto distinto do valor e dos destaques");
    }
    expect(divergencias(`O ROE ficou em ${ponto.formatado}.`, r)).toEqual([
      ponto.formatado,
    ]);
    expect(
      divergencias(`Em ${ponto.rotulo}, o ROE ficou em ${ponto.formatado}.`, r),
    ).toEqual([]);
  });

  const AMOSTRA = 8;
  it.each(SO_NO_CHAT.slice(0, AMOSTRA))(
    "%s ganha série alinhada, ou não tem dado nenhum",
    async (id) => {
      const r = await resolver(id, QUERY_PADRAO);
      const lido = await lerMetrica(id, QUERY_PADRAO);
      if (r.painel === null) {
        expect(lido.serie.values.every((v) => v === null)).toBe(true);
        return;
      }
      expect(r.painel.id).toBe(idDoPainelDeSerie(id));
      expect(r.painel.forma).toBe("linha");
    },
  );
});
