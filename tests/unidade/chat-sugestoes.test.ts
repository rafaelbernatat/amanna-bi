import { describe, expect, it } from "vitest";

import { todasAsRotas } from "@/apresentacao/navegacao/telas";
import {
  CONFIANCA_MINIMA,
  interpretarLocalmente,
  mudaRecorte,
  semRecorte,
} from "@/chat/interpretar";
import { MAXIMO_DE_SUGESTOES, sugestoesApos } from "@/chat/perguntar";
import type { Consideracao, Resolucao } from "@/chat/resolver";
import { destinoDaMetrica } from "@/chat/roteamento";
import { SUGESTOES_DA_TELA, sugestoesDaTela } from "@/chat/sugestoes";
import { QUERY_PADRAO, type Query } from "@/semantica/contrato";

/**
 * As sugestões do chat (seção 7.6, RF-17): as 39 de tela e as de
 * acompanhamento de cada resposta.
 *
 * A regra é uma só, dos dois lados: **o chat não sugere o que não responde.**
 * Cada frase aqui passa pelo interpretador local — o caminho de baixo, que
 * responde mesmo sem gateway — e precisa cair na métrica que a motivou.
 */

/* ------------------------------------------------------------------ *
 * As 39 de tela
 * ------------------------------------------------------------------ */

const POR_TELA: readonly (readonly [string, string])[] = Object.entries(
  SUGESTOES_DA_TELA,
).flatMap(([tela, perguntas]) => perguntas.map((p) => [p, tela] as const));

describe("as 39 sugestões contextuais", () => {
  it("cada uma das 13 telas oferece exatamente três", () => {
    const telas = todasAsRotas().map((r) => r.slice(1));
    expect(Object.keys(SUGESTOES_DA_TELA).sort()).toEqual([...telas].sort());
    for (const tela of telas) {
      expect(sugestoesDaTela(tela), tela).toHaveLength(3);
    }
    expect(POR_TELA).toHaveLength(39);
  });

  it.each(POR_TELA)(
    "'%s' cai numa métrica do catálogo com confiança, e a métrica mora em %s",
    (pergunta, tela) => {
      const intencao = interpretarLocalmente(pergunta);
      expect(intencao, "nada casou").not.toBeNull();
      expect(intencao?.confianca).toBeGreaterThanOrEqual(CONFIANCA_MINIMA);

      // A resposta abre a tela que sugeriu a pergunta, e não outra: uma
      // sugestão de `rh/turnover` que levasse a `rh/visao` seria um guia que
      // tira a pessoa da tela em que ela está.
      const destino = destinoDaMetrica(intencao?.metrica ?? "");
      expect(destino?.tela, intencao?.metrica).toBe(tela);
    },
  );

  it("nenhuma frase se repete entre telas", () => {
    const frases = POR_TELA.map(([p]) => p);
    const repetidas = frases.filter((f, i) => frases.indexOf(f) !== i);
    expect(repetidas).toEqual([]);
  });

  it("rota fora do inventário não tem guia", () => {
    expect(sugestoesDaTela("xx/yy")).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * As de acompanhamento
 * ------------------------------------------------------------------ */

function apoio(
  metrica: string,
  rotulo: string,
  valor: number | null = 1,
): Consideracao {
  return { rotulo, valor, unidade: "BRL_mi", origem: "apoio", metrica };
}

function resolucaoDe(
  metrica: string,
  consideracoes: readonly Consideracao[],
  filtros: Query = QUERY_PADRAO,
): Resolucao {
  return {
    metrica,
    rotulo: metrica,
    valor: 1,
    unidade: "pct",
    formula: "a / b",
    decisao: null,
    asOf: "2026-12-31",
    consideracoes,
    familia: null,
    referencias: [],
    comparacao: null,
    comparacaoIndisponivelPorque: null,
    acoes: { filtros, tela: null, painel: null },
    fontes: ["vw_teste"],
    painel: null,
  };
}

describe("as sugestões de acompanhamento", () => {
  const roe = resolucaoDe("roe", [
    apoio("lucro_liquido", "Lucro líquido"),
    apoio("patrimonio_liquido", "Patrimônio líquido"),
    apoio("giro_do_ativo", "Giro do ativo"),
    {
      rotulo: "Receita",
      valor: 1,
      unidade: "BRL_mi",
      origem: "painel",
      metrica: null,
    },
  ]);

  it("oferece o apoio como pergunta, e cada uma cai na métrica de apoio", () => {
    const sugestoes = sugestoesApos(roe);
    expect(sugestoes).toContain("E lucro líquido?");
    expect(sugestoes).toContain("E patrimônio líquido?");

    for (const s of sugestoes.filter(
      (s) => !s.startsWith("E só") && !s.startsWith("E na"),
    )) {
      const lida = interpretarLocalmente(s);
      expect(lida?.confianca, s).toBeGreaterThanOrEqual(CONFIANCA_MINIMA);
      expect(lida?.metrica, s).not.toBe("roe");
    }
  });

  it("oferece o mesmo número noutro período e noutra entidade", () => {
    const sugestoes = sugestoesApos(roe);
    expect(sugestoes).toContain("E só em dezembro?");
    expect(sugestoes).toContain("E na Unidade SP?");

    // As de recorte não citam métrica: quem as responde é a herança da
    // conversa. Se o catálogo as casasse, viraria outra pergunta.
    for (const s of ["E só em dezembro?", "E na Unidade SP?"]) {
      expect(interpretarLocalmente(semRecorte(s)), s).toBeNull();
      expect(mudaRecorte(s, QUERY_PADRAO), s).toBe(true);
    }
  });

  it("no recorte de dezembro em SP, oferece o caminho de volta", () => {
    const emSp = resolucaoDe("roe", [], {
      ...QUERY_PADRAO,
      periodo: "dezembro",
      entidade: "unidade-sp",
    });
    const sugestoes = sugestoesApos(emSp);
    expect(sugestoes).toContain("E nos 12 meses?");
    expect(sugestoes).toContain("E no consolidado?");
    expect(sugestoes).not.toContain("E só em dezembro?");
  });

  it("nunca passa do máximo, e não repete", () => {
    const sugestoes = sugestoesApos(roe);
    expect(sugestoes.length).toBeLessThanOrEqual(MAXIMO_DE_SUGESTOES);
    expect(new Set(sugestoes).size).toBe(sugestoes.length);
  });

  it("apoio cujo rótulo o catálogo não casa não vira sugestão", () => {
    const estranho = resolucaoDe("roe", [apoio("lucro_liquido", "Xyz")]);
    expect(sugestoesApos(estranho)).not.toContain("E xyz?");
    expect(sugestoesApos(estranho)).not.toContain("E Xyz?");
  });

  it("apoio que é a própria métrica não é oferecido de volta", () => {
    const circular = resolucaoDe("lucro_liquido", [
      apoio("lucro_liquido", "Lucro líquido"),
    ]);
    expect(sugestoesApos(circular)).not.toContain("E lucro líquido?");
  });

  it("a versão antiga, 'como isso se compara com o ano anterior', saiu", () => {
    // A fixture só tem 2026: o atalho levava sempre a "sem dado".
    expect(sugestoesApos(roe).join(" ")).not.toMatch(/ano anterior/i);
  });
});
