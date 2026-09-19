/**
 * Simples ou composta: a decisão determinística **antes** do gateway
 * (D-CHAT-ferramentas, T-350).
 *
 * O caminho de sempre — uma métrica, um recorte, três estágios — responde a
 * maioria das perguntas em décimos de segundo sem gateway e em poucos
 * segundos com ele. O laço de ferramentas custa duas ou três idas ao modelo.
 * Mandar tudo pelo laço dobraria latência e custo no caso comum; por isso a
 * classificação é nossa, por sinais na pergunta, e é a mesma com ou sem
 * chave.
 *
 * ## Os sinais, e por que um sinal pode ser descontado
 *
 * "Como está o engajamento por área?" tem o sinal de ranking ("por área") — e
 * é uma métrica do catálogo, `engajamento_por_area`, com painel próprio. O
 * sinal está **no nome da métrica**, não na pergunta. Quando o palpite local é
 * confiante e o trecho que acendeu o sinal aparece no vocabulário da métrica
 * (rótulo, sinônimos, id), o sinal não conta. É o que mantém as 39 sugestões
 * das telas no caminho simples, que é o que elas prometem.
 *
 * "Por que" fica simples de propósito: a causa é o apoio que o estágio 2 já
 * lê, e o laço não tem ferramenta para causa — ninguém deve fingir que tem.
 */

import { CONFIANCA_MINIMA, type Intencao } from "@/chat/interpretar";
import { CATALOGO_GERADO } from "@/semantica/catalogo-gerado";

export const SINAIS = [
  "ranking",
  "serie",
  "variacao",
  "comparacao",
  "grafico",
  "catalogo",
  "decomposicao",
  "causa",
] as const;
export type Sinal = (typeof SINAIS)[number];

export type Classe = "simples" | "composta";

export type Classificacao = {
  readonly classe: Classe;
  readonly sinais: readonly Sinal[];
};

/** Os sinais que sozinhos levam ao laço. `causa` não é um deles. */
const COMPOSTOS: ReadonlySet<Sinal> = new Set<Sinal>([
  "ranking",
  "serie",
  "variacao",
  "comparacao",
  "grafico",
  "catalogo",
  "decomposicao",
]);

/** Minúsculas, sem acento e com um espaço só. A mesma em toda comparação. */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Os padrões, sobre o texto sem acento e em minúsculas. */
const PADROES: Readonly<Record<Sinal, RegExp>> = {
  ranking:
    /\b(?:top ?\d*|maiores|menores|ranking|rank|principais (?:clientes|fornecedores|areas|centros|contas|segmentos|ufs?|estados)|quais (?:\w+ ){1,3}?(?:mais|menos)|concentra\w*|participacao d[eo]s?|de cada (?:cliente|fornecedor|area|centro de custo|uf|estado|segmento|conta)s?|por (?:cliente|fornecedor|centro de custo|centros de custo|area|areas|uf|estado|segmento|conta|linha da dre)s?)\b/,
  serie:
    /\b(?:mes a mes|evolu\w+|ao longo d[oe]|por mes|pior mes|melhor mes|tendencia|mensalmente|ultimos meses|cada mes|ao longo do ano|no ano todo|historico|serie)\b/,
  decomposicao:
    /\b(?:distribui\w*|composicao|compoe\w*|abre por|quebra por|decomp\w+|por natureza|por linha da dre)\b/,
  variacao:
    /\b(?:cresceu|caiu|crescemos|caimos|crescimento|queda|em relacao a|comparad[oa] (?:com|ao|a)|versus|vs|variou|variacao|ano (?:anterior|passado)|sobre o ano)\b/,
  comparacao: /\b(?:compar\w+|lado a lado)\b/,
  grafico:
    /\b(?:grafico|painel|explic\w+|o que (?:isso|esse|este|ele|ela|aqui) mostra)\b/,
  catalogo:
    /\b(?:quais metricas|que metricas|o que (?:voce|vc) (?:sabe|responde)|que perguntas|posso perguntar|lista de metricas|metricas disponiveis|o que da para perguntar)\b/,
  causa: /\b(?:por que|porque|por qual (?:motivo|razao)|motivo|causa)\b/,
};

/** O vocabulário de uma métrica, para descontar sinal que está no nome dela. */
export function vocabularioDe(metrica: string): string {
  const entrada = CATALOGO_GERADO[metrica];
  if (entrada === undefined) return "";
  return normalizar(
    [entrada.rotulo, entrada.id.replace(/_/g, " "), ...entrada.sinonimos].join(
      " | ",
    ),
  );
}

/** Métricas que já são variação: "cresceu?" sobre elas é a própria pergunta. */
const JA_E_VARIACAO = /\b(?:crescimento|variacao|delta)\b/;

/**
 * Os sinais da pergunta, já descontados os que estão no nome da métrica que
 * o palpite local escolheu com confiança.
 */
export function sinaisDe(
  pergunta: string,
  palpite: Intencao | null = null,
): readonly Sinal[] {
  const texto = normalizar(pergunta);
  const confiante =
    palpite !== null &&
    palpite.metrica !== "" &&
    palpite.confianca >= CONFIANCA_MINIMA;
  const vocabulario = confiante ? vocabularioDe(palpite.metrica) : "";

  const achados: Sinal[] = [];
  for (const sinal of SINAIS) {
    const casamento = PADROES[sinal].exec(texto);
    if (casamento === null) continue;
    /*
     * O desconto: o sinal está no nome da métrica, e não na pergunta.
     *
     * Duas formas de reconhecer isso. O trecho que acendeu o sinal aparece no
     * vocabulário dela — "por área" em "Engajamento por área". Ou o próprio
     * padrão casa com o vocabulário — "top 10" em "Concentração top 10",
     * "cresceu" em "Crescimento anual". Nos dois, a pessoa nomeou a métrica,
     * e o caminho simples é quem responde.
     */
    if (
      confiante &&
      (vocabulario.includes(normalizar(casamento[0])) ||
        PADROES[sinal].test(vocabulario))
    ) {
      continue;
    }
    if (sinal === "variacao" && confiante && JA_E_VARIACAO.test(vocabulario)) {
      continue;
    }
    achados.push(sinal);
  }

  /*
   * "Por que o EBITDA caiu?" pergunta a causa, não a variação.
   *
   * "caiu" acende o sinal de variação, e uma leitura contra o ano anterior no
   * meio responderia outra pergunta. A causa é o apoio que o estágio 2 já lê,
   * e é por isso que `causa` não leva ao laço.
   */
  if (achados.includes("causa")) {
    return achados.filter((sinal) => sinal !== "variacao");
  }
  return achados;
}

/** Simples ou composta, e por quais sinais. */
export function classificar(
  pergunta: string,
  palpite: Intencao | null = null,
): Classificacao {
  const sinais = sinaisDe(pergunta, palpite);
  const composta = sinais.some((s) => COMPOSTOS.has(s));
  return { classe: composta ? "composta" : "simples", sinais };
}
