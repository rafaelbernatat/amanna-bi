import { beforeAll, describe, expect, it, vi } from "vitest";

import { interpretarLocalmente, type Intencao } from "@/chat/interpretar";
import {
  decidirCaminho,
  restoDaPergunta,
  type CaminhoEscolhido,
  type MotivoDaRota,
} from "@/chat/rota";
import { sugestoesDaTela, SUGESTOES_DA_TELA } from "@/chat/sugestoes";
import { QUERY_PADRAO } from "@/semantica/contrato";

/**
 * Por onde cada pergunta é respondida (T-446).
 *
 * O caso que este arquivo existe para não voltar: em 2026-09-19 Produto
 * mandou três prints em que o chat respondia a métrica mais próxima em vez da
 * pergunta. A causa era o roteamento por lista de frases — seis de sete
 * perguntas naturais não acendiam sinal nenhum. Aqui as perguntas estão
 * fixadas pelo caminho **e pelo motivo**: o motivo é o que diz se a regra
 * certa agiu, ou se a resposta certa saiu por acaso.
 */

beforeAll(() => {
  process.env["DATA_SOURCE"] = "fixtures";
  process.env["AUTH_PROVIDER"] = "fixtures";
});

function rotaDe(pergunta: string, temGateway = true) {
  return decidirCaminho(
    pergunta,
    interpretarLocalmente(pergunta),
    null,
    temGateway,
  );
}

/**
 * As perguntas dos prints, e as que Produto pediu por escrito.
 *
 * Três motivos diferentes levam ao mesmo lugar, e é assim que tem de ser:
 * "maior despesa" não casa métrica por termo inteiro; "fora do normal" casa,
 * mas sobra pergunta; "colaboradores mais caros" acende o sinal de ranking.
 */
const DO_PRINT: readonly (readonly [string, MotivoDaRota])[] = [
  ["Qual foi a maior despesa de junho?", "sem_casamento"],
  [
    "Fora a despesa com pessoal, o que mais eu gastei que foi fora do normal?",
    "resto_aberto",
  ],
  ["E esses lançamentos são o que?", "resto_aberto"],
  ["Quanto gastamos com o fornecedor Zênite?", "sem_casamento"],
  ["Me mostra as contas que mais pesaram no trimestre", "sem_casamento"],
  ["O que aconteceu de estranho no caixa?", "resto_aberto"],
  ["Quem são nossos maiores clientes?", "sem_casamento"],
  ["Quais os colaboradores mais caros?", "sinal_composto"],
];

describe("as perguntas que Produto mandou", () => {
  it.each(DO_PRINT)("«%s» vai ao laço, por %s", (pergunta, porque) => {
    const rota = rotaDe(pergunta);
    expect(rota.caminho).toBe<CaminhoEscolhido>("laco");
    expect(rota.porque).toBe(porque);
  });
});

describe("o que continua no atalho", () => {
  it.each([
    ["Como está o turnover?", "casamento_exato"],
    ["Qual o saldo de caixa?", "casamento_exato"],
    ["Qual a receita líquida em abril?", "casamento_exato"],
    ["Qual o turnover na Unidade SP?", "casamento_exato"],
    ["Por que o EBITDA caiu?", "causa"],
  ] as const)("«%s» fica no atalho, por %s", (pergunta, porque) => {
    const rota = rotaDe(pergunta);
    expect(rota.caminho).toBe<CaminhoEscolhido>("atalho");
    expect(rota.porque).toBe(porque);
  });

  /**
   * As três sugestões que pedem mais do que a métrica.
   *
   * Cada uma traz uma palavra de conteúdo que o catálogo não declara —
   * "quadro" por headcount, "ensino" por escolaridade, "maiores" por
   * concentração. Elas vão ao laço, que lê a mesma métrica e responde: custa
   * segundos, não correção. Estão nomeadas aqui para que a lista não cresça
   * sem alguém ver; encurtá-la é declarar o sinônimo no catálogo.
   */
  const SUGESTOES_NO_LACO: readonly string[] = [
    "Qual a idade média do quadro?",
    "Quantos têm ensino superior?",
    "Qual a concentração nos 10 maiores clientes?",
  ];

  it("as sugestões das telas ficam no atalho, salvo as três nomeadas", () => {
    const noLaco: string[] = [];
    for (const tela of Object.keys(SUGESTOES_DA_TELA)) {
      for (const pergunta of sugestoesDaTela(tela)) {
        if (rotaDe(pergunta).caminho === "laco") noLaco.push(pergunta);
      }
    }
    expect(noLaco.sort()).toEqual([...SUGESTOES_NO_LACO].sort());
  });

  it("nenhuma sugestão da tela deixa de casar a própria métrica", () => {
    for (const tela of Object.keys(SUGESTOES_DA_TELA)) {
      for (const pergunta of sugestoesDaTela(tela)) {
        expect(rotaDe(pergunta).porque).not.toBe<MotivoDaRota>("sem_casamento");
      }
    }
  });

  it("a continuação herdada fica no atalho, mesmo com sinal de série", () => {
    const herdada: Intencao = {
      metrica: "receita_liquida",
      filtros: QUERY_PADRAO,
      confianca: 1,
      alternativas: [],
      inteiro: true,
    };
    const rota = decidirCaminho("E no ano todo?", null, herdada, true);
    expect(rota.caminho).toBe<CaminhoEscolhido>("atalho");
    expect(rota.porque).toBe<MotivoDaRota>("continuacao");
  });
});

describe("sem gateway, o roteamento é o de antes", () => {
  it.each([
    "Qual foi a maior despesa de junho?",
    "Fora a despesa com pessoal, o que mais eu gastei que foi fora do normal?",
    "E esses lançamentos são o que?",
    "O que aconteceu de estranho no caixa?",
  ])("«%s» fica no atalho sem chave", (pergunta) => {
    const rota = rotaDe(pergunta, false);
    expect(rota.caminho).toBe<CaminhoEscolhido>("atalho");
    expect(rota.porque).toBe<MotivoDaRota>("sem_gateway_sem_sinal");
  });

  it("o sinal composto continua indo ao laço sem chave", () => {
    const rota = rotaDe("Compare a margem líquida com o turnover", false);
    expect(rota.caminho).toBe<CaminhoEscolhido>("laco");
    expect(rota.porque).toBe<MotivoDaRota>("sinal_composto");
  });
});

describe("CHAT_ROTA=sinais restaura o roteamento anterior", () => {
  it("a pergunta sem sinal volta ao atalho", () => {
    vi.stubEnv("CHAT_ROTA", "sinais");
    expect(rotaDe("Qual foi a maior despesa de junho?").caminho).toBe("atalho");
    vi.unstubAllEnvs();
  });
});

describe("o resto da pergunta", () => {
  it("fica vazio quando a pergunta só nomeia a métrica, o mês e o recorte", () => {
    expect(
      restoDaPergunta(
        "Qual a receita líquida em abril na Unidade SP?",
        "receita_liquida",
      ),
    ).toBe("");
  });

  it("o verbo genérico de perguntar um número não conta como pedido", () => {
    expect(
      restoDaPergunta("Quanto pagamos de encargos?", "encargos_sobre_salarios"),
    ).toBe("");
  });

  it("o plural casa o singular do rótulo", () => {
    expect(
      restoDaPergunta(
        "Quantas horas de treinamento demos?",
        "horas_treinamento",
      ),
    ).toBe("");
  });

  it("guarda o que a pergunta pediu além da métrica", () => {
    expect(
      restoDaPergunta("A receita líquida por cliente", "receita_liquida"),
    ).toBe("cliente");
  });

  it("não engole superlativo: é justamente o que precisa sobrar", () => {
    expect(restoDaPergunta("A maior receita líquida", "receita_liquida")).toBe(
      "maior",
    );
  });

  it("não engole o demonstrativo de plural, que aponta para o turno anterior", () => {
    expect(restoDaPergunta("E esses lançamentos?", "lancamentos_do_mes")).toBe(
      "esses",
    );
  });
});
