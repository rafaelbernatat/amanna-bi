import { join } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import { aplicarMigracoes } from "../../ferramentas/dados/carga";
import type { ClientePostgres } from "@/acesso/postgres/cliente";
import { criarClientePglite } from "../apoio/pglite";

/**
 * O esquema que o chat consulta, e a tranca dele (T-449).
 *
 * Roda no CI, num Postgres em memória, **sem carregar CSV nenhum**: o que se
 * prova aqui é a forma do esquema e a permissão, e as duas existem antes de
 * haver dado. Os números são de `tests/dados/chat-sql-pglite.test.ts`, que só
 * roda com a base ensaiada na máquina.
 *
 * ## O que o PGlite não exercita
 *
 * **A defesa primária.** O PGlite não autentica: a sessão é sempre o
 * superusuário, e `SET LOCAL ROLE` — que é como os testes abaixo simulam o
 * papel — é comprovadamente escapável (`set_config('role', …)` seguido de
 * `query_to_xml`, que planeja em execução). Em produção quem segura é a
 * conexão separada de `DATABASE_URL_CHAT`, autenticada como `amanna_chat_ro`.
 *
 * É por isso que a suíte também afirma as **revogações**: aqui elas são o que
 * de fato segura, e lá são a segunda linha.
 */

const PASTA = join(process.cwd(), "ferramentas", "dados", "sql");

/**
 * As colunas que nunca podem aparecer em `amanna_chat`.
 *
 * A lista encolheu em 2026-09-19, por decisão de Produto: a base é de
 * protótipo, inteiramente fictícia, e o chat responde **tudo** sobre ela. O
 * que ficou não ficou por política, e sim por duas razões concretas:
 *
 * - **CPF** — o inspetor de saída (`src/chat/ferramentas/inspetor.ts`) barra
 *   qualquer resultado de ferramenta com forma de CPF, e por boa razão. Expor
 *   a coluna mataria o laço em silêncio na primeira pergunta que a tocasse:
 *   não é uma proibição, é um defeito esperando acontecer.
 * - **CNPJ e chave de NF-e** — identificadores longos que nenhuma pergunta de
 *   painel quer, e que só gastariam coluna e token. O nome do cliente já
 *   nomeia a empresa.
 *
 * Nome, cargo, salário, data de nascimento, gênero, escolaridade, sindicato,
 * motivo de desligamento, CID de atestado, comentário de pesquisa e pretensão
 * salarial de candidato **estão expostos**, de propósito. Num banco de cliente
 * real essa lista volta a crescer, e é isso que `DATABASE_URL_CHAT` com o
 * papel restrito existe para permitir sem mexer em código.
 */
const PROIBIDAS: readonly string[] = [
  "cpf_ficticio",
  "cpf",
  "cnpj",
  "cnpj_cliente",
  "cnpj_fornecedor",
  "chave_acesso",
];

let cliente: ClientePostgres;

beforeAll(async () => {
  cliente = await criarClientePglite();
  await aplicarMigracoes(cliente, PASTA);
}, 120_000);

describe("o esquema amanna_chat", () => {
  it("existe, com as views que o chat consulta", async () => {
    const linhas = await cliente.consultar<{ table_name: string }>(
      `SELECT table_name FROM information_schema.views
       WHERE table_schema = 'amanna_chat' ORDER BY table_name`,
    );
    const nomes = linhas.map((l) => l.table_name);
    expect(nomes).toEqual(
      expect.arrayContaining([
        "lancamento",
        "lancamento_qualidade",
        "folha",
        "colaborador",
        "titulo_a_pagar",
        "titulo_a_receber",
        "movimento_caixa",
        "dim_conta",
        "mes",
      ]),
    );
  });

  /**
   * A promessa de privacidade, checável sem dado.
   *
   * Produto liberou nome, cargo, área e custo. Tudo que identifica alguém
   * fora da empresa, ou diz dela o que o trabalho não pede, não tem coluna
   * aqui — e "não tem" é uma consulta, não um comentário.
   */
  it("não expõe nenhuma coluna proibida", async () => {
    const linhas = await cliente.consultar<{
      table_name: string;
      column_name: string;
    }>(
      `SELECT table_name, column_name FROM information_schema.columns
       WHERE table_schema = 'amanna_chat'`,
    );
    const achadas = linhas
      .filter((l) => PROIBIDAS.includes(l.column_name))
      .map((l) => `${l.table_name}.${l.column_name}`);
    expect(achadas).toEqual([]);
  });

  it("o dicionário traz a unidade de cada coluna numérica", async () => {
    const [linha] = await cliente.consultar<{ unidade: string }>(
      `SELECT unidade FROM amanna_chat.dicionario
       WHERE objeto = 'folha' AND coluna = 'custo_total_empresa'`,
    );
    expect(linha?.unidade).toBe("reais");
  });
});

describe("o papel amanna_chat_ro", () => {
  it("existe e carrega os tetos", async () => {
    const [papel] = await cliente.consultar<{ rolconfig: string[] | null }>(
      `SELECT rolconfig FROM pg_roles WHERE rolname = 'amanna_chat_ro'`,
    );
    const config = (papel?.rolconfig ?? []).join(" ");
    expect(config).toContain("default_transaction_read_only=on");
    expect(config).toContain("statement_timeout=5s");
    expect(config).toContain("idle_in_transaction_session_timeout=10s");
    expect(config).toContain("search_path=amanna_chat");
  });

  it("não alcança o esquema amanna", async () => {
    await expect(
      cliente.transacao(async (t) => {
        await t.consultar(`SET LOCAL ROLE amanna_chat_ro`);
        return t.consultar(`SELECT 1 FROM amanna.colaboradores LIMIT 1`);
      }),
    ).rejects.toThrow(/permission denied|não autorizad/i);
  });

  /**
   * A escapada que prova por que a defesa é uma conexão separada.
   *
   * Medida em PGlite 0.5.8: `set_config` devolve a sessão à role autenticada,
   * e `query_to_xml` planeja a consulta interna **depois** disso. Um
   * `SET LOCAL ROLE` não contém nada.
   *
   * O teste afirma que ela **funciona**, e isso não é um defeito aberto: no
   * protótipo ninguém entra pelo papel restrito — a consulta usa a conexão de
   * sempre, por decisão de Produto, porque a base é fictícia. A migração
   * deixou de revogar essas funções justamente para não arriscar o PostgREST
   * do Supabase em troca de proteção que ninguém usa.
   *
   * Quando `DATABASE_URL_CHAT` existir, a revogação volta e este teste vira o
   * oposto: `rejects.toThrow(/permission denied for function/)`. É o marcador
   * de que uma coisa depende da outra.
   */
  it("a escapada por set_config existe, e e por isso que SET ROLE nao e a defesa", async () => {
    const linhas = await cliente.transacao(async (t) => {
      await t.consultar(`SET LOCAL ROLE amanna_chat_ro`);
      return t.consultar<{ a: string }>(
        `SELECT set_config('role','postgres',false) AS a`,
      );
    });
    expect(linhas[0]?.a).toBe("postgres");
  });
});

describe("o escopo é fail-closed", () => {
  it("sem as GUCs, no_escopo é falso", async () => {
    const [linha] = await cliente.consultar<{ dentro: boolean }>(
      `SELECT amanna_chat.no_escopo('consolidado', 'todas', 'fin') AS dentro`,
    );
    expect(linha?.dentro).toBe(false);
  });

  it("com o módulo concedido, passa; sem ele, não", async () => {
    const dentro = await cliente.transacao(async (t) => {
      await t.consultar(`SET LOCAL amanna.escopo_modulos = 'fin,int'`);
      await t.consultar(`SET LOCAL amanna.escopo_entidades = 'consolidado'`);
      await t.consultar(`SET LOCAL amanna.escopo_areas = 'todas'`);
      return t.consultar<{ fin: boolean; rh: boolean }>(
        `SELECT amanna_chat.no_escopo('consolidado','todas','fin') AS fin,
                amanna_chat.no_escopo('consolidado','todas','rh') AS rh`,
      );
    });
    expect(dentro[0]?.fin).toBe(true);
    // O perfil `controller` tem fin e int, e não pode alcançar a folha.
    expect(dentro[0]?.rh).toBe(false);
  });

  it("a área concedida restringe, e 'todas' alarga", async () => {
    const linhas = await cliente.transacao(async (t) => {
      await t.consultar(`SET LOCAL amanna.escopo_modulos = 'rh'`);
      await t.consultar(`SET LOCAL amanna.escopo_entidades = 'consolidado'`);
      await t.consultar(`SET LOCAL amanna.escopo_areas = 'tecnologia'`);
      return t.consultar<{ propria: boolean; outra: boolean }>(
        `SELECT amanna_chat.no_escopo('consolidado','tecnologia','rh') AS propria,
                amanna_chat.no_escopo('consolidado','operacoes','rh') AS outra`,
      );
    });
    expect(linhas[0]?.propria).toBe(true);
    expect(linhas[0]?.outra).toBe(false);
  });

  /**
   * Uma view nova que esqueça o predicado ficaria sem escopo em silêncio. O
   * teste percorre a definição de cada view e exige a chamada.
   */
  it("toda view com entidade ou área chama no_escopo", async () => {
    const linhas = await cliente.consultar<{
      table_name: string;
      definicao: string;
    }>(
      `SELECT c.table_name,
              pg_get_viewdef(('amanna_chat.' || c.table_name)::regclass) AS definicao
       FROM information_schema.columns c
       JOIN information_schema.views v
         ON v.table_schema = c.table_schema AND v.table_name = c.table_name
       WHERE c.table_schema = 'amanna_chat'
         AND c.column_name IN ('entidade', 'area')
       GROUP BY c.table_name`,
    );
    const sem = linhas
      .filter((l) => !l.definicao.includes("no_escopo"))
      .map((l) => l.table_name);
    expect(sem).toEqual([]);
  });
});
