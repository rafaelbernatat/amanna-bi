/**
 * Código canônico e rótulo de exibição (T-186).
 *
 * O defeito que esta tarefa fecha: o valor de dimensão era código e rótulo ao
 * mesmo tempo e, como precisava atravessar URL e chave de cache, era ASCII sem
 * acento. A barra de filtros mostraria **"Operacoes"** e **"Hibrido"** onde o
 * protótipo mostra "Operações" e "Híbrido", e onde a seção 6.2 do PRD escreve
 * `Híbrido` e `4º trimestre`.
 *
 * Os dois lados do aceite:
 *
 * - **nenhum rótulo acentuado em chave, URL ou nome de arquivo** — provado
 *   varrendo os códigos e as chaves que o produto gera;
 * - **todo valor da 6.2 tem código** — provado lendo a tabela 6.2 do PRD.md e
 *   conferindo contra a tabela deste módulo.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  AREAS,
  ENTIDADES,
  MODALIDADES,
  PERIODOS,
  QUERY_PADRAO,
  type Query,
} from "@/semantica/contrato";
import {
  codigoBemFormado,
  codigoDe,
  codigosDe,
  derivarCodigo,
  DIMENSOES,
  rotuloDe,
  type NomeDeDimensao,
} from "@/semantica/dimensoes";
import { queryKey } from "@/semantica/query";
import { queryParaBusca } from "@/semantica/url";

const RAIZ = process.cwd();
const NOMES: readonly NomeDeDimensao[] = [
  "periodo",
  "entidade",
  "area",
  "modalidade",
];

/** Acento, cedilha, ordinal, espaço, maiúscula — tudo que não atravessa. */
const NAO_ASCII = /[^ -~]/;

describe("a forma do código", () => {
  it.each(NOMES)("%s: todo código é ASCII minúsculo com hífen", (dim) => {
    const maus = codigosDe(dim).filter((c) => !codigoBemFormado(c));
    expect(maus).toEqual([]);
  });

  it.each(NOMES)("%s: nenhum código tem acento, espaço ou ordinal", (dim) => {
    const maus = codigosDe(dim).filter(
      (c) => NAO_ASCII.test(c) || /[\sA-Z]/.test(c),
    );
    expect(maus).toEqual([]);
  });

  it.each(NOMES)("%s: os códigos são únicos", (dim) => {
    const cs = codigosDe(dim);
    expect(new Set(cs).size).toBe(cs.length);
  });

  it("o código de domínio e o do contrato são a mesma lista", () => {
    // Se divergirem, existe um terceiro nome — que é exatamente o que T-186
    // veio eliminar.
    expect([...PERIODOS]).toEqual([...codigosDe("periodo")]);
    expect([...ENTIDADES]).toEqual([...codigosDe("entidade")]);
    expect([...AREAS]).toEqual([...codigosDe("area")]);
    expect([...MODALIDADES]).toEqual([...codigosDe("modalidade")]);
  });
});

describe("o rótulo existe, e é o que a pessoa lê", () => {
  it.each(NOMES)("%s: todo código tem rótulo não vazio", (dim) => {
    const sem = DIMENSOES[dim].filter((v) => v.rotulo.trim() === "");
    expect(sem).toEqual([]);
  });

  it("os acentuados do protótipo estão nos rótulos, não nos códigos", () => {
    expect(rotuloDe("area", "operacoes")).toBe("Operações");
    expect(rotuloDe("area", "logistica")).toBe("Logística");
    expect(rotuloDe("modalidade", "hibrido")).toBe("Híbrido");
    expect(rotuloDe("periodo", "4-trimestre")).toBe("4º trimestre");
  });

  it("e o caminho de volta funciona", () => {
    expect(codigoDe("area", "Operações")).toBe("operacoes");
    expect(codigoDe("modalidade", "Híbrido")).toBe("hibrido");
    expect(codigoDe("area", "Operacoes")).toBeUndefined();
  });

  it("o ano é dimensão aberta: devolve o próprio valor (D-P8)", () => {
    // Sem isto, carregar 2027 na réplica exigiria cadastrar 2027 aqui — e a
    // decisão D-P8 existe justamente para que não exija.
    expect(rotuloDe("ano", "2027")).toBe("2027");
  });
});

describe("todo valor da seção 6.2 do PRD tem código", () => {
  /**
   * A tabela 6.2 é lida **do documento**, não copiada.
   *
   * É o mesmo princípio dos outros registros: se Produto acrescentar uma
   * modalidade ao PRD, a suíte avisa em vez de o produto ficar sem ela.
   */
  function valoresDa62(): ReadonlyMap<string, readonly string[]> {
    const prd = readFileSync(resolve(RAIZ, "PRD.md"), "utf8");
    const inicio = prd.indexOf("### 6.2");
    const trecho = prd.slice(inicio, prd.indexOf("### 6.3", inicio));
    const mapa = new Map<string, string[]>();
    for (const linha of trecho.split("\n")) {
      const m =
        /^\| (Período|Entidade|Modalidade) \| (.+?) \| `(.+?)` \|$/.exec(linha);
      if (m === null) continue;
      const valores = [...(m[2] ?? "").matchAll(/`([^`]+)`/g)].map(
        (x) => x[1]!,
      );
      mapa.set((m[1] ?? "").toLowerCase().replace("í", "i"), valores);
    }
    return mapa;
  }

  const seis2 = valoresDa62();

  it("a tabela 6.2 foi lida — senão o resto não prova nada", () => {
    expect(seis2.size).toBe(3);
    expect(seis2.get("periodo")).toHaveLength(4);
  });

  it.each(["periodo", "entidade", "modalidade"] as const)(
    "%s: todo valor do PRD tem código e o rótulo bate",
    (dim) => {
      const doPrd = seis2.get(dim) ?? [];
      const rotulos: readonly string[] = DIMENSOES[dim].map((v) => v.rotulo);
      const semCodigo = doPrd.filter((v) => !rotulos.includes(v));
      expect(semCodigo).toEqual([]);
      expect(doPrd.length).toBe(DIMENSOES[dim].length);
    },
  );

  it("área tem 'Todas' mais as sete áreas, como a 6.2 diz", () => {
    // A 6.2 não lista as sete por extenso ("`Todas` + as 7 áreas"), então o que
    // dá para conferir é a contagem.
    expect(DIMENSOES.area.length).toBe(8);
    expect(DIMENSOES.area[0]?.codigo).toBe("todas");
  });
});

describe("chave de cache e URL carregam só o código", () => {
  const RECORTE: Query = {
    periodo: "4-trimestre",
    ano: "2026",
    entidade: "unidade-sp",
    area: "operacoes",
    modalidade: "hibrido",
  };

  it("a chave de cache não tem acento nem espaço", () => {
    /*
     * O que este teste impede.
     *
     * Antes de T-186 a chave saía `periodo=4º trimestre`: com ordinal e com
     * espaço. Chave assim quebra ao virar nome de arquivo, ao entrar num
     * cabeçalho HTTP, e ao ser comparada por um sistema que normaliza Unicode
     * de um jeito diferente do outro.
     */
    const chave = queryKey(RECORTE);
    const separador = String.fromCharCode(31);
    for (const parte of chave.split(separador)) {
      expect(NAO_ASCII.test(parte), `acento em: ${parte}`).toBe(false);
      expect(/ /.test(parte), `espaço em: ${parte}`).toBe(false);
    }
  });

  it("a URL não tem nada que precise de escape", () => {
    const busca = queryParaBusca(RECORTE).toString();
    expect(busca).not.toBe("");
    expect(NAO_ASCII.test(busca)).toBe(false);
    // Sem `%` nem `+`: se houvesse, o valor teria sido codificado, e a URL
    // deixaria de ser legível para quem a compartilha.
    expect(busca).not.toMatch(/[%+]/);
  });

  it("nenhum rótulo acentuado aparece na chave ou na URL", () => {
    const chave = queryKey(RECORTE);
    const busca = queryParaBusca(RECORTE).toString();
    for (const dim of NOMES) {
      for (const { rotulo } of DIMENSOES[dim]) {
        if (!NAO_ASCII.test(rotulo)) continue;
        expect(chave, `${rotulo} vazou para a chave`).not.toContain(rotulo);
        expect(busca, `${rotulo} vazou para a URL`).not.toContain(rotulo);
      }
    }
  });

  it("o recorte padrão vira URL vazia e chave sem acento", () => {
    expect(queryParaBusca(QUERY_PADRAO).toString()).toBe("");
    // A chave é separada por U+001F, que também cai fora da faixa imprimível:
    // divide-se antes de olhar, como no teste acima.
    for (const parte of queryKey(QUERY_PADRAO).split(String.fromCharCode(31))) {
      expect(NAO_ASCII.test(parte), parte).toBe(false);
    }
  });
});

describe("derivarCodigo propõe, mas não resolve", () => {
  it("produz o código que a tabela já tem", () => {
    // Prova que a tabela não inventou códigos: cada um é o que a derivação
    // daria a partir do rótulo. Se alguém acrescentar um valor, isto mostra
    // qual código propor.
    for (const dim of NOMES) {
      for (const { codigo, rotulo } of DIMENSOES[dim]) {
        expect(derivarCodigo(rotulo), `${dim}/${rotulo}`).toBe(codigo);
      }
    }
  });

  it("lida com ordinal, acento e espaço", () => {
    expect(derivarCodigo("4º trimestre")).toBe("4-trimestre");
    expect(derivarCodigo("Operações")).toBe("operacoes");
    expect(derivarCodigo("  Híbrido  ")).toBe("hibrido");
  });
});
