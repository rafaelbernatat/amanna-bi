/**
 * O esquema do chat sobre a base Amanna carregada (T-449, T-451).
 *
 * Exige a base que `npm run dados:ensaio` deixou em disco, apontada por
 * `ENSAIO_PGLITE`. Sem a variável, a suíte pula — `npm test` continua verde
 * num clone limpo, e quem quiser a prova roda:
 *
 *   ENSAIO_PGLITE=.ensaio/pglite npx vitest run tests/dados
 *
 * O que se prova aqui é o que `chat-sql-migracao.test.ts` não pode provar sem
 * dado: as contagens, e a **conciliação** das marcas de qualidade. A view por
 * lançamento reescreveu `fora_do_padrao` como função de janela, porque a
 * versão de 007 (junção cruzada com subconsultas correlacionadas) estoura o
 * tempo quando paga por lançamento. Duas definições da mesma marca que
 * divergem seriam pior que uma — é este teste que impede.
 */

import { resolve } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { aplicarMigracoes } from "../../ferramentas/dados/carga";
import type { ClientePostgres } from "@/acesso/postgres/cliente";
import { criarClientePglite } from "../apoio/pglite";

const PASTA = process.env["ENSAIO_PGLITE"];

/**
 * O escopo mais largo, como a diretoria o tem.
 *
 * `consolidado` é o que o perfil de diretoria recebe, e ele alarga para todas
 * as entidades — o consolidado é a soma delas. Os códigos da base são
 * `unidade-sp` e `demais-unidades`.
 */
async function comEscopo<T>(
  cliente: ClientePostgres,
  f: (t: ClientePostgres) => Promise<T>,
): Promise<T> {
  return cliente.transacao(async (t) => {
    await t.consultar(`SET LOCAL amanna.escopo_entidades = 'consolidado'`);
    await t.consultar(`SET LOCAL amanna.escopo_areas = 'todas'`);
    await t.consultar(`SET LOCAL amanna.escopo_modulos = 'rh,fin,int'`);
    return f(t);
  });
}

describe.skipIf(PASTA === undefined || PASTA === "")(
  "o esquema amanna_chat sobre a base Amanna (ENSAIO_PGLITE)",
  () => {
    let cliente: ClientePostgres;

    beforeAll(async () => {
      cliente = await criarClientePglite(resolve(process.cwd(), PASTA ?? ""));
      // A migração é idempotente; num ensaio antigo ela ainda não rodou.
      await aplicarMigracoes(
        cliente,
        resolve(process.cwd(), "ferramentas/dados/sql"),
      );
    }, 180_000);

    afterAll(async () => {
      await cliente.encerrar();
    });

    it("o detalhe está lá, e nas contagens do dicionário", async () => {
      const [linha] = await comEscopo(cliente, (t) =>
        t.consultar<{ lancamentos: number; folha: number; pessoas: number }>(
          `SELECT (SELECT COUNT(*) FROM amanna_chat.lancamento) AS lancamentos,
                  (SELECT COUNT(*) FROM amanna_chat.folha) AS folha,
                  (SELECT COUNT(*) FROM amanna_chat.colaborador) AS pessoas`,
        ),
      );
      expect(Number(linha?.lancamentos)).toBe(128_507);
      expect(Number(linha?.folha)).toBe(28_041);
      expect(Number(linha?.pessoas)).toBe(1_518);
    });

    /**
     * A prova que justifica a reescrita.
     *
     * Por mês e entidade, as marcas por lançamento têm de somar exatamente o
     * que a view agregada do painel diz. Se um dia divergirem, o chat e o
     * cartão da Controladoria passam a contar histórias diferentes sobre o
     * mesmo mês.
     */
    it("as marcas por lançamento conciliam com vw_fato_qualidade_mes", async () => {
      const divergentes = await comEscopo(cliente, (t) =>
        t.consultar<{ mes: string; entidade: string }>(
          /*
           * `MATERIALIZED` nas duas pontas, e não é estilo: sem ele o
           * planejador inclina as views para dentro da junção e reavalia cada
           * uma por linha — a primeira medida estourou os 60 s do teste,
           * enquanto cada view sozinha leva menos de dois segundos.
           */
          `WITH por_mes AS MATERIALIZED (
             SELECT mes, entidade,
                    COUNT(*) FILTER (WHERE fora_do_padrao) AS fora,
                    COUNT(*) FILTER (WHERE em_conta_parada) AS parada,
                    COUNT(*) FILTER (WHERE de_competencia_anterior) AS anterior
             FROM amanna_chat.lancamento_qualidade
             GROUP BY 1, 2
           ),
           do_painel AS MATERIALIZED (
             SELECT mes, entidade, lancamentos_fora_do_padrao,
                    lancamentos_em_conta_parada,
                    lancamentos_de_competencia_anterior
             FROM amanna.vw_fato_qualidade_mes
           )
           SELECT p.mes, p.entidade
           FROM por_mes p
           JOIN do_painel v ON v.mes = p.mes AND v.entidade = p.entidade
           WHERE p.fora IS DISTINCT FROM v.lancamentos_fora_do_padrao
              OR p.parada IS DISTINCT FROM v.lancamentos_em_conta_parada
              OR p.anterior IS DISTINCT FROM v.lancamentos_de_competencia_anterior`,
        ),
      );
      expect(divergentes).toEqual([]);
    }, 120_000);

    it("«os dez colaboradores mais caros» responde com nome e custo", async () => {
      const linhas = await comEscopo(cliente, (t) =>
        t.consultar<{ nome: string; custo: number }>(
          `SELECT nome, SUM(custo_total_empresa) AS custo
           FROM amanna_chat.folha WHERE mes LIKE '2026-%'
           GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
        ),
      );
      expect(linhas).toHaveLength(10);
      expect(linhas[0]?.nome).toMatch(/\S/);
      expect(Number(linhas[0]?.custo)).toBeGreaterThan(0);
    });

    it("«a maior despesa de junho, por conta» responde", async () => {
      const linhas = await comEscopo(cliente, (t) =>
        t.consultar<{ conta: string; total: number }>(
          `SELECT conta_descricao AS conta, SUM(valor) AS total
           FROM amanna_chat.lancamento
           WHERE mes = '2026-06' AND demonstrativo = 'DRE'
           GROUP BY 1 ORDER BY 2 DESC LIMIT 5`,
        ),
      );
      expect(linhas.length).toBeGreaterThan(0);
      expect(linhas[0]?.conta).toMatch(/\S/);
    });

    it("sem o escopo posto, nenhuma linha sai", async () => {
      const linhas = await cliente.consultar(
        `SELECT 1 FROM amanna_chat.lancamento LIMIT 1`,
      );
      expect(linhas).toEqual([]);
    });
  },
);
