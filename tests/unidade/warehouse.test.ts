/**
 * O adaptador de warehouse sem banco (D-DADOS, T-269 e T-270).
 *
 * O que dá para provar sem Postgres: que a forma declarada de cada view cobre
 * exatamente as dezoito views do motor; que o leitor converte o que o banco
 * devolve e recusa o que não tem a forma; que o cache relê só quando a carga
 * muda; e que as bandas do produto são as mesmas das fixtures. O que exige a
 * base carregada mora em tests/dados/warehouse-pglite.test.ts.
 */

import { describe, expect, it, vi } from "vitest";

import { NOMES_DE_VIEW, type Views } from "@/acesso/calculo/base";
import {
  VW_DIM_FAIXA_ETARIA,
  VW_DIM_FAIXA_SALARIAL,
  VW_DIM_TEMPO_DE_CASA,
} from "@/acesso/fixtures/dim";
import type { ClientePostgres } from "@/acesso/postgres/cliente";
import { criarCacheDeBase } from "@/acesso/warehouse/cache";
import { FAIXA_SALARIAL, QUEBRAS_FIXAS } from "@/acesso/warehouse/cadastros";
import {
  colunaDe,
  FORMA_DAS_VIEWS,
  type TipoDeCampo,
} from "@/acesso/warehouse/forma";
import { lerViews, ViewForaDaForma } from "@/acesso/warehouse/leitor";
import { BASE_DE_FIXTURES } from "@/acesso/fixtures/base";

/* ------------------------------------------------------------------ *
 * A forma
 * ------------------------------------------------------------------ */

describe("a forma declarada das views", () => {
  it("cobre exatamente as dezoito views do motor", () => {
    expect(Object.keys(FORMA_DAS_VIEWS).sort()).toEqual(
      [...NOMES_DE_VIEW].sort(),
    );
  });

  it("toda view tem `mes` como texto — é a chave do recorte", () => {
    for (const nome of NOMES_DE_VIEW) {
      const forma = FORMA_DAS_VIEWS[nome] as Record<string, TipoDeCampo>;
      expect(forma["mes"], nome).toBe("texto");
    }
  });

  it("os campos da fixture têm a mesma forma", () => {
    // A primeira linha de cada view sintética precisa ter exatamente as chaves
    // que a forma declara: é a fixture e o banco falando a mesma língua.
    for (const nome of NOMES_DE_VIEW) {
      const linha = BASE_DE_FIXTURES.views[nome][0];
      if (linha === undefined) continue;
      expect(Object.keys(linha).sort(), nome).toEqual(
        Object.keys(FORMA_DAS_VIEWS[nome]).sort(),
      );
    }
  });

  it.each([
    ["mes", "mes"],
    ["headcountFte", "headcount_fte"],
    ["somaDeTempoAteASaida", "soma_de_tempo_ate_a_saida"],
    ["receitaLiquidaAnoAnterior", "receita_liquida_ano_anterior"],
    ["aReceber", "a_receber"],
  ])("a coluna de %s é %s", (campo, coluna) => {
    expect(colunaDe(campo)).toBe(coluna);
  });
});

/* ------------------------------------------------------------------ *
 * O leitor
 * ------------------------------------------------------------------ */

/** Uma linha do banco para uma view, com valores pelo tipo — como o driver devolve. */
function linhaDoBanco(
  nome: keyof Views,
  sobrescrever: Record<string, unknown> = {},
): Record<string, unknown> {
  const forma = FORMA_DAS_VIEWS[nome] as Record<string, TipoDeCampo>;
  const linha: Record<string, unknown> = {};
  for (const [campo, tipo] of Object.entries(forma)) {
    const coluna = colunaDe(campo);
    linha[coluna] =
      tipo === "texto"
        ? campo === "mes"
          ? "2026-01"
          : "x"
        : tipo === "booleano"
          ? "t"
          : tipo === "numero-ou-nulo"
            ? null
            : "12.5"; // numeric chega como texto em parte dos caminhos
  }
  return { ...linha, ...sobrescrever };
}

function clienteFalso(
  porView: (view: string) => readonly Record<string, unknown>[],
): ClientePostgres {
  return {
    consultar: async <T>(sql: string): Promise<readonly T[]> => {
      const achado = /FROM amanna\.(\w+)/.exec(sql);
      return porView(achado?.[1] ?? "") as unknown as readonly T[];
    },
    transacao: async (f) => f(clienteFalso(porView)),
    encerrar: async () => {},
  };
}

describe("o leitor das views", () => {
  it("converte número em texto para número, e mantém o nulo onde o tipo admite", async () => {
    const views = await lerViews(
      clienteFalso((v) => [linhaDoBanco(v as keyof Views)]),
    );
    const rh = views.vw_fato_rh_mes[0];
    expect(rh?.headcountFte).toBe(12.5);
    expect(rh?.mes).toBe("2026-01");
    expect(rh?.custoDeReposicao).toBeNull();
    expect(views.vw_fato_faturamento_cliente[0]?.principal).toBe(true);
    for (const nome of NOMES_DE_VIEW) {
      expect(views[nome], nome).toHaveLength(1);
    }
  });

  it("recusa coluna que falta, nomeando a view e a coluna", async () => {
    const semColuna = clienteFalso((v) => {
      const linha = linhaDoBanco(v as keyof Views);
      if (v === "vw_fato_fin_mes") delete linha["receita_liquida"];
      return [linha];
    });
    await expect(lerViews(semColuna)).rejects.toThrow(ViewForaDaForma);
    await expect(lerViews(semColuna)).rejects.toThrow(
      /vw_fato_fin_mes.*receita_liquida/,
    );
  });

  it("recusa nulo onde o tipo não admite: zero fingido não atravessa", async () => {
    const comNulo = clienteFalso((v) => [
      linhaDoBanco(
        v as keyof Views,
        v === "vw_fato_rh_mes" ? { headcount_fte: null } : {},
      ),
    ]);
    await expect(lerViews(comNulo)).rejects.toThrow(/headcount_fte.*null/);
  });

  it("recusa texto onde espera número", async () => {
    const comTexto = clienteFalso((v) => [
      linhaDoBanco(
        v as keyof Views,
        v === "vw_fato_contas" ? { a_receber: "muito" } : {},
      ),
    ]);
    await expect(lerViews(comTexto)).rejects.toThrow(/a_receber/);
  });
});

/* ------------------------------------------------------------------ *
 * O cache
 * ------------------------------------------------------------------ */

describe("o cache da base", () => {
  const TTL = 1000;

  function montar(versoes: string[]) {
    let relogio = 0;
    const ler = vi.fn(async () => BASE_DE_FIXTURES);
    const versao = vi.fn(async () => versoes.shift() ?? "v-fim");
    const cache = criarCacheDeBase({
      ler,
      versao,
      ttlMs: TTL,
      agora: () => relogio,
    });
    return { cache, ler, versao, avancar: (ms: number) => (relogio += ms) };
  }

  it("lê uma vez e serve da memória dentro do TTL", async () => {
    const { cache, ler, versao } = montar(["v1"]);
    await cache.obter();
    await cache.obter();
    expect(ler).toHaveBeenCalledTimes(1);
    expect(versao).toHaveBeenCalledTimes(1);
  });

  it("passado o TTL, confere a versão e não relê se ela não mudou", async () => {
    const { cache, ler, versao, avancar } = montar(["v1", "v1"]);
    await cache.obter();
    avancar(TTL + 1);
    await cache.obter();
    expect(versao).toHaveBeenCalledTimes(2);
    expect(ler).toHaveBeenCalledTimes(1);
  });

  it("relê quando a carga mudou", async () => {
    const { cache, ler, avancar } = montar(["v1", "v2", "v2"]);
    await cache.obter();
    avancar(TTL + 1);
    await cache.obter();
    expect(ler).toHaveBeenCalledTimes(2);
  });

  it("leituras concorrentes compartilham a mesma ida ao banco", async () => {
    const { cache, ler } = montar(["v1"]);
    await Promise.all([cache.obter(), cache.obter(), cache.obter()]);
    expect(ler).toHaveBeenCalledTimes(1);
  });
});

/* ------------------------------------------------------------------ *
 * Os cadastros que são vocabulário
 * ------------------------------------------------------------------ */

describe("as bandas do produto são as mesmas nas fixtures e no warehouse", () => {
  it("faixa etária", () => {
    expect([...QUEBRAS_FIXAS.faixa_etaria]).toEqual(
      VW_DIM_FAIXA_ETARIA.map((f) => f.codigo),
    );
  });
  it("tempo de casa", () => {
    expect([...QUEBRAS_FIXAS.tempo_de_casa]).toEqual(
      VW_DIM_TEMPO_DE_CASA.map((f) => f.codigo),
    );
  });
  it("faixa salarial, com os limites", () => {
    expect(FAIXA_SALARIAL.map((f) => [f.codigo, f.de, f.ate])).toEqual(
      VW_DIM_FAIXA_SALARIAL.map((f) => [f.codigo, f.de, f.ate]),
    );
  });
});
