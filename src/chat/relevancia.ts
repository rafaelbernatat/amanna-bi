/**
 * A resposta responde a pergunta? (T-448)
 *
 * O verificador de RF-15 prova que todo número do texto existe no envelope.
 * Nada provava a outra metade: que o envelope tem a ver com o que se
 * perguntou. Era por isso que "qual foi a maior despesa de junho?" saía como
 * "Despesa de pessoal: 16,5%" — número certo, conferido, e resposta de outra
 * pergunta.
 *
 * ## Determinístico, e sem juiz
 *
 * Três camadas, nenhuma chamada de modelo. A primeira sozinha reprova as três
 * respostas do print de 2026-09-19, e é a que interessa: **a forma da
 * pergunta exige um tipo de evidência**. Quem pergunta "a maior", "quais" ou
 * "o que são esses" pede itens; uma métrica solta não é resposta, por mais
 * certo que o número esteja.
 *
 * Um juiz de modelo custaria uma chamada, traria não-determinismo e seria uma
 * segunda coisa a explicar a quem acabou de ouvir que o verificador é
 * determinístico. A versão determinística já pega os casos reais.
 *
 * ## O que custa reprovar
 *
 * No atalho, reprovar **escala a pergunta ao laço**: é correção de rota, e
 * não censura — a rede de segurança para a regra do resto (`rota.ts`) errar.
 * No laço, reprovar **não bloqueia o texto**: RF-15 já é quem bloqueia, e um
 * segundo bloqueador só produziria mais recusa. Fica o registro, e a
 * frequência medida alimenta a próxima iteração, como `verificador_recusou`.
 */

import { normalizar, vocabularioDe } from "@/chat/classificar";
import { semRecorte } from "@/chat/interpretar";
import { semMes } from "@/chat/mes";
import type { Resolucao } from "@/chat/resolver";
import { NEUTRAS, palavrasDe, restoDaPergunta } from "@/chat/rota";

/** O que a pergunta pede, pela forma como é feita. */
export type FormaDaPergunta =
  | "valor"
  | "superlativo"
  | "lista"
  | "identidade"
  | "evolucao"
  | "causa"
  | "livre";

/** Por que a resposta não responde. */
export type MotivoDeIrrelevancia =
  /** Pediram itens — os maiores, quais, o que são — e veio um número só. */
  | "sem_itens"
  /** Perguntaram reais e veio uma taxa, ou o contrário. */
  | "unidade_incompativel"
  /** Nenhum termo da pergunta aparece no vocabulário da resposta. */
  | "fora_do_assunto";

export type Pertinencia = {
  readonly ok: boolean;
  readonly motivo: MotivoDeIrrelevancia | null;
  readonly forma: FormaDaPergunta;
};

const PADROES: readonly (readonly [FormaDaPergunta, RegExp])[] = [
  [
    "superlativo",
    /\b(?:maior(?:es)?|menor(?:es)?|melhor(?:es)?|pior(?:es)?|top ?\d*|mais (?:alt|baix|car|barat)\w*|o que mais|quem mais|que mais)\b/,
  ],
  [
    "lista",
    /\b(?:quais|liste|listar|me mostra|mostra as|mostre as|quero ver|relacione|enumere|um a um|cada um)\b/,
  ],
  [
    "identidade",
    /\b(?:sao o que|e o que|o que (?:sao|e|foram|eram)|que (?:sao|e) esses|quais sao esses|de que se trata|do que se trata)\b/,
  ],
  [
    "evolucao",
    /\b(?:evolu\w+|mes a mes|ao longo d[oe]|tendencia|pior mes|melhor mes|historico|serie)\b/,
  ],
  ["causa", /\b(?:por que|porque|por qual (?:motivo|razao)|motivo|causa)\b/],
  ["valor", /\b(?:quanto|quantos|quantas|qual o|qual a|qual e)\b/],
];

/**
 * A forma da pergunta. A primeira que casa vence, da mais exigente à menos.
 *
 * `metrica` desconta o que está no **nome dela**, como `classificar` já faz
 * com os sinais: "Qual a concentração nos 10 maiores clientes?" tem "maiores"
 * dentro do rótulo da métrica, e não é um superlativo que a pessoa pediu — é
 * o nome do que ela pediu. Sem o desconto, uma sugestão do guia da tela
 * reprovaria por não trazer itens que ninguém pediu.
 */
export function formaDaPergunta(
  pergunta: string,
  metrica = "",
): FormaDaPergunta {
  const texto = normalizar(pergunta);
  const vocabulario = metrica === "" ? "" : vocabularioDe(metrica);
  for (const [forma, padrao] of PADROES) {
    const casado = padrao.exec(texto);
    if (casado === null) continue;
    if (vocabulario !== "" && vocabulario.includes(normalizar(casado[0]))) {
      continue;
    }
    return forma;
  }
  return "livre";
}

/** As formas que só se respondem com itens: uma métrica solta não basta. */
const PEDEM_ITENS: ReadonlySet<FormaDaPergunta> = new Set<FormaDaPergunta>([
  "superlativo",
  "lista",
  "identidade",
]);

/** A leitura traz linhas, e não um número só. */
function temItens(r: Resolucao): boolean {
  return r.leituras.some((l) => {
    const t = l.leitura.tipo;
    return (
      t === "ranking" ||
      t === "decomposicao" ||
      t === "serie" ||
      t === "grafico"
    );
  });
}

/**
 * A pergunta pede um valor em dinheiro, e só isso se confere.
 *
 * As outras famílias — contagem, tempo — foram medidas e tiradas: "quantos
 * têm ensino superior?" é contagem na pergunta e porcentagem na resposta, e
 * está certo assim; "em quantos dias recebemos?" idem. Sobrou o caso que
 * importa e não tem falso positivo: pediram um valor em reais e veio uma
 * taxa, que é a forma do defeito do print ("quanto gastei" → "16,5%").
 */
const PEDE_DINHEIRO =
  /\b(?:quanto (?:custa|custou|gast\w+|pag\w+|fatur\w+|receb\w+|sobr\w+|entrou|saiu)|em reais)\b/;

/** As unidades que são taxa, e não valor. */
const TAXAS: ReadonlySet<string> = new Set(["pct", "pp", "vezes"]);

/** As palavras de conteúdo de um texto: as que têm peso para casar assunto. */
const CURTA = 3;
function conteudoDe(texto: string): readonly string[] {
  return palavrasDe(texto).filter((p) => p.length > CURTA);
}

/**
 * As palavras de conteúdo de uma **pergunta**.
 *
 * Fora o mês, o recorte e as palavras que não pedem nada — as mesmas listas
 * do roteamento. Sem isto, "e no ano todo?" reprovava por "todo" não aparecer
 * na resposta, quando a continuação herda o assunto do turno anterior e não
 * tem assunto próprio nenhum.
 */
function conteudoDaPergunta(pergunta: string): readonly string[] {
  return conteudoDe(semRecorte(semMes(pergunta))).filter(
    (p) => !NEUTRAS.has(p),
  );
}

/**
 * Tudo que a resposta nomeia: rótulos lidos, itens, painel, considerações.
 *
 * Os **sinônimos** da métrica entram junto, e são o que faz esta camada
 * funcionar: o rótulo raramente divide palavra com a pergunta ("Prazo médio
 * de recebimento" contra "em quantos dias recebemos dos clientes?"), e os
 * sinônimos são exatamente as palavras que Produto declarou como as que a
 * pessoa usa.
 */
function vocabularioDaResposta(r: Resolucao): ReadonlySet<string> {
  const partes: string[] = [r.rotulo, r.formula, vocabularioDe(r.metrica)];
  for (const c of r.consideracoes) partes.push(c.rotulo);
  for (const { leitura: l } of r.leituras) {
    if ("rotulo" in l) partes.push(l.rotulo);
    if (l.tipo === "ranking" || l.tipo === "decomposicao") {
      partes.push(l.dimensao.replace(/_/g, " "));
      for (const i of l.itens) partes.push(i.rotulo);
    }
    if (l.tipo === "grafico") partes.push(l.resumo.titulo);
    if (l.tipo === "catalogo") {
      for (const m of l.metricas) partes.push(m.rotulo);
    }
  }
  return new Set(partes.flatMap(conteudoDe));
}

/**
 * A resposta responde a pergunta?
 *
 * Pura: recebe a pergunta e o envelope já resolvido, e não lê nada.
 */
export function relevancia(pergunta: string, r: Resolucao): Pertinencia {
  const forma = formaDaPergunta(pergunta, r.metrica);

  // 1 · A forma exige itens, e a resposta tem um número só.
  if (PEDEM_ITENS.has(forma) && !temItens(r)) {
    return { ok: false, motivo: "sem_itens", forma };
  }

  /*
   * 2 · Pediram um valor em reais e veio uma taxa.
   *
   * Não vale quando a pergunta apenas **nomeia** a métrica: "quanto pagamos
   * de encargos?" pede Encargos, que é uma taxa declarada pelo catálogo, e
   * responder a taxa é responder a pergunta. O que a camada pega é o outro
   * caso — a pergunta pede um valor de alguma coisa que a métrica escolhida
   * não é.
   */
  const soNomeia = restoDaPergunta(pergunta, r.metrica) === "";
  if (!soNomeia && PEDE_DINHEIRO.test(normalizar(pergunta))) {
    if (TAXAS.has(r.unidade)) {
      return { ok: false, motivo: "unidade_incompativel", forma };
    }
  }

  /*
   * 3 · Nenhum termo de conteúdo da pergunta aparece na resposta.
   *
   * A camada mais fraca das três, e de propósito: ela só dispara quando não
   * há **nenhuma** interseção, que é o caso em que a resposta mudou de
   * assunto. Pergunta sem termo próprio — "e no ano todo?" — passa, que é o
   * certo: a continuação herda o assunto do turno anterior.
   */
  const daPergunta = conteudoDaPergunta(pergunta);
  if (daPergunta.length > 0) {
    const daResposta = vocabularioDaResposta(r);
    if (!daPergunta.some((p) => daResposta.has(p))) {
      return { ok: false, motivo: "fora_do_assunto", forma };
    }
  }

  return { ok: true, motivo: null, forma };
}
