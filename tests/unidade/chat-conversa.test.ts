import { describe, expect, it } from "vitest";

import {
  CONVERSA_VAZIA,
  desserializar,
  destinoDe,
  filtrosAplicados,
  historicoDe,
  separarLinhas,
  serializar,
  type Conversa,
  type Turno,
} from "@/apresentacao/chat/conversa";
import type { Resposta } from "@/chat/perguntar";
import { TURNOS_LEMBRADOS } from "@/chat/protocolo";
import type { Resolucao } from "@/chat/resolver";
import { QUERY_PADRAO } from "@/semantica/contrato";

/**
 * O estado da conversa no navegador, sem navegador (T-340 em parte).
 *
 * As regras de `conversa.ts` são funções puras: o que vira histórico, o que
 * sobrevive a recarregar, para onde a tela vai. Aqui elas são exercitadas
 * sem React e sem `sessionStorage`.
 */

function resolucao(metrica: string): Resolucao {
  return {
    metrica,
    rotulo: metrica,
    valor: 1,
    unidade: "pct",
    formula: "a / b",
    decisao: null,
    asOf: "2026-12-31",
    consideracoes: [],
    familia: null,
    referencias: [],
    comparacao: null,
    comparacaoIndisponivelPorque: null,
    acoes: { filtros: QUERY_PADRAO, tela: "rh/visao", painel: "rh-turnover" },
    fontes: ["vw_teste"],
    painel: null,
  };
}

function respondida(metrica: string): Resposta {
  return {
    tipo: "resposta",
    texto: "texto",
    autoria: "montado",
    resolucao: resolucao(metrica),
    sugestoes: [],
  };
}

const RECUSA: Resposta = { tipo: "recusa", texto: "não", alternativas: [] };

function turno(id: string, parcial: Partial<Turno> = {}): Turno {
  return {
    id,
    pergunta: `pergunta ${id}`,
    origem: "/rh/visao",
    estado: "pronta",
    previa: null,
    resposta: respondida("turnover_12m"),
    falha: null,
    ...parcial,
  };
}

describe("historicoDe", () => {
  it("leva pergunta e métrica de cada turno respondido, e null para recusa", () => {
    const turnos = [
      turno("1"),
      turno("2", { resposta: RECUSA }),
      turno("3", { resposta: respondida("roe") }),
    ];
    expect(historicoDe(turnos)).toEqual([
      { pergunta: "pergunta 1", metrica: "turnover_12m" },
      { pergunta: "pergunta 2", metrica: null },
      { pergunta: "pergunta 3", metrica: "roe" },
    ]);
  });

  it("deixa de fora o turno que ainda não tem resposta", () => {
    const turnos = [
      turno("1"),
      turno("2", { estado: "consultando", resposta: null }),
    ];
    expect(historicoDe(turnos)).toHaveLength(1);
  });

  it("lembra só os últimos turnos", () => {
    const turnos = Array.from({ length: TURNOS_LEMBRADOS + 3 }, (_, i) =>
      turno(String(i)),
    );
    const historico = historicoDe(turnos);
    expect(historico).toHaveLength(TURNOS_LEMBRADOS);
    expect(historico.at(-1)?.pergunta).toBe(
      `pergunta ${String(TURNOS_LEMBRADOS + 2)}`,
    );
  });
});

describe("destinoDe", () => {
  it("é a tela citada, com o recorte da resposta e o painel destacado", () => {
    expect(
      destinoDe(
        {
          filtros: { ...QUERY_PADRAO, periodo: "dezembro" },
          tela: "fin/visao",
          painel: "fin-dre",
        },
        "/rh/visao",
      ),
    ).toBe("/fin/visao?periodo=dezembro&painel=fin-dre");
  });

  it("sem tela citada, fica na tela atual com o recorte novo", () => {
    expect(
      destinoDe(
        {
          filtros: { ...QUERY_PADRAO, entidade: "unidade-sp" },
          tela: null,
          painel: null,
        },
        "/fin/caixa",
      ),
    ).toBe("/fin/caixa?entidade=unidade-sp");
  });
});

describe("filtrosAplicados", () => {
  it("lista só o que difere do padrão, na ordem da tabela 6.2", () => {
    expect(
      filtrosAplicados(
        { ...QUERY_PADRAO, area: "tecnologia", periodo: "dezembro" },
        QUERY_PADRAO,
      ),
    ).toEqual(["periodo", "area"]);
    expect(filtrosAplicados(QUERY_PADRAO, QUERY_PADRAO)).toEqual([]);
  });
});

describe("separarLinhas", () => {
  it("devolve as linhas inteiras e guarda o pedaço que ainda está chegando", () => {
    expect(separarLinhas('{"a":1}\n{"b":2}\n{"c"')).toEqual({
      completas: ['{"a":1}', '{"b":2}'],
      resto: '{"c"',
    });
  });

  it("um pedaço sem quebra é todo resto", () => {
    expect(separarLinhas('{"a"')).toEqual({ completas: [], resto: '{"a"' });
  });

  it("linha vazia não conta", () => {
    expect(separarLinhas("\n\n{}\n")).toEqual({ completas: ["{}"], resto: "" });
  });
});

describe("serializar e desserializar", () => {
  it("fazem o round-trip de uma conversa terminada", () => {
    const conversa: Conversa = {
      aberto: true,
      turnos: [
        turno("1"),
        turno("2", { estado: "falhou", falha: "rede", resposta: null }),
      ],
    };
    expect(desserializar(serializar(conversa))).toEqual(conversa);
  });

  it("deixa cair o turno que ficou a meio", () => {
    const conversa: Conversa = {
      aberto: true,
      turnos: [
        turno("1"),
        turno("2", { estado: "consultando", resposta: null }),
      ],
    };
    expect(
      desserializar(serializar(conversa))?.turnos.map((t) => t.id),
    ).toEqual(["1"]);
  });

  it("recusa o que não é conversa", () => {
    expect(desserializar(null)).toBeNull();
    expect(desserializar("")).toBeNull();
    expect(desserializar("não é json")).toBeNull();
    expect(desserializar("[]")).toBeNull();
    expect(
      desserializar(JSON.stringify({ versao: 99, turnos: [] })),
    ).toBeNull();
    expect(
      desserializar(JSON.stringify({ versao: 1, turnos: "x" })),
    ).toBeNull();
  });

  it("a conversa vazia sobrevive como vazia", () => {
    expect(desserializar(serializar(CONVERSA_VAZIA))).toEqual(CONVERSA_VAZIA);
  });
});
