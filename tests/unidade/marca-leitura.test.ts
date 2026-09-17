import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { PALETA } from "@/apresentacao/tema/tema";
import { registrarArmazem, type ArmazemDaMarca } from "@/marca/armazem";
import {
  ESTADO_VAZIO,
  VERSAO_DA_MARCA,
  type EstadoDaMarca,
  type Marca,
} from "@/marca/documento";
import {
  aplicarMarca,
  descartarProposta,
  guardarProposta,
  lerMarcaAtiva,
  lerPropostaPendente,
  limparMarca,
  PersonalizacaoDesligada,
} from "@/marca/leitura";
import { registrarArmazensDoProduto } from "@/marca/registrar";

/**
 * O caminho da tela até a marca (D-MARCA).
 *
 * O que se prova aqui é a cadeia: a leitura vai ao armazém configurado e
 * nunca lança; a escrita preserva o que não mudou e recusa quando não há
 * armazém. Uma memória por processo foi construída e retirada (T-278): o
 * cabeçalho de `src/marca/leitura.ts` conta por quê, e o teste que existia
 * para ela saiu junto — o que fica é a leitura por requisição.
 */

const MARCA: Marca = {
  versao: VERSAO_DA_MARCA,
  origem: "manual",
  site: null,
  nome: "Dreamy S.A.",
  cores: {
    marca: PALETA.marca,
    marcaEscura: PALETA.marcaEscura,
    destaque: PALETA.destaque,
    destaqueSuave: PALETA.destaqueSuave,
    barraLateral: PALETA.barraLateral,
  },
  logo: null,
  aplicadaEm: "2026-09-17T12:00:00.000Z",
  aplicadaPor: { sujeito: "fixtures:diretoria", perfil: "diretoria" },
  extracao: { autoria: "manual", modelo: null, ajustes: [] },
};

const PROPOSTA = {
  origem: "manual",
  site: null,
  nome: "Outra",
  cores: MARCA.cores,
  coresOriginais: MARCA.cores,
  logo: null,
  logoRecusado: null,
  extracao: MARCA.extracao,
  candidatos: 0,
  avisos: [],
  propostaEm: "2026-09-17T12:00:00.000Z",
} as const;

/** Um armazém que conta as leituras e guarda o que recebe. */
function armazemInstrumentado(inicial: EstadoDaMarca = ESTADO_VAZIO) {
  let estado = inicial;
  const contagem = { leituras: 0, gravacoes: 0 };
  const armazem: ArmazemDaMarca = {
    ler: async () => {
      contagem.leituras += 1;
      return estado;
    },
    gravar: async (novo) => {
      contagem.gravacoes += 1;
      estado = novo;
    },
    limpar: async () => {
      estado = ESTADO_VAZIO;
    },
  };
  return { armazem, contagem, atual: () => estado };
}

let instrumentado: ReturnType<typeof armazemInstrumentado>;

beforeEach(() => {
  vi.stubEnv("MARCA_ARMAZEM", "memoria");
  instrumentado = armazemInstrumentado({
    versao: VERSAO_DA_MARCA,
    aplicada: MARCA,
    proposta: null,
  });
  // O modo `memoria` passa a apontar para o armazém instrumentado.
  registrarArmazem("memoria", async () => instrumentado.armazem);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(() => {
  registrarArmazensDoProduto();
});

describe("a leitura", () => {
  it("vai ao armazém configurado e devolve a marca e a proposta", async () => {
    expect((await lerMarcaAtiva())?.nome).toBe("Dreamy S.A.");
    expect(await lerPropostaPendente()).toBeNull();
    expect(instrumentado.contagem.leituras).toBeGreaterThan(0);
  });

  it("o que se grava é o que a leitura seguinte vê, sem espera", async () => {
    expect(await lerMarcaAtiva()).toEqual(MARCA);
    await limparMarca();
    expect(await lerMarcaAtiva()).toBeNull();
    await aplicarMarca({ ...MARCA, nome: "Outra" });
    expect((await lerMarcaAtiva())?.nome).toBe("Outra");
  });

  it("armazém que lança devolve o estado vazio, e não derruba a tela", async () => {
    registrarArmazem("memoria", async () => ({
      ler: async () => {
        throw new Error("banco fora");
      },
      gravar: async () => undefined,
      limpar: async () => undefined,
    }));
    expect(await lerMarcaAtiva()).toBeNull();
    expect(await lerPropostaPendente()).toBeNull();
  });

  it("com a personalização desligada, lê o estado vazio sem tocar armazém", async () => {
    vi.stubEnv("MARCA_ARMAZEM", "");
    expect(await lerMarcaAtiva()).toBeNull();
    expect(instrumentado.contagem.leituras).toBe(0);
  });
});

describe("a escrita", () => {
  it("guardar a proposta preserva a marca em uso", async () => {
    await guardarProposta(PROPOSTA);
    expect(instrumentado.atual().aplicada).toEqual(MARCA);
    expect(instrumentado.atual().proposta?.nome).toBe("Outra");
  });

  it("descartar a proposta preserva a marca em uso", async () => {
    await guardarProposta(PROPOSTA);
    await descartarProposta();
    expect(instrumentado.atual().aplicada).toEqual(MARCA);
    expect(instrumentado.atual().proposta).toBeNull();
  });

  it("aplicar grava a marca e limpa a proposta numa escrita só", async () => {
    await guardarProposta(PROPOSTA);
    const antes = instrumentado.contagem.gravacoes;
    await aplicarMarca({ ...MARCA, nome: "Outra" });
    expect(instrumentado.contagem.gravacoes).toBe(antes + 1);
    expect(instrumentado.atual().aplicada?.nome).toBe("Outra");
    expect(instrumentado.atual().proposta).toBeNull();
  });

  it("toda gravação escreve a versão atual do documento", async () => {
    await guardarProposta(PROPOSTA);
    expect(instrumentado.atual().versao).toBe(VERSAO_DA_MARCA);
  });

  it("sem armazém, a escrita recusa em vez de aceitar e perder", async () => {
    vi.stubEnv("MARCA_ARMAZEM", "");
    await expect(aplicarMarca(MARCA)).rejects.toBeInstanceOf(
      PersonalizacaoDesligada,
    );
    await expect(limparMarca()).rejects.toBeInstanceOf(PersonalizacaoDesligada);
  });
});
