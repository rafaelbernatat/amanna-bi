import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ClientePostgres } from "@/acesso/postgres/cliente";
import {
  armazensDeConvidadosRegistrados,
  limparArmazensDeConvidados,
  modoDoArmazemDeConvidados,
  obterArmazemDeConvidados,
  type ArmazemDeConvidados,
} from "@/convidados/armazem";
import {
  convidadosEmMemoria,
  criarArmazemDeConvidadosEmMemoria,
  esquecerConvidadosEmMemoria,
} from "@/convidados/armazens/memoria";
import {
  criarArmazemDeConvidadosEmPostgres,
  ddlDosConvidados,
} from "@/convidados/armazens/postgres";
import { registrarArmazensDeConvidadosDoProduto } from "@/convidados/registrar";

import { criarClientePglite } from "../apoio/pglite";

/**
 * O armazém de convidados (D-CONVIDADO-cadastro, T-424).
 *
 * Três blocos. O **contrato**, rodado nos dois adaptadores — memória e um
 * Postgres em processo (PGlite) —, prova o que a rota e a tela dependem:
 * registrar é idempotente por chave, a cota conta até o limite e nunca além,
 * dez pedidos ao mesmo tempo admitem exatamente cinco. A **forma das
 * consultas**, com um cliente falso, prova o que o banco de verdade recebe:
 * DDL uma vez, upsert com `RETURNING`, e-mail só por parâmetro, erro só com
 * código. A **fábrica** prova a escolha por ambiente.
 */

const LIMITE = 5;
const CHAVE = { sala: "demo", dispositivo: "abcdefghijklmnop" };
const NOVO = {
  ...CHAVE,
  nome: "Ana Souza",
  email: "ana@exemplo.com.br",
  expiraEm: "2026-09-18T20:00:00.000Z",
};

type Aberto = {
  readonly armazem: ArmazemDeConvidados;
  readonly encerrar: () => Promise<void>;
};

function suiteDeContrato(nome: string, abrir: () => Promise<Aberto>) {
  describe(`contrato · ${nome}`, () => {
    let aberto: Aberto;
    beforeEach(async () => {
      aberto = await abrir();
    });
    afterEach(async () => {
      await aberto.encerrar();
    });

    it("registrar devolve um id e a cota zerada; ler encontra pela chave", async () => {
      const gravado = await aberto.armazem.registrar(NOVO);
      expect(gravado.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(gravado.nome).toBe("Ana Souza");
      expect(gravado.perguntas).toBe(0);
      expect(gravado.interesseEm).toBeNull();
      expect(await aberto.armazem.ler(CHAVE)).toEqual(gravado);
    });

    it("chave desconhecida é null, e sem_cadastro ao pedir pergunta", async () => {
      const outra = { sala: "demo", dispositivo: "ninguem" };
      expect(await aberto.armazem.ler(outra)).toBeNull();
      expect(await aberto.armazem.admitirPergunta(outra, LIMITE)).toEqual({
        tipo: "sem_cadastro",
      });
    });

    it("registrar de novo mantém o id e a cota, e troca o nome", async () => {
      const primeiro = await aberto.armazem.registrar(NOVO);
      await aberto.armazem.admitirPergunta(CHAVE, LIMITE);
      const segundo = await aberto.armazem.registrar({
        ...NOVO,
        nome: "Ana S. Souza",
        email: "ana.souza@exemplo.com.br",
      });
      expect(segundo.id).toBe(primeiro.id);
      expect(segundo.nome).toBe("Ana S. Souza");
      expect(segundo.perguntas).toBe(1);
    });

    it("cinco perguntas são admitidas, a sexta é esgotada e não conta", async () => {
      await aberto.armazem.registrar(NOVO);
      for (let i = 1; i <= LIMITE; i += 1) {
        const admissao = await aberto.armazem.admitirPergunta(CHAVE, LIMITE);
        expect(admissao.tipo, `pergunta ${String(i)}`).toBe("admitida");
        if (admissao.tipo === "admitida") {
          expect(admissao.convidado.perguntas).toBe(i);
        }
      }
      const sexta = await aberto.armazem.admitirPergunta(CHAVE, LIMITE);
      expect(sexta.tipo).toBe("esgotada");
      if (sexta.tipo === "esgotada") {
        expect(sexta.convidado.perguntas).toBe(LIMITE);
      }
      expect((await aberto.armazem.ler(CHAVE))?.perguntas).toBe(LIMITE);
    });

    it("dez perguntas ao mesmo tempo: exatamente cinco admitidas", async () => {
      await aberto.armazem.registrar(NOVO);
      const DEZ = 10;
      const respostas = await Promise.all(
        Array.from({ length: DEZ }, () =>
          aberto.armazem.admitirPergunta(CHAVE, LIMITE),
        ),
      );
      expect(respostas.filter((r) => r.tipo === "admitida")).toHaveLength(
        LIMITE,
      );
      expect((await aberto.armazem.ler(CHAVE))?.perguntas).toBe(LIMITE);
    });

    it("o interesse fica registrado na primeira vez, e o id desconhecido é silêncio", async () => {
      const gravado = await aberto.armazem.registrar(NOVO);
      await aberto.armazem.registrarInteresse(gravado.id, "limite");
      await aberto.armazem.registrarInteresse(gravado.id, "expiracao");
      expect((await aberto.armazem.ler(CHAVE))?.interesseEm).not.toBeNull();
      await expect(
        aberto.armazem.registrarInteresse(
          "00000000-0000-4000-8000-000000000000",
          "limite",
        ),
      ).resolves.toBeUndefined();
    });
  });
}

suiteDeContrato("memoria", async () => {
  esquecerConvidadosEmMemoria();
  return {
    armazem: criarArmazemDeConvidadosEmMemoria(),
    encerrar: async () => {
      esquecerConvidadosEmMemoria();
    },
  };
});

let pglite: Promise<ClientePostgres> | null = null;
function bancoEmProcesso(): Promise<ClientePostgres> {
  pglite ??= criarClientePglite();
  return pglite;
}
let contadorDeTabelas = 0;

suiteDeContrato("postgres", async () => {
  const cliente = await bancoEmProcesso();
  contadorDeTabelas += 1;
  const tabela = `amanna.convidado_teste_${String(contadorDeTabelas)}`;
  return {
    armazem: criarArmazemDeConvidadosEmPostgres({ cliente, tabela }),
    encerrar: async () => {
      await cliente.consultar(`DROP TABLE IF EXISTS ${tabela}`);
    },
  };
});

afterAll(async () => {
  if (pglite !== null) await (await pglite).encerrar();
});

/* ------------------------------------------------------------------ *
 * A memória guarda o que a tela não vê
 * ------------------------------------------------------------------ */

describe("a memória", () => {
  beforeEach(() => {
    esquecerConvidadosEmMemoria();
  });

  it("guarda o e-mail, a origem e os cliques do interesse", async () => {
    const armazem = criarArmazemDeConvidadosEmMemoria();
    const gravado = await armazem.registrar(NOVO);
    await armazem.registrarInteresse(gravado.id, "limite");
    await armazem.registrarInteresse(gravado.id, "expiracao");
    const [linha] = convidadosEmMemoria();
    expect(linha?.email).toBe("ana@exemplo.com.br");
    expect(linha?.interesseOrigem).toBe("limite");
    expect(linha?.cliquesDeInteresse).toBe(2);
  });
});

/* ------------------------------------------------------------------ *
 * A forma das consultas
 * ------------------------------------------------------------------ */

function erroDoDriver(code: string, message: string): Error {
  return Object.assign(new Error(message), { code, name: "error" });
}

/** Um cliente falso que anota cada consulta e finge uma linha só. */
function clienteFalso(
  opcoes: { readonly falharEm?: (sql: string) => Error | null } = {},
) {
  const chamadas: { sql: string; parametros: readonly unknown[] }[] = [];
  let linha: Record<string, unknown> | null = null;
  const cliente: ClientePostgres = {
    async consultar<T>(sql: string, parametros: readonly unknown[] = []) {
      chamadas.push({ sql, parametros });
      const erro = opcoes.falharEm?.(sql) ?? null;
      if (erro !== null) throw erro;
      if (/^INSERT/i.test(sql)) {
        linha = {
          id: "0b6f0c1e-4b2a-4c1d-9f3e-1a2b3c4d5e6f",
          nome: parametros[2],
          perguntas: 0,
          interesse_em: null,
        };
        return [linha] as unknown as readonly T[];
      }
      if (/^UPDATE/i.test(sql) && sql.includes("perguntas < $3")) {
        if (linha === null) return [];
        const usadas = Number(linha["perguntas"]);
        if (usadas >= Number(parametros[2])) return [];
        linha = { ...linha, perguntas: usadas + 1 };
        return [linha] as unknown as readonly T[];
      }
      if (/^SELECT/i.test(sql)) {
        return (linha === null ? [] : [linha]) as unknown as readonly T[];
      }
      return [] as readonly T[];
    },
    transacao: async (f) => f(cliente),
    encerrar: async () => undefined,
  };
  return { cliente, chamadas };
}

describe("a forma das consultas no Postgres", () => {
  it("o DDL sai uma vez, antes da primeira gravação, e nunca na leitura", async () => {
    const { cliente, chamadas } = clienteFalso();
    const armazem = criarArmazemDeConvidadosEmPostgres({ cliente });
    await armazem.ler(CHAVE);
    expect(chamadas.some((c) => /CREATE TABLE/i.test(c.sql))).toBe(false);
    await armazem.registrar(NOVO);
    await armazem.registrar(NOVO);
    expect(chamadas.filter((c) => /CREATE TABLE/i.test(c.sql))).toHaveLength(1);
  });

  it("o upsert usa ON CONFLICT (sala, dispositivo) e RETURNING, com o e-mail só nos parâmetros", async () => {
    const { cliente, chamadas } = clienteFalso();
    await criarArmazemDeConvidadosEmPostgres({ cliente }).registrar(NOVO);
    const upsert = chamadas.find((c) => /^INSERT/i.test(c.sql));
    expect(upsert?.sql).toContain("ON CONFLICT (sala, dispositivo) DO UPDATE");
    expect(upsert?.sql).toContain("RETURNING id, nome, perguntas");
    expect(upsert?.sql).not.toContain("ana@");
    expect(upsert?.parametros).toEqual([
      "demo",
      "abcdefghijklmnop",
      "Ana Souza",
      "ana@exemplo.com.br",
      NOVO.expiraEm,
    ]);
  });

  it("admitir é um só UPDATE com o limite por parâmetro e RETURNING", async () => {
    const { cliente, chamadas } = clienteFalso();
    const armazem = criarArmazemDeConvidadosEmPostgres({ cliente });
    await armazem.registrar(NOVO);
    const admissao = await armazem.admitirPergunta(CHAVE, LIMITE);
    expect(admissao.tipo).toBe("admitida");
    const update = chamadas.find((c) => /^UPDATE/i.test(c.sql));
    expect(update?.sql).toContain("perguntas = perguntas + 1");
    expect(update?.sql).toContain("perguntas < $3");
    expect(update?.sql).toContain("RETURNING");
    expect(update?.parametros).toEqual(["demo", "abcdefghijklmnop", LIMITE]);
  });

  it("tabela inexistente: ler é null, admitir é sem_cadastro, interesse é silêncio", async () => {
    const { cliente } = clienteFalso({
      falharEm: (sql) =>
        /^(SELECT|UPDATE)/i.test(sql)
          ? erroDoDriver("42P01", "relation does not exist")
          : null,
    });
    const armazem = criarArmazemDeConvidadosEmPostgres({ cliente });
    expect(await armazem.ler(CHAVE)).toBeNull();
    expect(await armazem.admitirPergunta(CHAVE, LIMITE)).toEqual({
      tipo: "sem_cadastro",
    });
    await expect(
      armazem.registrarInteresse(
        "0b6f0c1e-4b2a-4c1d-9f3e-1a2b3c4d5e6f",
        "limite",
      ),
    ).resolves.toBeUndefined();
  });

  it("o erro do driver chega só com o nome e o código, nunca a mensagem", async () => {
    const { cliente } = clienteFalso({
      falharEm: (sql) =>
        /^INSERT/i.test(sql)
          ? erroDoDriver("23505", "duplicate key ana@exemplo.com.br")
          : null,
    });
    const armazem = criarArmazemDeConvidadosEmPostgres({ cliente });
    await expect(armazem.registrar(NOVO)).rejects.toThrow(/error \(23505\)/);
    await expect(armazem.registrar(NOVO)).rejects.not.toThrow(/ana@/);
  });

  it("nome de tabela fora da forma é recusado antes de qualquer consulta", () => {
    const { cliente, chamadas } = clienteFalso();
    expect(() =>
      criarArmazemDeConvidadosEmPostgres({
        cliente,
        tabela: "amanna.convidado; DROP TABLE x",
      }),
    ).toThrow(/forma/);
    expect(chamadas).toHaveLength(0);
  });

  it("o DDL é o mesmo da migração 011_convidados.sql", () => {
    const normalizar = (sql: string) =>
      sql.replace(/--.*$/gm, "").replace(/\s+/g, " ").trim();
    const migracao = normalizar(
      readFileSync(
        join(
          process.cwd(),
          "ferramentas",
          "dados",
          "sql",
          "011_convidados.sql",
        ),
        "utf8",
      ),
    );
    expect(normalizar(ddlDosConvidados())).toContain(migracao);
    expect(ddlDosConvidados()).toContain("ENABLE ROW LEVEL SECURITY");
  });
});

/* ------------------------------------------------------------------ *
 * A fábrica
 * ------------------------------------------------------------------ */

describe("a fábrica", () => {
  afterEach(() => {
    limparArmazensDeConvidados();
    registrarArmazensDeConvidadosDoProduto();
  });

  it("memória sem DATABASE_URL, Postgres com ela", () => {
    expect(modoDoArmazemDeConvidados({})).toBe("memoria");
    expect(modoDoArmazemDeConvidados({ DATABASE_URL: "  " })).toBe("memoria");
    expect(
      modoDoArmazemDeConvidados({ DATABASE_URL: "postgres://h:5432/d" }),
    ).toBe("postgres");
  });

  it("o produto registra os dois modos, e o de memória é um só", async () => {
    expect([...armazensDeConvidadosRegistrados()].sort()).toEqual([
      "memoria",
      "postgres",
    ]);
    esquecerConvidadosEmMemoria();
    const um = await obterArmazemDeConvidados({});
    const dois = await obterArmazemDeConvidados({});
    await um.registrar(NOVO);
    expect(await dois.ler(CHAVE)).not.toBeNull();
  });
});
