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

import { apoioDe } from "@/chat/apoio";
import { CONFIANCA_MINIMA, interpretarLocalmente } from "@/chat/interpretar";
import { interpretarComGateway, redigirComGateway } from "@/chat/openrouter";
import { SO_NO_CHAT } from "@/chat/so-no-chat";
import { perguntar, redigirResposta, resolverPergunta } from "@/chat/perguntar";
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
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
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
  // Bloco A — rentabilidade e retorno
  ["Qual é o ROE da empresa?", "roe"],
  ["Qual o ROE da empresa?", "roe"],
  ["O ROE da empresa está bom ou está ruim?", "roe"],
  ["Por que o ROE caiu? Foi margem, foi giro ou foi dívida?", "roe"],
  ["Qual é o ROA e o que ele me diz que o ROE não diz?", "roa"],
  [
    "Qual é o retorno sobre o capital investido (ROIC)? A empresa cria ou destrói valor?",
    "roic",
  ],
  ["Qual é a margem líquida e por que ela mudou?", "margem_liquida"],
  [
    "Quais unidades, centros de custo ou linhas de negócio dão mais retorno?",
    "desvio_orcamentario",
  ],
  ["Compensa mais deixar o dinheiro na empresa ou aplicar no CDI?", "roic"],
  // Bloco B — margens e operação
  ["Qual é a margem bruta e o que explica a variação?", "margem_bruta"],
  ["Qual é a margem de contribuição?", "margem_de_contribuicao"],
  [
    "Qual é a diferença entre custo e despesa nos nossos números, e a nossa classificação está correta?",
    "contas_com_classificacao_inconsistente",
  ],
  [
    "Qual é o nosso ponto de equilíbrio? Quanto preciso faturar para não dar prejuízo?",
    "ponto_de_equilibrio",
  ],
  [
    "Quanto a receita pode cair antes de a empresa dar prejuízo?",
    "margem_de_seguranca",
  ],
  ["Qual é o nosso EBITDA?", "ebitda"],
  [
    "Se o EBITDA está bom, por que o caixa não melhora?",
    "fluxo_de_caixa_livre",
  ],
  ["Se a receita cair 10%, o que acontece com o lucro?", "gao"],
  [
    "Nosso mix de receita mudou? Isso ajudou ou atrapalhou o resultado?",
    "receita_dos_principais_clientes",
  ],
  // Bloco C — liquidez e capital de giro
  ["Qual é a nossa liquidez corrente?", "liquidez_corrente"],
  [
    "E se eu não puder contar com o estoque? Qual é a liquidez seca e a imediata?",
    "liquidez_seca",
  ],
  ["Em quantos dias recebemos dos clientes?", "pmr"],
  ["Em quantos dias pagamos os fornecedores?", "pmp"],
  ["Quanto tempo o estoque fica parado?", "pme"],
  ["Qual é o nosso ciclo financeiro?", "ciclo_financeiro"],
  [
    "Quanto de dinheiro a operação precisa ter parado? E o caixa que temos é suficiente?",
    "ncg",
  ],
  ["Demos lucro no mês e o caixa caiu. Como isso é possível?", "lucro_liquido"],
  // Bloco D — endividamento
  ["Nosso endividamento está alto?", "divida_liquida_sobre_ebitda"],
  ["A operação consegue pagar os juros?", "cobertura_de_juros"],
  [
    "Quanto estamos pagando de juros e isso está caro?",
    "custo_medio_da_divida",
  ],
  ["A dívida está trabalhando a nosso favor?", "roic"],
  // Bloco D — qualidade do razão
  [
    "Tem algum lançamento estranho no razão neste mês?",
    "lancamentos_para_revisao",
  ],
  [
    "Dá para confiar nesses números? A base está classificada corretamente?",
    "completude_da_base",
  ],
  [
    "Os números do mês estão por competência ou tem coisa lançada no mês errado?",
    "indicios_de_competencia",
  ],
  [
    "Tem movimentação com sócios ou entre empresas do grupo afetando o resultado?",
    "movimentacao_com_partes_relacionadas",
  ],
  ["Quantos lançamentos em conta parada?", "lancamentos_em_conta_parada"],
  // Os exemplos do painel de chat e as ofertas de próximo passo
  ["qual o lucro apurado do ano", "lucro_liquido"],
  ["como está o turnover", "turnover_12m"],
  ["quanto é a folha total", "folha_total"],
  ["quantas vagas abertas", "vagas_abertas"],
  ["Qual o PMR?", "pmr"],
  ["Qual o DSO?", "pmr"],
  ["Como isso se compara com o ano anterior?", "crescimento_yoy"],
  ["Quanto pagamos de imposto?", "impostos_sobre_lucro"],
  ["Qual a dívida líquida?", "divida_liquida"],
  ["Qual o patrimônio líquido?", "patrimonio_liquido"],
  ["Qual o ativo circulante?", "ativo_circulante"],
  ["Qual o passivo circulante?", "passivo_circulante"],
  ["Quanto temos em aplicações financeiras?", "aplicacoes_financeiras"],
  ["Qual o custo líquido da dívida?", "custo_liquido_da_divida"],
  ["Qual a relação dívida sobre patrimônio?", "divida_sobre_pl"],
];

/* ------------------------------------------------------------------ *
 * As que recusam
 * ------------------------------------------------------------------ */

/** Perguntas sem métrica no catálogo. Recusa obrigatória (7.7). */
const RECUSAM: readonly string[] = [
  "Qual o valuation da empresa?",
  "Quanto vale a empresa?",
  "Qual a taxa Selic esperada para o ano que vem?",
];

/**
 * Perguntas em que mais de uma métrica casa igual, ou em que só uma palavra
 * solta do nome casou e outra métrica disputa. O chat pergunta, não chuta.
 */
const DESAMBIGUAM: readonly string[] = [
  // "margem" está no nome de quatro métricas, e em nenhuma inteira.
  "Como está a margem?",
  // "dívida" está no nome de sete.
  "Qual a dívida?",
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

  it("toda métrica que só o chat alcança é alvo de pelo menos uma pergunta", () => {
    /*
     * O outro lado da regra "nenhuma órfã" do catálogo: uma métrica sem cartão
     * só se justifica se alguma pergunta chega nela — direto, como principal,
     * ou como apoio de uma principal.
     */
    const alvos = new Set(RESPONDEM.map(([, metrica]) => metrica));
    const alcancadas = new Set([
      ...alvos,
      ...[...alvos].flatMap((id) => apoioDe(id)),
    ]);
    const semPergunta = SO_NO_CHAT.filter((id) => !alcancadas.has(id));
    expect(semPergunta).toEqual([]);
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

/* ------------------------------------------------------------------ *
 * As duas fases: resolver antes de redigir
 * ------------------------------------------------------------------ */

describe("resolverPergunta e redigirResposta", () => {
  it("resolver não redige, e redigir é o que chama o modelo", async () => {
    /*
     * A tela decide para onde ir entre as duas fases. Se resolver já
     * redigisse, uma pergunta que navega para outra tela pagaria o estágio 3
     * duas vezes — o primeiro texto jogado fora.
     */
    vi.mocked(redigirComGateway).mockClear();
    vi.mocked(interpretarComGateway).mockResolvedValueOnce({
      metrica: "margem_liquida",
      confianca: 0.9,
      alternativas: [],
    });

    const resolvida = await resolverPergunta("Qual é a margem líquida?");
    expect(resolvida.tipo).toBe("resolvida");
    expect(vi.mocked(redigirComGateway)).not.toHaveBeenCalled();
    if (resolvida.tipo !== "resolvida") return;
    expect(resolvida.resolucao.metrica).toBe("margem_liquida");

    const resposta = await redigirResposta(
      "Qual é a margem líquida?",
      resolvida.resolucao,
    );
    expect(vi.mocked(redigirComGateway)).toHaveBeenCalledTimes(1);
    expect(resposta.tipo).toBe("resposta");
    if (resposta.tipo !== "resposta") return;
    expect(resposta.resolucao.metrica).toBe("margem_liquida");
  });

  it("uma recusa sai de resolver sem chamar o modelo para redigir", async () => {
    vi.mocked(redigirComGateway).mockClear();
    vi.mocked(interpretarComGateway).mockResolvedValueOnce({
      metrica: "",
      confianca: 0,
      alternativas: ["pmr"],
    });

    const resolvida = await resolverPergunta("Qual é o ROE da empresa?");
    expect(resolvida.tipo).toBe("recusa");
    expect(vi.mocked(redigirComGateway)).not.toHaveBeenCalled();
  });
});
