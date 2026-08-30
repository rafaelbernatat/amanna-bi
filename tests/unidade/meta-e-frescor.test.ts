/**
 * `getMeta`, o selo de frescor e o modo de falha (T-149).
 *
 * O que o aceite pede, e o que cada bloco abaixo afirma:
 *
 * 1. `getMeta` devolve as dimensões com os valores exatos da seção 6.2 — e o
 *    ano **derivado do dado**, que é a decisão D-P8 inteira;
 * 2. devolve a versão do catálogo, para "o número mudou" e "a definição mudou"
 *    deixarem de ser a mesma frase;
 * 3. o frescor traz `asOf`, o último sync, o limite e o estado; e nas três
 *    bordas — limite-1, limite e limite+1 — responde ok, ok e defasado;
 * 4. falha de fonte devolve **erro tipado** com o horário da última leitura
 *    bem-sucedida, e nunca dado parcial.
 */

import { describe, expect, it } from "vitest";

import { criarFonteDeFixtures } from "@/acesso/fixtures/adaptador";
import { calcularMeta } from "@/acesso/fixtures/meta";
import { criarLeitorDeMeta, MetaIndisponivel } from "@/acesso/meta";
import { VW_FATO_RH_MES } from "@/acesso/fixtures/rh";
import { anoDoMes } from "@/acesso/fixtures/eixos";
import { VERSAO_DO_CATALOGO } from "@/semantica/catalogo-gerado";
import type { DataSource, Meta } from "@/semantica/contrato";
import { AREAS, ENTIDADES, MODALIDADES, PERIODOS } from "@/semantica/contrato";
import {
  avaliarFrescor,
  estaDefasado,
  InstanteInvalido,
  LIMITE_PADRAO_DE_DEFASAGEM_HORAS,
} from "@/semantica/frescor";

/** Um instante fixo, para o teste não depender do relógio da máquina. */
const AGORA = new Date("2026-12-31T09:00:00Z");

const META = calcularMeta(AGORA);

/* ------------------------------------------------------------------ *
 * 1 · As dimensões
 * ------------------------------------------------------------------ */

describe("getMeta devolve as dimensões da seção 6.2", () => {
  it("as quatro fechadas vêm do vocabulário, sem cópia", () => {
    expect(META.dimensoes.periodo).toEqual(PERIODOS);
    expect(META.dimensoes.entidade).toEqual(ENTIDADES);
    expect(META.dimensoes.area).toEqual(AREAS);
    expect(META.dimensoes.modalidade).toEqual(MODALIDADES);
  });

  it("o ano é derivado do dado, e não de uma lista escrita", () => {
    /*
     * A decisão D-P8 em forma de teste. A afirmação não é "os anos são 2026" —
     * seria um literal a mais, e a lista literal é justamente o que a decisão
     * removeu. A afirmação é que a lista **é** o conjunto de anos presentes nas
     * linhas de fato: carregue 2024 e ele aparece; não carregue, não aparece.
     */
    const noDado = [...new Set(VW_FATO_RH_MES.map((l) => anoDoMes(l.mes)))]
      .sort()
      .reverse();

    expect(META.dimensoes.ano).toEqual(noDado);
    expect(META.dimensoes.ano?.length).toBeGreaterThan(0);
  });

  it("nenhum ano aparece duas vezes", () => {
    const anos = META.dimensoes.ano ?? [];
    expect(new Set(anos).size).toBe(anos.length);
  });
});

/* ------------------------------------------------------------------ *
 * 2 · A versão do catálogo
 * ------------------------------------------------------------------ */

describe("getMeta diz qual catálogo produziu os números", () => {
  it("a versão vem do catálogo gerado", () => {
    expect(META.versaoDoCatalogo).toBe(VERSAO_DO_CATALOGO);
    expect(META.versaoDoCatalogo).not.toBe("");
  });

  it("as métricas listadas são as do catálogo, em ordem", () => {
    expect(META.metricas.length).toBeGreaterThan(0);
    expect([...META.metricas]).toEqual([...META.metricas].sort());
  });
});

/* ------------------------------------------------------------------ *
 * 3 · O frescor, e as três bordas
 * ------------------------------------------------------------------ */

describe("o frescor traz os quatro campos", () => {
  it("asOf é o último fechamento carregado, e não o relógio", () => {
    // A fixture cobre 2026 inteiro; o fechamento é 31/12, mesmo lendo em agosto.
    expect(META.frescor.asOf).toBe("2026-12-31");
  });

  it("o limite viaja junto com o estado", () => {
    expect(META.frescor.limiteDefasagemHoras).toBe(
      LIMITE_PADRAO_DE_DEFASAGEM_HORAS,
    );
    expect(META.frescor.status).toBe("ok");
  });
});

describe("as três bordas do limite", () => {
  const LIMITE = 24;
  const SYNC = "2026-12-30T00:00:00Z";

  /** O instante `horas` depois do sync. */
  function depoisDe(horas: number): Date {
    const MS_POR_HORA = 3_600_000;
    return new Date(Date.parse(SYNC) + horas * MS_POR_HORA);
  }

  const CASOS = [
    { nome: "limite-1", horas: LIMITE - 1, esperado: "ok" },
    { nome: "limite", horas: LIMITE, esperado: "ok" },
    { nome: "limite+1", horas: LIMITE + 1, esperado: "defasado" },
  ] as const;

  it.each(CASOS)("$nome devolve $esperado", ({ horas, esperado }) => {
    const frescor = avaliarFrescor({
      asOf: "2026-12-31",
      sincronizadoEm: SYNC,
      limiteDefasagemHoras: LIMITE,
      agora: depoisDe(horas),
    });

    expect(frescor.status).toBe(esperado);
    expect(estaDefasado(frescor)).toBe(esperado === "defasado");
  });

  it("no limite exato ainda é ok, e isso não é detalhe", () => {
    /*
     * Com `>=`, um acordo de "24 horas" alarmaria na carga que levou exatamente
     * 24 — a carga que cumpriu o acordo. Um aviso que aparece quando nada
     * está errado é um aviso que se aprende a ignorar.
     */
    const noLimite = avaliarFrescor({
      asOf: "2026-12-31",
      sincronizadoEm: SYNC,
      limiteDefasagemHoras: LIMITE,
      agora: depoisDe(LIMITE),
    });
    expect(noLimite.status).toBe("ok");
  });

  it("instante ilegível reprova, em vez de virar ok ou defasado por acidente", () => {
    expect(() =>
      avaliarFrescor({
        asOf: "2026-12-31",
        sincronizadoEm: "ontem de madrugada",
        agora: AGORA,
      }),
    ).toThrow(InstanteInvalido);
  });
});

/* ------------------------------------------------------------------ *
 * 4 · O modo de falha
 * ------------------------------------------------------------------ */

/** Uma fonte que responde uma vez e depois cai. */
function fonteQueCaiDepoisDe(sucessos: number): DataSource {
  const real = criarFonteDeFixtures();
  let lidas = 0;
  return {
    ...real,
    getMeta(): Promise<Meta> {
      lidas += 1;
      if (lidas > sucessos) {
        return Promise.reject(new Error("conexão recusada"));
      }
      return real.getMeta();
    },
  };
}

describe("falha de fonte devolve erro tipado, nunca dado parcial", () => {
  it("erra com o horário da última leitura bem-sucedida", async () => {
    const leitor = criarLeitorDeMeta(fonteQueCaiDepoisDe(1));

    const boa = await leitor.ler(AGORA);
    expect(boa.frescor.status).toBe("ok");

    await expect(leitor.ler(AGORA)).rejects.toThrow(MetaIndisponivel);

    try {
      await leitor.ler(AGORA);
      expect.unreachable("a segunda leitura precisa falhar");
    } catch (erro) {
      expect(erro).toBeInstanceOf(MetaIndisponivel);
      const falha = erro as MetaIndisponivel;
      expect(falha.ultimoFrescor?.sincronizadoEm).toBe(
        boa.frescor.sincronizadoEm,
      );
      expect(falha.message).toContain(boa.frescor.sincronizadoEm);
    }
  });

  it("sem leitura bem-sucedida nenhuma, admite que não sabe", async () => {
    /*
     * Inventar um horário aqui seria pior que não ter: a tela diria "o dado é
     * de terça" sobre um processo que nunca leu nada.
     */
    const leitor = criarLeitorDeMeta(fonteQueCaiDepoisDe(0));

    try {
      await leitor.ler(AGORA);
      expect.unreachable("a leitura precisa falhar");
    } catch (erro) {
      const falha = erro as MetaIndisponivel;
      expect(falha.ultimoFrescor).toBeNull();
      expect(falha.message).toContain("Nenhuma leitura bem-sucedida");
    }
  });

  it("a memória só guarda leitura que terminou", async () => {
    const leitor = criarLeitorDeMeta(fonteQueCaiDepoisDe(0));
    await expect(leitor.ler(AGORA)).rejects.toThrow(MetaIndisponivel);
    expect(leitor.ultimoFrescor()).toBeNull();
  });

  it("a falha não devolve Meta nenhuma — nem meia", async () => {
    /*
     * RF-22: "nunca serve dado parcial". O caminho de erro lança; não existe
     * retorno com dimensões preenchidas e frescor vazio, que é a forma como
     * dado parcial costuma chegar à tela.
     */
    const leitor = criarLeitorDeMeta(fonteQueCaiDepoisDe(0));
    const resultado = await leitor.ler(AGORA).catch((e: unknown) => e);
    expect(resultado).toBeInstanceOf(MetaIndisponivel);
    expect(resultado).not.toHaveProperty("dimensoes");
  });
});
