/**
 * Os cinco filtros da tabela 6.2 e o banner de recorte ativo (T-128).
 *
 * O aceite tem duas metades, e esta cobre a que não precisa de navegador:
 *
 * 1. **cada controle expõe exatamente os valores da 6.2, com o padrão
 *    selecionado** — a tabela é lida do PRD.md, não copiada para cá;
 * 2. **o banner aparece se e somente se ao menos um filtro difere do padrão, e
 *    lista os que diferem** — provado nos 5 casos isolados, num combinado, e
 *    depois na matriz canônica inteira.
 *
 * O que só o navegador prova — Tab, setas, Enter e o clique em "Voltar ao
 * consolidado" — está em `tests/e2e/barra-de-filtros.spec.ts`.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ANOS_DA_FIXTURE,
  dimensoesProvisorias,
} from "@/acesso/dimensoes-provisorias";
import {
  filtrosForaDoPadrao,
  temRecorteAtivo,
} from "@/apresentacao/filtros/recorte-ativo";
import type { Query } from "@/semantica/contrato";
import { QUERY_PADRAO } from "@/semantica/contrato";
import {
  DIMENSOES,
  FILTROS,
  ROTULO_DO_FILTRO,
  rotuloDe,
  type NomeDeFiltro,
} from "@/semantica/dimensoes";
import { matrizDeRecortes } from "@/semantica/recortes";

const RAIZ = process.cwd();

/* ------------------------------------------------------------------ *
 * A tabela 6.2, lida do documento
 * ------------------------------------------------------------------ */

type LinhaDa62 = {
  readonly filtro: string;
  readonly valores: readonly string[];
  readonly padrao: string;
  /** `Área` escreve "`Todas` + as 7 áreas" em vez de listar. */
  readonly listaCompleta: boolean;
};

function tabela62(): readonly LinhaDa62[] {
  const prd = readFileSync(resolve(RAIZ, "PRD.md"), "utf8");
  const inicio = prd.indexOf("### 6.2");
  const trecho = prd.slice(inicio, prd.indexOf("### 6.3", inicio));
  const linhas: LinhaDa62[] = [];
  for (const linha of trecho.split("\n")) {
    const m = /^\| ([^|]+?) \| (.+?) \| `(.+?)` \|$/.exec(linha);
    if (m === null) continue;
    const filtro = (m[1] ?? "").trim();
    if (filtro === "Filtro") continue;
    const celula = m[2] ?? "";
    linhas.push({
      filtro,
      valores: [...celula.matchAll(/`([^`]+)`/g)].map((x) => x[1] ?? ""),
      padrao: m[3] ?? "",
      // "`Todas` + as 7 áreas": a célula tem prosa além das crases.
      listaCompleta: !/\+ as \d+/.test(celula),
    });
  }
  return linhas;
}

const SEIS2 = tabela62();

/** O que a barra realmente oferece para um filtro, em rótulos. */
function rotulosOferecidos(campo: NomeDeFiltro): readonly string[] {
  const d = dimensoesProvisorias();
  const codigos = campo === "ano" ? (d.ano ?? []) : d[campo];
  return codigos.map((c) => rotuloDe(campo, c));
}

describe("a tabela 6.2 foi lida — senão o resto não prova nada", () => {
  it("são cinco linhas, na ordem do documento", () => {
    expect(SEIS2.map((l) => l.filtro)).toEqual([
      "Período",
      "Ano",
      "Entidade",
      "Área",
      "Modalidade",
    ]);
  });

  it("a linha de Área é a única que não lista os valores", () => {
    expect(SEIS2.filter((l) => !l.listaCompleta).map((l) => l.filtro)).toEqual([
      "Área",
    ]);
  });
});

describe("cada controle expõe exatamente os valores da 6.2", () => {
  it("os cinco filtros da barra são os cinco da tabela, na mesma ordem", () => {
    expect(FILTROS.map((c) => ROTULO_DO_FILTRO[c])).toEqual(
      SEIS2.map((l) => l.filtro),
    );
  });

  it.each(FILTROS)("%s: os valores oferecidos são os da 6.2", (campo) => {
    const linha = SEIS2.find((l) => l.filtro === ROTULO_DO_FILTRO[campo]);
    expect(linha, `${campo} não está na 6.2`).toBeDefined();
    if (linha === undefined || !linha.listaCompleta) return;
    expect(rotulosOferecidos(campo)).toEqual(linha.valores);
  });

  it("área oferece 'Todas' mais as sete áreas, como a 6.2 resume", () => {
    // A célula não lista as sete, então o que dá para conferir é a forma:
    // 'Todas' na frente e mais sete depois.
    const oferecidos = rotulosOferecidos("area");
    expect(oferecidos[0]).toBe("Todas");
    expect(oferecidos).toHaveLength(DIMENSOES.area.length);
    expect(oferecidos).toHaveLength(8);
  });

  it.each(FILTROS)("%s: o padrão da 6.2 é o valor selecionado", (campo) => {
    const linha = SEIS2.find((l) => l.filtro === ROTULO_DO_FILTRO[campo]);
    expect(rotuloDe(campo, QUERY_PADRAO[campo])).toBe(linha?.padrao);
  });

  it("o padrão está entre os valores oferecidos", () => {
    // Sem isto, um `<select>` abriria mostrando a primeira opção enquanto o
    // recorte real é outro — e enviar o formulário mudaria o recorte sem que
    // ninguém tivesse pedido.
    for (const campo of FILTROS) {
      expect(rotulosOferecidos(campo), campo).toContain(
        rotuloDe(campo, QUERY_PADRAO[campo]),
      );
    }
  });

  it("a lista provisória de anos é a que a 6.2 declara", () => {
    // `ANOS_DA_FIXTURE` sai quando `getMeta` existir (T-149). Enquanto existe,
    // é isto que impede que ela envelheça em silêncio.
    const linha = SEIS2.find((l) => l.filtro === "Ano");
    expect([...ANOS_DA_FIXTURE]).toEqual(linha?.valores);
  });
});

/* ------------------------------------------------------------------ *
 * O banner
 * ------------------------------------------------------------------ */

/** Um recorte igual ao padrão, com um único filtro trocado. */
function comUm(campo: NomeDeFiltro, valor: string): Query {
  return { ...QUERY_PADRAO, [campo]: valor };
}

const CASOS_ISOLADOS: ReadonlyArray<{
  readonly campo: NomeDeFiltro;
  readonly valor: string;
  readonly esperado: string;
}> = [
  { campo: "periodo", valor: "4-trimestre", esperado: "Período: 4º trimestre" },
  { campo: "ano", valor: "2025", esperado: "Ano: 2025" },
  { campo: "entidade", valor: "unidade-sp", esperado: "Entidade: Unidade SP" },
  { campo: "area", valor: "operacoes", esperado: "Área: Operações" },
  { campo: "modalidade", valor: "hibrido", esperado: "Modalidade: Híbrido" },
];

describe("o banner aparece se e somente se algum filtro difere do padrão", () => {
  it("no recorte consolidado não há nada a listar", () => {
    expect(filtrosForaDoPadrao(QUERY_PADRAO)).toEqual([]);
    expect(temRecorteAtivo(QUERY_PADRAO)).toBe(false);
  });

  it.each(CASOS_ISOLADOS)(
    "$campo fora do padrão: lista só ele",
    ({ campo, valor, esperado }) => {
      const fora = filtrosForaDoPadrao(comUm(campo, valor));
      expect(fora.map((f) => f.campo)).toEqual([campo]);
      expect(`${fora[0]?.rotuloDoCampo}: ${fora[0]?.rotuloDoValor}`).toBe(
        esperado,
      );
      expect(temRecorteAtivo(comUm(campo, valor))).toBe(true);
    },
  );

  it("combinado: os cinco fora do padrão, na ordem da 6.2", () => {
    const q: Query = {
      periodo: "dezembro",
      ano: "2025",
      entidade: "demais-unidades",
      area: "logistica",
      modalidade: "remoto",
    };
    const fora = filtrosForaDoPadrao(q);
    expect(fora.map((f) => f.campo)).toEqual([...FILTROS]);
    expect(
      fora.map((f) => `${f.rotuloDoCampo}: ${f.rotuloDoValor}`).join(" · "),
    ).toBe(
      "Período: Dezembro · Ano: 2025 · Entidade: Demais unidades · " +
        "Área: Logística · Modalidade: Remoto",
    );
  });

  it("o banner lista rótulo, nunca código", () => {
    // O código atravessa URL e cache; o rótulo é o que a pessoa lê (T-186).
    // Sem isto, o banner mostraria "Área: logistica".
    const fora = filtrosForaDoPadrao(comUm("area", "logistica"));
    expect(fora[0]?.rotuloDoValor).toBe("Logística");
    expect(fora[0]?.codigo).toBe("logistica");
  });

  it("na matriz canônica inteira, o banner e a diferença andam juntos", () => {
    /*
     * O "se e somente se" na forma mais forte que cabe num teste de unidade.
     *
     * Percorre os recortes canônicos e confere, em cada um, que
     * `temRecorteAtivo` concorda com a comparação campo a campo contra o
     * padrão. Um erro de sinal em qualquer filtro aparece aqui.
     */
    const recortes = matrizDeRecortes(dimensoesProvisorias());
    expect(recortes.length).toBe(768);

    const divergentes = recortes.filter((r) => {
      const q = r as unknown as Query;
      const difere = FILTROS.some((c) => q[c] !== QUERY_PADRAO[c]);
      return temRecorteAtivo(q) !== difere;
    });
    expect(divergentes).toEqual([]);
  });

  it("e há exatamente um recorte sem banner na matriz", () => {
    // A guarda contra o teste acima passar por vacuidade: se `temRecorteAtivo`
    // devolvesse sempre `true`, a comparação também seria sempre `true` e o
    // filtro sairia vazio. O padrão é um só, e é o consolidado.
    const recortes = matrizDeRecortes(dimensoesProvisorias());
    const semBanner = recortes.filter(
      (r) => !temRecorteAtivo(r as unknown as Query),
    );
    expect(semBanner).toHaveLength(1);
    expect(semBanner[0]).toMatchObject({ ...QUERY_PADRAO });
  });
});
