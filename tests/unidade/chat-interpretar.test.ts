/**
 * O estágio 1 contra perguntas de verdade, e a recusa que chega à tela.
 *
 * A seção 7.5 do PRD: *"pergunta sem métrica correspondente recebe recusa útil
 * — nunca uma estimativa"*. A meta da 7.7 é recusa correta em 100% das
 * perguntas fora do catálogo.
 *
 * O que motivou este arquivo foi um conjunto de 33 perguntas de CFO passado
 * pelo interpretador local: ele respondia as 33, sem recusar nenhuma, e
 * acertava a métrica em 4. "Qual é o ROE da empresa?" virava eNPS com
 * confiança 1,00 — a palavra "empresa", dentro de um sinônimo, era o único
 * casamento, e por isso parecia certo. E com o gateway ligado a recusa do
 * modelo era descartada em favor desse mesmo palpite.
 *
 * Três blocos: as perguntas que precisam responder, as que precisam recusar, e
 * a orquestração com o modelo recusando.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { CONFIANCA_MINIMA, interpretarLocalmente } from "@/chat/interpretar";
import { interpretarComGateway } from "@/chat/openrouter";
import { perguntar } from "@/chat/perguntar";
import { CATALOGO_GERADO } from "@/semantica/catalogo-gerado";
import { QUERY_PADRAO } from "@/semantica/contrato";

/*
 * O caminho positivo lê as fixtures pela fronteira de perfil, que exige os dois
 * modos no ambiente. Antes das importações, porque a fábrica e a sessão leem o
 * ambiente do processo; o vitest não carrega `.env.local`, e o CI só define
 * DATA_SOURCE.
 */
vi.hoisted(() => {
  process.env["DATA_SOURCE"] = "fixtures";
  process.env["AUTH_PROVIDER"] = "fixtures";
});

vi.mock("@/chat/openrouter", () => ({
  gatewayConfigurado: () => true,
  interpretarComGateway: vi.fn(),
  redigirComGateway: vi.fn(async () => null),
}));

/** Igual ao do interpretador: sem acento e em minúsculas. */
function normalizar(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/* ------------------------------------------------------------------ *
 * As que respondem
 * ------------------------------------------------------------------ */

/**
 * Pergunta e métrica esperada. As sete primeiras são as do documento de CFO
 * que o catálogo cobre; as demais são os exemplos do painel de chat e a
 * sugestão fixa que toda resposta oferece.
 */
const RESPONDEM: readonly (readonly [string, string])[] = [
  ["Qual é a margem líquida e por que ela mudou?", "margem_liquida"],
  ["Qual é a margem bruta e o que explica a variação?", "margem_bruta"],
  ["Qual é o nosso EBITDA?", "ebitda"],
  ["Em quantos dias recebemos dos clientes?", "pmr"],
  ["Em quantos dias pagamos os fornecedores?", "pmp"],
  ["Quanto tempo o estoque fica parado?", "pme"],
  ["Qual é o nosso ciclo financeiro?", "ciclo_financeiro"],
  ["Demos lucro no mês e o caixa caiu. Como isso é possível?", "lucro_liquido"],
  ["qual o lucro apurado do ano", "lucro_liquido"],
  ["como está o turnover", "turnover_12m"],
  ["quanto é a folha total", "folha_total"],
  ["quantas vagas abertas", "vagas_abertas"],
  ["Qual o PMR?", "pmr"],
  ["Qual o DSO?", "pmr"],
  ["Como isso se compara com o ano anterior?", "crescimento_yoy"],
];

/* ------------------------------------------------------------------ *
 * As que recusam
 * ------------------------------------------------------------------ */

/** Perguntas de CFO sem métrica no catálogo. Recusa obrigatória (7.7). */
const RECUSAM: readonly string[] = [
  "Qual é o ROE da empresa?",
  "Qual é a nossa liquidez corrente?",
  "E se eu não puder contar com o estoque? Qual é a liquidez seca e a imediata?",
  "Qual é o nosso ponto de equilíbrio? Quanto preciso faturar para não dar prejuízo?",
  "Nosso endividamento está alto?",
  "A dívida está trabalhando a nosso favor?",
  "Tem algum lançamento estranho no razão neste mês?",
  "Qual é o retorno sobre o capital investido (ROIC)?",
  "Compensa mais deixar o dinheiro na empresa ou aplicar no CDI?",
  "Quanto pagamos de imposto?",
];

/**
 * Perguntas em que mais de uma métrica casa igual, ou em que só uma palavra
 * solta do nome casou e outra métrica disputa. O chat pergunta, não chuta.
 */
const DESAMBIGUAM: readonly string[] = [
  // "margem" está no nome de três métricas, e em nenhuma inteira.
  "Qual é a margem de contribuição?",
  "Por que o ROE caiu? Foi margem, foi giro ou foi dívida?",
  // "despesa" é palavra do nome de uma; "custo", de várias.
  "Qual é a diferença entre custo e despesa nos nossos números?",
];

describe("o interpretador local", () => {
  it.each(RESPONDEM)("responde '%s' com %s", (pergunta, metrica) => {
    const intencao = interpretarLocalmente(pergunta);
    expect(intencao).not.toBeNull();
    expect(intencao?.metrica).toBe(metrica);
    expect(intencao?.confianca).toBeGreaterThanOrEqual(CONFIANCA_MINIMA);
  });

  it.each(RECUSAM)("recusa '%s'", (pergunta) => {
    expect(interpretarLocalmente(pergunta)).toBeNull();
  });

  it.each(DESAMBIGUAM)("pede desambiguação em '%s'", (pergunta) => {
    const intencao = interpretarLocalmente(pergunta);
    expect(intencao).not.toBeNull();
    expect(intencao?.confianca).toBeLessThan(CONFIANCA_MINIMA);
    expect(intencao?.alternativas.length).toBeGreaterThan(0);
  });

  it("extrai o recorte da pergunta mesmo quando a métrica vem de fora", () => {
    // "12 meses" é rótulo de período; a pergunta não casa com métrica nenhuma.
    const intencao = interpretarLocalmente(
      "qual o turnover nos últimos 12 meses",
      {
        ...QUERY_PADRAO,
        periodo: "dezembro",
      },
    );
    expect(intencao?.filtros.periodo).toBe("12-meses");
  });
});

/* ------------------------------------------------------------------ *
 * O catálogo não pode empatar consigo mesmo
 * ------------------------------------------------------------------ */

describe("os sinônimos do catálogo", () => {
  it("nenhum sinônimo é o nome ou o rótulo de outra métrica", () => {
    /*
     * Um sinônimo igual ao id de outra métrica empata com ela em toda pergunta
     * que o cite, e o desempate alfabético decide errado metade das vezes:
     * "Qual o PMR?" respondia o ciclo financeiro. O empate é estrutural — termo
     * inteiro vale o comprimento, seja nome ou sinônimo — então a única saída
     * é o catálogo não o criar.
     */
    const donos = new Map<string, string>();
    for (const [id, m] of Object.entries(CATALOGO_GERADO)) {
      donos.set(normalizar(m.rotulo), id);
      donos.set(id.replace(/_/g, " "), id);
    }

    const colisoes: string[] = [];
    for (const [id, m] of Object.entries(CATALOGO_GERADO)) {
      for (const sinonimo of m.sinonimos) {
        const dono = donos.get(normalizar(sinonimo));
        if (dono !== undefined && dono !== id) {
          colisoes.push(`${id}: "${sinonimo}" é o nome de ${dono}`);
        }
      }
    }
    expect(colisoes).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * A orquestração, com o modelo no estágio 1
 * ------------------------------------------------------------------ */

describe("perguntar, com o gateway respondendo", () => {
  afterEach(() => {
    vi.mocked(interpretarComGateway).mockReset();
  });

  it("leva a recusa do modelo à tela, só com alternativas do catálogo", async () => {
    vi.mocked(interpretarComGateway).mockResolvedValueOnce({
      metrica: "",
      confianca: 0,
      alternativas: ["pmr", "pmp", "metrica_inventada"],
    });

    const resposta = await perguntar("Qual é o ROE da empresa?");

    expect(resposta.tipo).toBe("recusa");
    if (resposta.tipo !== "recusa") return;
    expect(resposta.alternativas.map((a) => a.id)).toEqual(["pmr", "pmp"]);
    expect(resposta.texto).toMatch(/não tenho essa métrica/i);
  });

  it("a recusa do modelo vence o palpite local", async () => {
    // Localmente "qual o turnover" responde; o modelo disse que não há métrica.
    vi.mocked(interpretarComGateway).mockResolvedValueOnce({
      metrica: "",
      confianca: 0,
      alternativas: [],
    });

    const resposta = await perguntar("qual o turnover");
    expect(resposta.tipo).toBe("recusa");
  });

  it("sem resposta do gateway, o caminho local continua valendo", async () => {
    vi.mocked(interpretarComGateway).mockResolvedValueOnce(null);

    const resposta = await perguntar("qual o turnover");
    expect(resposta.tipo).toBe("resposta");
    if (resposta.tipo !== "resposta") return;
    expect(resposta.resolucao.metrica).toBe("turnover_12m");
  });

  it("o recorte da pergunta chega às ações mesmo quando o local não casa", async () => {
    // Unidade `pct`: a comparação com juros para antes de ir ao Banco Central.
    vi.mocked(interpretarComGateway).mockResolvedValueOnce({
      metrica: "margem_liquida",
      confianca: 0.9,
      alternativas: [],
    });

    const resposta = await perguntar(
      "Quanto sobrou na última linha nos últimos 12 meses?",
      { ...QUERY_PADRAO, periodo: "dezembro" },
    );

    expect(resposta.tipo).toBe("resposta");
    if (resposta.tipo !== "resposta") return;
    expect(resposta.resolucao.metrica).toBe("margem_liquida");
    expect(resposta.resolucao.acoes.filtros.periodo).toBe("12-meses");
  });
});
