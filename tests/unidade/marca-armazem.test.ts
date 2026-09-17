/* eslint-disable no-restricted-syntax --
 * A regra de T-124 existe para a paleta do produto não se espalhar pelo
 * código. O que aparece aqui é outra coisa: cor de um site fictício, cor de
 * entrada inválida, e os dois extremos da escala. Nenhuma delas é papel de
 * tema, e escrevê-las por outro caminho seria esconder o dado do caso.
 */
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PALETA } from "@/apresentacao/tema/tema";
import {
  ARMAZENS,
  ArmazemInvalido,
  FalhaAoGravarMarca,
  armazensRegistrados,
  lerModoDeArmazem,
  limparArmazens,
  obterArmazemDaMarca,
  personalizacaoLigada,
  registrarArmazem,
  type ArmazemDaMarca,
} from "@/marca/armazem";
import {
  criarArmazemEmArquivo,
  NOME_DO_ARQUIVO,
} from "@/marca/armazens/arquivo";
import {
  criarArmazemEmMemoria,
  esquecerMarcaEmMemoria,
} from "@/marca/armazens/memoria";
import {
  ESTADO_VAZIO,
  lerEstado,
  lerMarca,
  VERSAO_DA_MARCA,
  type Marca,
} from "@/marca/documento";
import { registrarArmazensDoProduto } from "@/marca/registrar";
import { conferirAmbiente } from "@/seguranca/configuracao";

/**
 * O armazém da marca: a primeira escrita de estado do produto (D-MARCA).
 *
 * A suíte de contrato roda igual nos dois adaptadores que o CI alcança, no
 * molde de `src/acesso/contrato/suite.ts`: trocar quem responde não muda o
 * arquivo de casos nem as regras.
 */

const MARCA: Marca = {
  versao: VERSAO_DA_MARCA,
  site: "https://dreamy.com.br/",
  cores: {
    marca: PALETA.marca,
    marcaEscura: PALETA.marcaEscura,
    destaque: PALETA.destaque,
    destaqueSuave: PALETA.destaqueSuave,
    barraLateral: PALETA.barraLateral,
  },
  logo: null,
  aplicadaEm: "2026-09-04T12:00:00.000Z",
  aplicadaPor: { sujeito: "fixtures:diretoria", perfil: "diretoria" },
  extracao: { autoria: "deterministica", modelo: null, ajustes: [] },
};

/* ------------------------------------------------------------------ *
 * A suíte de contrato
 * ------------------------------------------------------------------ */

function suiteDeContrato(
  nome: string,
  montar: () => Promise<{
    armazem: ArmazemDaMarca;
    encerrar: () => Promise<void>;
  }>,
) {
  describe(`contrato do armazém · ${nome}`, () => {
    let armazem: ArmazemDaMarca;
    let encerrar: () => Promise<void>;

    beforeEach(async () => {
      ({ armazem, encerrar } = await montar());
    });
    afterEach(async () => {
      await encerrar();
    });

    it("sem nada gravado, devolve o estado vazio", async () => {
      expect(await armazem.ler()).toEqual(ESTADO_VAZIO);
    });

    it("o que se grava é o que se lê", async () => {
      await armazem.gravar({
        versao: VERSAO_DA_MARCA,
        aplicada: MARCA,
        proposta: null,
      });
      expect((await armazem.ler()).aplicada).toEqual(MARCA);
    });

    it("gravar duas vezes vale a última", async () => {
      await armazem.gravar({
        versao: VERSAO_DA_MARCA,
        aplicada: MARCA,
        proposta: null,
      });
      const outra = { ...MARCA, site: "https://outra.com.br/" };
      await armazem.gravar({
        versao: VERSAO_DA_MARCA,
        aplicada: outra,
        proposta: null,
      });
      expect((await armazem.ler()).aplicada?.site).toBe(
        "https://outra.com.br/",
      );
    });

    it("limpar volta ao estado vazio", async () => {
      await armazem.gravar({
        versao: VERSAO_DA_MARCA,
        aplicada: MARCA,
        proposta: null,
      });
      await armazem.limpar();
      expect(await armazem.ler()).toEqual(ESTADO_VAZIO);
    });

    it("limpar o que já está limpo é sucesso, não erro", async () => {
      await expect(armazem.limpar()).resolves.toBeUndefined();
    });
  });
}

suiteDeContrato("memória", async () => {
  // O estado do modo em memória mora no escopo do processo, e não numa
  // variável do objeto: dois casos seguidos precisam começar do zero.
  esquecerMarcaEmMemoria();
  return {
    armazem: criarArmazemEmMemoria(),
    encerrar: async () => {
      esquecerMarcaEmMemoria();
    },
  };
});

suiteDeContrato("arquivo", async () => {
  const diretorio = await mkdtemp(join(tmpdir(), "marca-"));
  return {
    armazem: criarArmazemEmArquivo(diretorio),
    encerrar: async () => {
      await rm(diretorio, { recursive: true, force: true });
    },
  };
});

/* ------------------------------------------------------------------ *
 * O que é próprio do adaptador de arquivo
 * ------------------------------------------------------------------ */

describe("o armazém em arquivo", () => {
  let diretorio: string;

  beforeEach(async () => {
    diretorio = await mkdtemp(join(tmpdir(), "marca-"));
  });
  afterEach(async () => {
    await rm(diretorio, { recursive: true, force: true });
  });

  it("grava um JSON legível no diretório montado", async () => {
    const armazem = criarArmazemEmArquivo(diretorio);
    await armazem.gravar({
      versao: VERSAO_DA_MARCA,
      aplicada: MARCA,
      proposta: null,
    });
    const bruto = await readFile(join(diretorio, NOME_DO_ARQUIVO), "utf8");
    expect(JSON.parse(bruto)).toMatchObject({ versao: VERSAO_DA_MARCA });
  });

  it("arquivo corrompido devolve o estado vazio, e não derruba a tela", async () => {
    await writeFile(
      join(diretorio, NOME_DO_ARQUIVO),
      "{ isto não é json",
      "utf8",
    );
    expect(await criarArmazemEmArquivo(diretorio).ler()).toEqual(ESTADO_VAZIO);
  });

  it("gravação impossível lança, em vez de falhar em silêncio", async () => {
    // Um caminho que não pode virar diretório: o pai é um arquivo.
    const arquivo = join(diretorio, "arquivo");
    await writeFile(arquivo, "x", "utf8");
    const armazem = criarArmazemEmArquivo(join(arquivo, "dentro"));
    await expect(
      armazem.gravar({
        versao: VERSAO_DA_MARCA,
        aplicada: MARCA,
        proposta: null,
      }),
    ).rejects.toBeInstanceOf(FalhaAoGravarMarca);
  });

  it("não deixa arquivo temporário para trás quando a gravação falha", async () => {
    const arquivo = join(diretorio, "outro");
    await writeFile(arquivo, "x", "utf8");
    const armazem = criarArmazemEmArquivo(join(arquivo, "dentro"));
    await armazem
      .gravar({ versao: VERSAO_DA_MARCA, aplicada: MARCA, proposta: null })
      .catch(() => undefined);
    // O diretório original continua com o único arquivo que criamos.
    expect(await readFile(arquivo, "utf8")).toBe("x");
  });
});

/* ------------------------------------------------------------------ *
 * A fábrica
 * ------------------------------------------------------------------ */

describe("a fábrica de armazém", () => {
  afterEach(() => {
    limparArmazens();
  });

  it("tem exatamente três modos", () => {
    expect([...ARMAZENS]).toEqual(["memoria", "arquivo", "postgres"]);
  });

  it("ausência é resposta: a personalização fica desligada", () => {
    expect(lerModoDeArmazem({})).toBeNull();
    expect(lerModoDeArmazem({ MARCA_ARMAZEM: "" })).toBeNull();
    expect(personalizacaoLigada({})).toBe(false);
    expect(personalizacaoLigada({ MARCA_ARMAZEM: "memoria" })).toBe(true);
  });

  it("valor escrito errado aborta, nomeando os aceitos", () => {
    expect(() => lerModoDeArmazem({ MARCA_ARMAZEM: "arquivos" })).toThrow(
      ArmazemInvalido,
    );
    try {
      lerModoDeArmazem({ MARCA_ARMAZEM: "s3" });
    } catch (erro) {
      expect(String(erro)).toContain("memoria, arquivo, postgres");
    }
  });

  it("desligada, a fábrica devolve nulo em vez de inventar armazém", async () => {
    expect(await obterArmazemDaMarca({})).toBeNull();
  });

  it("modo válido sem implementação registrada aborta", async () => {
    await expect(
      obterArmazemDaMarca({ MARCA_ARMAZEM: "postgres" }),
    ).rejects.toBeInstanceOf(ArmazemInvalido);
  });

  it("o registro é explícito", async () => {
    expect(armazensRegistrados()).toEqual([]);
    registrarArmazem("memoria", async () => criarArmazemEmMemoria());
    expect(armazensRegistrados()).toEqual(["memoria"]);
    expect(
      await obterArmazemDaMarca({ MARCA_ARMAZEM: "memoria" }),
    ).not.toBeNull();
  });
});

/* ------------------------------------------------------------------ *
 * A leitura defensiva
 * ------------------------------------------------------------------ */

describe("ler o documento guardado", () => {
  it("aceita o que gravamos", () => {
    expect(lerMarca(JSON.parse(JSON.stringify(MARCA)))).toEqual(MARCA);
  });

  it.each([
    ["nada", null],
    ["texto", "marca"],
    ["objeto vazio", {}],
    ["versão desconhecida", { ...MARCA, versao: 99 }],
    ["sem site", { ...MARCA, site: "" }],
    [
      "perfil que não existe",
      { ...MARCA, aplicadaPor: { sujeito: "x", perfil: "chefe" } },
    ],
    ["sem cores", { ...MARCA, cores: {} }],
  ])("recusa %s", (_, bruto) => {
    expect(lerMarca(bruto)).toBeNull();
  });

  /**
   * A conferência de forma acontece de novo na saída, e não só na entrada.
   *
   * O arquivo mora num diretório montado e alguém pode editá-lo. A cor vai
   * para dentro de uma folha de estilo, e a política de segurança tem
   * `unsafe-inline` em estilo: um valor com chave de fechamento escreveria
   * regra arbitrária na página.
   */
  it("recusa cor fora da forma, mesmo vinda do arquivo", () => {
    expect(
      lerMarca({
        ...MARCA,
        cores: { ...MARCA.cores, marca: "#fff}html{display:none}" },
      }),
    ).toBeNull();
    expect(
      lerMarca({ ...MARCA, cores: { ...MARCA.cores, marca: "red" } }),
    ).toBeNull();
  });

  it("documento quebrado vira estado vazio, e não exceção", () => {
    expect(lerEstado({ versao: 99 })).toEqual(ESTADO_VAZIO);
    expect(lerEstado(null)).toEqual(ESTADO_VAZIO);
    expect(lerEstado({ versao: VERSAO_DA_MARCA, aplicada: "x" })).toEqual(
      ESTADO_VAZIO,
    );
  });

  /** LGPD, barato: nada que pareça pessoa entra no documento. */
  it("o documento não carrega nome nem endereço de e-mail", () => {
    expect(JSON.stringify(MARCA)).not.toMatch(/@/);
  });
});

/* ------------------------------------------------------------------ *
 * A configuracao
 * ------------------------------------------------------------------ */

describe("as variaveis da marca no boot", () => {
  const MINIMO = { DATA_SOURCE: "fixtures", AUTH_PROVIDER: "fixtures" };
  const problemas = (extra: Record<string, string>) =>
    conferirAmbiente({ ...MINIMO, ...extra }).map((p) => p.variavel);

  it("ausencia nao e problema: a personalizacao fica desligada", () => {
    expect(problemas({})).toEqual([]);
  });

  it("modo escrito errado e acusado", () => {
    expect(problemas({ MARCA_ARMAZEM: "s3" })).toContain("MARCA_ARMAZEM");
  });

  it("arquivo exige o diretorio, e o diretorio precisa ser absoluto", () => {
    expect(problemas({ MARCA_ARMAZEM: "arquivo" })).toContain("MARCA_DIR");
    expect(
      problemas({ MARCA_ARMAZEM: "arquivo", MARCA_DIR: "marca" }),
    ).toContain("MARCA_DIR");
    expect(
      problemas({ MARCA_ARMAZEM: "arquivo", MARCA_DIR: "./marca" }),
    ).toContain("MARCA_DIR");
  });

  it.each(["/var/lib/amanna-bi/marca", "C:\\dados\\marca", "C:/dados/marca"])(
    "aceita o caminho absoluto %s",
    (dir) => {
      expect(problemas({ MARCA_ARMAZEM: "arquivo", MARCA_DIR: dir })).toEqual(
        [],
      );
    },
  );

  it("nuvem exige a conexão com o banco", () => {
    expect(problemas({ MARCA_ARMAZEM: "postgres" })).toContain("DATABASE_URL");
  });

  /**
   * As duas combinacoes que sobem **quase** certo.
   *
   * Arquivo em disco efemero grava, le na mesma invocacao e some depois;
   * memoria na frente de dado real perde a marca a cada reinicio. As duas
   * mostram "aplicado" na tela e falham em silencio horas depois.
   */
  it("arquivo em disco efemero aborta o boot", () => {
    expect(
      problemas({
        MARCA_ARMAZEM: "arquivo",
        MARCA_DIR: "/tmp/marca",
        VERCEL: "1",
      }),
    ).toContain("MARCA_ARMAZEM");
  });

  it("memoria na frente de dado real aborta o boot", () => {
    const achados = conferirAmbiente({
      DATA_SOURCE: "warehouse",
      DATABASE_URL: "postgres://u:s@h:5432/d",
      AUTH_PROVIDER: "oidc",
      MARCA_ARMAZEM: "memoria",
    }).map((p) => p.variavel);
    expect(achados).toContain("MARCA_ARMAZEM");
  });

  it("a fonte de site escrita errada e acusada", () => {
    expect(problemas({ MARCA_SITE: "internet" })).toContain("MARCA_SITE");
    expect(problemas({ MARCA_SITE: "fixtures" })).toEqual([]);
    expect(problemas({ MARCA_SITE: "rede" })).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * O registro de verdade, como o produto o monta
 * ------------------------------------------------------------------ */

describe("os armazens registrados pelo produto", () => {
  // O bloco anterior limpa a fabrica no fim de cada caso; aqui a montagem do
  // produto e refeita, que e justamente o que se quer exercitar.
  beforeEach(() => {
    registrarArmazensDoProduto();
  });

  /**
   * O armazem em memoria precisa ser o **mesmo** entre chamadas.
   *
   * A fabrica chama o construtor toda vez que alguem pede o armazem. Com um
   * construtor que cria instancia nova, a gravacao ia para uma e a leitura
   * vinha de outra vazia: a tela dizia "aplicado" e o painel nao mudava. O
   * defeito so apareceu no arnes de ponta a ponta, que usa justamente este
   * modo, e por isso ele vira caso de unidade aqui.
   */
  it("memoria devolve sempre o mesmo, e o que se grava se le", async () => {
    const ambiente = { MARCA_ARMAZEM: "memoria" };
    const um = await obterArmazemDaMarca(ambiente);
    const dois = await obterArmazemDaMarca(ambiente);
    expect(um).toBe(dois);

    await um?.gravar({
      versao: VERSAO_DA_MARCA,
      aplicada: MARCA,
      proposta: null,
    });
    expect((await dois?.ler())?.aplicada?.site).toBe(MARCA.site);
    await um?.limpar();
  });
});
