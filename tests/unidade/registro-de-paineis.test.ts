/**
 * O registro dos 71 painéis contra o Anexo A do PRD (T-107).
 *
 * O ponto destes testes é que o Anexo A é lido **do arquivo**, e não copiado
 * para dentro do teste. Um teste que carrega a própria cópia da lista prova só
 * que a cópia bate consigo mesma — e é assim que um inventário passa a
 * descrever um produto que mudou há três meses.
 *
 * Aqui, se Produto editar o Anexo A no PRD.md, a suíte reage na hora: painel
 * novo sem registro reprova, painel registrado que saiu do documento reprova,
 * e painel que mudou de tela reprova nomeando as duas.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { todasAsRotas } from "@/apresentacao/navegacao/telas";
import {
  COLUNAS_DA_GRADE,
  MAXIMO_DE_KPIS_POR_TELA,
  MAXIMO_DE_PAINEIS_POR_TELA,
  QUANTIDADE_DE_PAINEIS,
  REGISTRO_DE_PAINEIS,
  SEM_UNIDADE_NO_ENUM,
  TELAS_CITADAS,
  painelPorId,
  paineisDaTela,
} from "@/semantica/paineis";
import { FORMAS } from "@/semantica/painel";

/* ------------------------------------------------------------------ *
 * O Anexo A, lido do documento
 * ------------------------------------------------------------------ */

type LinhaDoAnexo = {
  readonly id: string;
  readonly titulo: string;
  readonly tela: string;
};

/**
 * Extrai o inventário do Anexo A das tabelas A.2, A.3 e A.4.
 *
 * As três tabelas têm a mesma forma: `| **Nome** (`rota`) | \`id\` Título · ... |`.
 * O separador é o meio-ponto, que é também o separador visual do documento.
 */
function lerAnexoA(): readonly LinhaDoAnexo[] {
  const prd = readFileSync(resolve(__dirname, "..", "..", "PRD.md"), "utf8");
  const linhaDeTela = /^\| \*\*.+\*\* \(`([a-z]+\/[a-z]+)`\) \|(.+)\|$/;
  const item = /^`([\w-]+)`\s+(.+)$/;

  const achados: LinhaDoAnexo[] = [];
  for (const linha of prd.split("\n")) {
    const m = linhaDeTela.exec(linha);
    if (m === null) continue;
    const tela = m[1] ?? "";
    for (const bruto of (m[2] ?? "").split("·")) {
      const i = item.exec(bruto.trim());
      if (i === null) continue;
      achados.push({ id: i[1] ?? "", titulo: (i[2] ?? "").trim(), tela });
    }
  }
  return achados;
}

const anexo = lerAnexoA();

describe("o Anexo A é legível e não degenerou", () => {
  /**
   * A guarda contra o pior modo de falha destes testes: um regex que para de
   * casar devolve lista vazia, e "vazio bate com vazio" passaria calado.
   */
  it("rende 71 painéis em 13 telas", () => {
    expect(anexo.length).toBe(71);
    expect(new Set(anexo.map((l) => l.tela)).size).toBe(13);
    expect(new Set(anexo.map((l) => l.id)).size).toBe(71);
  });
});

describe("o registro bate com o Anexo A", () => {
  it("não tem id faltante", () => {
    const registrados = new Set(REGISTRO_DE_PAINEIS.map((p) => p.id));
    const faltando = anexo
      .filter((l) => !registrados.has(l.id))
      .map((l) => l.id);
    expect(faltando).toEqual([]);
  });

  it("não tem id extra", () => {
    const noAnexo = new Set(anexo.map((l) => l.id));
    const sobrando = REGISTRO_DE_PAINEIS.filter((p) => !noAnexo.has(p.id)).map(
      (p) => p.id,
    );
    expect(sobrando).toEqual([]);
  });

  it("não tem tela divergente", () => {
    const divergentes = anexo
      .map((l) => {
        const p = painelPorId(l.id);
        return p !== undefined && p.tela !== l.tela
          ? `${l.id}: anexo diz ${l.tela}, registro diz ${p.tela}`
          : null;
      })
      .filter((x): x is string => x !== null);
    expect(divergentes).toEqual([]);
  });

  it("não tem título divergente", () => {
    const divergentes = anexo
      .map((l) => {
        const p = painelPorId(l.id);
        return p !== undefined && p.titulo !== l.titulo
          ? `${l.id}: "${l.titulo}" ≠ "${p.titulo}"`
          : null;
      })
      .filter((x): x is string => x !== null);
    expect(divergentes).toEqual([]);
  });

  it("tem exatamente 71 painéis, contados", () => {
    expect(QUANTIDADE_DE_PAINEIS).toBe(71);
    expect(QUANTIDADE_DE_PAINEIS).toBe(anexo.length);
  });
});

describe("as formas do registro", () => {
  it("estão todas entre as 12 do Anexo A.1", () => {
    const validas = new Set<string>(FORMAS);
    const fora = REGISTRO_DE_PAINEIS.filter((p) => !validas.has(p.forma)).map(
      (p) => `${p.id}: ${p.forma}`,
    );
    expect(fora).toEqual([]);
  });

  it("usam as 12 — nenhuma forma do vocabulário ficou sem painel", () => {
    // Se uma forma não aparece em painel nenhum, ou o inventário está errado ou
    // o vocabulário tem uma entrada que ninguém precisa. As duas merecem olhar.
    const usadas = new Set(REGISTRO_DE_PAINEIS.map((p) => p.forma));
    expect([...usadas].sort()).toEqual([...FORMAS].sort());
  });
});

describe("os limites de leitura da seção 5", () => {
  it("nenhuma tela passa de 7 painéis", () => {
    const excedentes = TELAS_CITADAS.map((t) => ({
      tela: t,
      n: paineisDaTela(t).length,
    })).filter((x) => x.n > MAXIMO_DE_PAINEIS_POR_TELA);
    expect(excedentes).toEqual([]);
  });

  it("nenhuma tela passa de 6 KPIs", () => {
    // Os KPIs por tela chegam em T-145; até lá o limite fica declarado e o teto
    // conferido contra o do PRD, para que a constante não nasça errada.
    expect(MAXIMO_DE_KPIS_POR_TELA).toBe(6);
    expect(MAXIMO_DE_KPIS_POR_TELA).toBeLessThan(MAXIMO_DE_PAINEIS_POR_TELA);
  });

  it("nenhum painel ocupa mais que a grade", () => {
    const largos = REGISTRO_DE_PAINEIS.filter(
      (p) => p.span < 1 || p.span > COLUNAS_DA_GRADE,
    ).map((p) => `${p.id}: span ${p.span}`);
    expect(largos).toEqual([]);
  });
});

describe("registro e navegação apontam para as mesmas telas", () => {
  // A navegação declara a rota com barra à frente (`/rh/visao`); o Anexo A
  // escreve sem (`rh/visao`). As duas grafias são do documento, não invenção —
  // normalizar aqui é mais honesto que mudar uma das duas para casar.
  const rotasDaNavegacao = todasAsRotas().map((r) => r.replace(/^\//, ""));

  it("todo painel aponta para uma rota que existe", () => {
    const rotas = new Set(rotasDaNavegacao);
    const orfaos = REGISTRO_DE_PAINEIS.filter((p) => !rotas.has(p.tela)).map(
      (p) => `${p.id} → ${p.tela}`,
    );
    expect(orfaos).toEqual([]);
  });

  it("toda tela da navegação tem ao menos um painel", () => {
    const vazias = rotasDaNavegacao.filter(
      (r) => paineisDaTela(r).length === 0,
    );
    expect(vazias).toEqual([]);
  });
});

describe("as unidades que o enum fechado não nomeia (H-45)", () => {
  /**
   * O conjunto está fixado para **só encolher**.
   *
   * Um painel novo sem unidade entra calado se ninguém contar; e aí o enum
   * fechado da seção 9.2 deixa de fechar sem que nenhuma decisão tenha sido
   * tomada. Quando H-45 for respondido, esta lista diminui e o teste é
   * atualizado junto — de propósito, na mesma revisão.
   */
  it("são exatamente estes doze, e nenhum a mais", () => {
    expect([...SEM_UNIDADE_NO_ENUM].sort()).toEqual([
      "col-geo",
      "eng-clima",
      "eng-enps",
      "rec-funil",
      "rec-resumo",
      "rec-vagas",
      "rh-flash",
      "sal-resumo",
      "tov-resumo",
      "tre-area",
      "tre-horas",
      "tre-invest",
    ]);
  });

  it("os sete de forma `estatisticas` são os que misturam unidade", () => {
    // Nesses, cada número declara a própria unidade (T-102) — a ausência no
    // registro é correta, não pendência. Os outros cinco são a pendência real.
    const estatisticos = SEM_UNIDADE_NO_ENUM.filter(
      (id) => painelPorId(id)?.forma === "estatisticas",
    );
    expect(estatisticos.length).toBe(7);
    expect(SEM_UNIDADE_NO_ENUM.length - estatisticos.length).toBe(5);
  });

  it("todo painel de outra forma tem unidade declarada", () => {
    const sem = REGISTRO_DE_PAINEIS.filter(
      (p) => p.unidade === null && p.forma !== "estatisticas",
    ).map((p) => p.id);
    expect(sem.sort()).toEqual([
      "eng-enps",
      "rec-funil",
      "rec-vagas",
      "tre-area",
      "tre-horas",
    ]);
  });
});
