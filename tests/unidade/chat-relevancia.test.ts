import { beforeAll, describe, expect, it } from "vitest";

import { executarPedido } from "@/chat/ferramentas/executar";
import { interpretarLocalmente } from "@/chat/interpretar";
import { decidirCaminho } from "@/chat/rota";
import type { ResultadoDeFerramenta } from "@/chat/ferramentas/resultado";
import {
  formaDaPergunta,
  relevancia,
  type FormaDaPergunta,
  type MotivoDeIrrelevancia,
} from "@/chat/relevancia";
import { resolver, type Resolucao } from "@/chat/resolver";
import { sugestoesDaTela, SUGESTOES_DA_TELA } from "@/chat/sugestoes";
import { QUERY_PADRAO } from "@/semantica/contrato";
import { contextoDe } from "@/chat/contexto";

/**
 * A resposta responde a pergunta? (T-448)
 *
 * As três respostas do print de 2026-09-19 são o caso de prova: cada uma
 * tinha o número certo, conferido pelo verificador, e respondia outra
 * pergunta. Aqui elas reprovam, e pelo motivo certo.
 */

beforeAll(() => {
  process.env["DATA_SOURCE"] = "fixtures";
  process.env["AUTH_PROVIDER"] = "fixtures";
});

const CONTEXTO = contextoDe("fin/visao", "", ["2026"]);

/** Uma leitura de verdade, para o caso em que a resposta traz itens. */
async function comRanking(r: Resolucao): Promise<Resolucao> {
  const leitura = await executarPedido(
    {
      nome: "ranking",
      metrica: "receita_liquida",
      dimensao: "cliente",
      limite: 5,
      ordem: "maior",
      filtros: QUERY_PADRAO,
    },
    CONTEXTO,
  );
  const resultado: ResultadoDeFerramenta = {
    ferramenta: "ranking",
    leitura,
  } as ResultadoDeFerramenta;
  return { ...r, leituras: [resultado], caminho: "composto" };
}

describe("a forma da pergunta", () => {
  it.each([
    ["Qual foi a maior despesa de junho?", "superlativo"],
    ["Fora a despesa com pessoal, o que mais eu gastei?", "superlativo"],
    ["Quais os colaboradores mais caros?", "superlativo"],
    ["E esses lançamentos são o que?", "identidade"],
    ["Me mostra as contas que pesaram", "lista"],
    ["Como a receita evoluiu?", "evolucao"],
    ["Por que o EBITDA caiu?", "causa"],
    ["Quanto faturamos em abril?", "valor"],
    ["Fale da empresa", "livre"],
  ] as const)("«%s» é %s", (pergunta, forma) => {
    expect(formaDaPergunta(pergunta)).toBe<FormaDaPergunta>(forma);
  });
});

describe("as três respostas do print reprovam", () => {
  it("«Qual foi a maior despesa de junho?» com uma métrica solta em % reprova", async () => {
    // Exatamente o que saiu na tela: Despesa de pessoal, uma taxa, sem itens.
    const r = await resolver("folha_sobre_receita", QUERY_PADRAO);
    const p = relevancia("Qual foi a maior despesa de junho?", r);
    expect(p.ok).toBe(false);
    expect(p.motivo).toBe<MotivoDeIrrelevancia>("sem_itens");
  });

  it("«o que mais eu gastei que foi fora do normal?» com uma contagem reprova", async () => {
    const r = await resolver("lancamentos_fora_do_padrao", QUERY_PADRAO);
    const p = relevancia(
      "Fora a despesa com pessoal, o que mais eu gastei que foi fora do normal?",
      r,
    );
    expect(p.ok).toBe(false);
    expect(p.motivo).toBe<MotivoDeIrrelevancia>("sem_itens");
  });

  it("«E esses lançamentos são o que?» com a mesma contagem reprova", async () => {
    const r = await resolver("lancamentos_fora_do_padrao", QUERY_PADRAO);
    const p = relevancia("E esses lançamentos são o que?", r);
    expect(p.ok).toBe(false);
    expect(p.motivo).toBe<MotivoDeIrrelevancia>("sem_itens");
  });

  it("a mesma pergunta, com um ranking lido, aprova", async () => {
    const base = await resolver("receita_liquida", QUERY_PADRAO);
    const p = relevancia(
      "Quais os maiores clientes por receita?",
      await comRanking(base),
    );
    expect(p.ok).toBe(true);
  });
});

describe("a unidade que a pergunta pede", () => {
  it("pergunta por um valor que a métrica escolhida não é reprova", async () => {
    // Perguntaram quanto custou o aluguel; veio uma taxa sobre a receita.
    const r = await resolver("folha_sobre_receita", QUERY_PADRAO);
    const p = relevancia("Quanto custou o aluguel?", r);
    expect(p.ok).toBe(false);
    expect(p.motivo).toBe<MotivoDeIrrelevancia>("unidade_incompativel");
  });

  it("«quanto gastamos com a folha» respondido em reais aprova", async () => {
    const r = await resolver("folha_total", QUERY_PADRAO);
    const p = relevancia("Quanto gastamos com a folha?", r);
    expect(p.ok).toBe(true);
  });

  it("a pergunta que só nomeia a métrica aceita a unidade que ela tem", async () => {
    // "Encargos" é uma taxa declarada pelo catálogo, e é o que se pediu.
    const r = await resolver("encargos_sobre_salarios", QUERY_PADRAO);
    expect(relevancia("Quanto pagamos de encargos?", r).ok).toBe(true);
  });
});

describe("o assunto", () => {
  it("resposta que não toca em nenhum termo da pergunta reprova", async () => {
    const r = await resolver("turnover_12m", QUERY_PADRAO);
    const p = relevancia("Fale sobre estoque parado no armazém", r);
    expect(p.ok).toBe(false);
    expect(p.motivo).toBe<MotivoDeIrrelevancia>("fora_do_assunto");
  });

  it("a continuação sem termo de conteúdo aprova: o assunto é o do turno anterior", async () => {
    const r = await resolver("turnover_12m", QUERY_PADRAO);
    expect(relevancia("E no ano todo?", r).ok).toBe(true);
  });
});

/**
 * As sugestões que ficam no atalho.
 *
 * É ali que a pertinência tem dente: reprovar no atalho escala a pergunta ao
 * laço, e um guia da tela escalando seria latência sem motivo. No laço,
 * reprovar só registra, e por isso as três sugestões que vão ao laço
 * (`chat-roteamento.test.ts` as nomeia) não entram aqui.
 */
describe("as sugestões que ficam no atalho aprovam", () => {
  it("nenhuma delas reprova contra a própria resolução", async () => {
    const reprovadas: string[] = [];
    for (const tela of Object.keys(SUGESTOES_DA_TELA)) {
      for (const pergunta of sugestoesDaTela(tela)) {
        const palpite = interpretarLocalmente(pergunta);
        if (palpite === null || palpite.metrica === "") continue;
        if (
          decidirCaminho(pergunta, palpite, null, true).caminho !== "atalho"
        ) {
          continue;
        }
        const r = await resolver(palpite.metrica, palpite.filtros);
        const p = relevancia(pergunta, r);
        if (!p.ok) reprovadas.push(`${pergunta} → ${String(p.motivo)}`);
      }
    }
    expect(reprovadas).toEqual([]);
  });
});
