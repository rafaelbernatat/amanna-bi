/**
 * O adaptador de warehouse sobre a base Amanna carregada (D-DADOS, T-270).
 *
 * Exige a base que `npm run dados:ensaio` deixou em disco, apontada por
 * `ENSAIO_PGLITE` (por exemplo `.ensaio/pglite`). Sem a variável, a suíte
 * pula dizendo por quê — `npm test` continua verde num clone limpo, e quem
 * quiser a prova roda o ensaio e depois:
 *
 *   ENSAIO_PGLITE=.ensaio/pglite npx vitest run tests/dados
 *
 * O que se prova aqui: os números do dicionário saem pelo `DataSource` (e não
 * só pelo SQL), as duas entidades somam o consolidado, os dois anos existem, e
 * nenhuma das treze telas nem dos 71 painéis lança sobre dado real.
 */

import { resolve } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { criarFonteDeWarehouse } from "@/acesso/warehouse/adaptador";
import type { ClientePostgres } from "@/acesso/postgres/cliente";
import { MODULOS } from "@/apresentacao/navegacao/telas";
import type { DataSource, Query } from "@/semantica/contrato";
import { QUERY_PADRAO } from "@/semantica/contrato";
import { REGISTRO_DE_PAINEIS } from "@/semantica/paineis";
import { criarClientePglite } from "../apoio/pglite";

const PASTA = process.env["ENSAIO_PGLITE"];

/** Os valores do dicionário para 2026 consolidado, em R$ mi e FTE. */
const DICIONARIO = {
  receita_liquida: 1198.3,
  ebitda: 198.3,
  lucro_liquido: -12.3,
  headcount_fte: 1235.4,
  folha_total: 189.4,
};

const TOLERANCIA_MI = 0.1;
const TOLERANCIA_FTE = 0.5;

describe.skipIf(PASTA === undefined || PASTA === "")(
  "o warehouse sobre a base Amanna (ENSAIO_PGLITE)",
  () => {
    let cliente: ClientePostgres;
    let fonte: DataSource;

    beforeAll(async () => {
      cliente = await criarClientePglite(resolve(process.cwd(), PASTA ?? ""));
      fonte = criarFonteDeWarehouse(cliente);
    });

    afterAll(async () => {
      await cliente.encerrar();
    });

    it("getMeta enxerga os dois anos carregados e o fechamento de dezembro de 2026", async () => {
      const meta = await fonte.getMeta();
      expect(meta.dimensoes.ano).toEqual(["2026", "2025"]);
      expect(meta.frescor.asOf).toBe("2026-12-31");
    });

    it("getMeta se declara como a base carregada, com a versão da carga (T-419)", async () => {
      const meta = await fonte.getMeta();
      expect(meta.origem.fonte).toBe("warehouse");
      expect(typeof meta.origem.versao).toBe("string");
    });

    it.each(Object.entries(DICIONARIO) as [keyof typeof DICIONARIO, number][])(
      "%s de 2026 consolidado bate com o dicionário",
      async (metrica, esperado) => {
        const valor = (await fonte.getMetric(metrica, QUERY_PADRAO)).value;
        expect(valor).not.toBeNull();
        const tolerancia =
          metrica === "headcount_fte" ? TOLERANCIA_FTE : TOLERANCIA_MI;
        expect(Math.abs((valor ?? 0) - esperado)).toBeLessThanOrEqual(
          tolerancia,
        );
      },
    );

    it.each(["receita_liquida", "folha_total", "desligamentos"])(
      "%s: Unidade SP + demais unidades = consolidado",
      async (metrica) => {
        const consolidado =
          (await fonte.getMetric(metrica, QUERY_PADRAO)).value ?? 0;
        const sp =
          (
            await fonte.getMetric(metrica, {
              ...QUERY_PADRAO,
              entidade: "unidade-sp",
            })
          ).value ?? 0;
        const demais =
          (
            await fonte.getMetric(metrica, {
              ...QUERY_PADRAO,
              entidade: "demais-unidades",
            })
          ).value ?? 0;
        expect(Math.abs(sp + demais - consolidado)).toBeLessThan(0.001);
      },
    );

    it("2025 tem dado, e é outro dado", async () => {
      const em2026 = (await fonte.getMetric("receita_liquida", QUERY_PADRAO))
        .value;
      const em2025 = (
        await fonte.getMetric("receita_liquida", {
          ...QUERY_PADRAO,
          ano: "2025",
        })
      ).value;
      expect(em2025).not.toBeNull();
      expect(em2025).not.toBe(em2026);
    });

    it("as treze telas devolvem até seis KPIs cada, sem lançar", async () => {
      for (const modulo of MODULOS) {
        for (const tela of modulo.telas) {
          const kpis = await fonte.getKpis(
            `${modulo.id}/${tela.slug}`,
            QUERY_PADRAO,
          );
          expect(kpis.length, `${modulo.id}/${tela.slug}`).toBeLessThanOrEqual(
            6,
          );
          expect(kpis.length).toBeGreaterThan(0);
        }
      }
    });

    it.each([
      ["2026", QUERY_PADRAO],
      ["2025", { ...QUERY_PADRAO, ano: "2025" }],
      [
        "dezembro de 2026 na Unidade SP",
        {
          ...QUERY_PADRAO,
          periodo: "dezembro",
          entidade: "unidade-sp",
        } as Query,
      ],
    ])(
      "os 71 painéis respondem com envelope válido em %s",
      async (_rotulo, q) => {
        for (const painel of REGISTRO_DE_PAINEIS) {
          const envelope = await fonte.getPanel(painel.id, q);
          expect(envelope.id, painel.id).toBe(painel.id);
          expect(envelope.formula.trim().length, painel.id).toBeGreaterThan(0);
        }
      },
    );

    it("o que a base não sustenta sai como ausência, não como zero", async () => {
      const pl = await fonte.getMetric("patrimonio_liquido", QUERY_PADRAO);
      expect(pl.value).toBeNull();
      const roe = await fonte.getMetric("roe", QUERY_PADRAO);
      expect(roe.value).toBeNull();
    });
  },
);
