/**
 * Por onde a pergunta é respondida: o atalho de uma métrica, ou o laço de
 * ferramentas (T-446).
 *
 * ## O que estava errado
 *
 * Até aqui, quem decidia era `classificar`: uma lista fechada de frases em
 * português — "top", "maiores", "mês a mês", "compare" — e, fora dela, a
 * pergunta caía no caminho de uma métrica, respondida pela mais próxima do
 * catálogo. Produto mandou três prints em 2026-09-19 e o registro deu a
 * medida: de sete perguntas naturais sobre os dados, **seis** não acendiam
 * sinal nenhum. "Qual foi a maior despesa de junho?" saía como "Despesa de
 * pessoal: 16,5%", com confiança alta, porque o padrão de ranking tem
 * "maiores" e não "maior".
 *
 * Uma lista de frases nunca cobre uma língua. O que ela media era a forma da
 * pergunta; o que decide é outra coisa.
 *
 * ## A regra: o que sobra da pergunta
 *
 * O atalho responde uma métrica, um recorte. Ele serve — e só serve — quando
 * a pergunta **não pede nada além de nomear a métrica**. Então tira-se da
 * pergunta o vocabulário da própria métrica, o mês, o recorte e as palavras
 * que não pedem nada (interrogativos, artigos, verbos de ligação). O que
 * sobra é o que a pessoa perguntou a mais. Sobrou alguma coisa → o laço, que
 * sabe ler ranking, série, decomposição e comparação.
 *
 * "Como está o turnover?" não sobra nada: atalho, em três segundos, que é o
 * que uma plateia clicando o guia da tela precisa. "Fora a despesa com
 * pessoal, o que mais eu gastei que foi fora do normal?" sobra `fora`,
 * `gastei`, `normal`: laço.
 *
 * ## Duas guardas que não são a regra
 *
 * **Sem gateway, vale o `classificar` de hoje, byte a byte.** É quebra
 * deliberada da invariante que `classificar.ts` declara ("a classificação é
 * nossa, e é a mesma com ou sem chave"), e a razão é concreta: sem chave o
 * laço só responde duas formas determinísticas, e mandar tudo para ele
 * transformaria o produto inteiro — e toda resposta do arnês de e2e, que roda
 * sem chave de propósito — em "sem o modelo configurado".
 *
 * **"Por que" continua no atalho.** Não há ferramenta de causa, e o laço
 * responderia pior que o estágio 2, que já lê as métricas de apoio. Fingir
 * que existe uma porta para causa seria pior que não ter.
 *
 * `CHAT_ROTA=sinais` devolve o roteamento anterior sem deploy.
 */

import {
  classificar,
  normalizar,
  sinaisDe,
  vocabularioDe,
  type Sinal,
} from "@/chat/classificar";
import {
  CONFIANCA_MINIMA,
  semRecorte,
  type Intencao,
} from "@/chat/interpretar";
import { mesesDaPergunta, semMes } from "@/chat/mes";

export type CaminhoEscolhido = "atalho" | "laco";

/** Por que a rota foi essa. Vai ao registro, e é o que os testes fixam. */
export type MotivoDaRota =
  /** A pergunta continua a anterior: a métrica vem da conversa. */
  | "continuacao"
  /** "Por que …": a causa é o apoio do estágio 2, e não há ferramenta dela. */
  | "causa"
  /** A pergunta só nomeia a métrica; não sobra nada. */
  | "casamento_exato"
  /** Sem chave, e sem sinal composto: o caminho de sempre. */
  | "sem_gateway_sem_sinal"
  /** Um sinal que o laço sabe atender: ranking, série, comparação… */
  | "sinal_composto"
  /** Sobrou pergunta depois de tirar métrica, mês, recorte e o resto. */
  | "resto_aberto"
  /** Nada casou no catálogo, ou casou por palavra solta. */
  | "sem_casamento"
  /** A pergunta nomeia mais de um mês: o atalho só sabe responder um. */
  | "varios_meses";

export type Rota = {
  readonly caminho: CaminhoEscolhido;
  readonly porque: MotivoDaRota;
  /** Os sinais achados, para o registro e para o laço saber o que se pediu. */
  readonly sinais: readonly Sinal[];
};

/**
 * As palavras que não pedem nada.
 *
 * Interrogativos, artigos, preposições, pronomes, verbos de ligação, a
 * cortesia com que se pede uma coisa e os verbos genéricos com que se pergunta
 * um número — "quanto **pagamos** de encargos?" não pede nada além dos
 * encargos.
 *
 * Duas famílias ficam **de fora**, de propósito:
 *
 * - **Superlativo e comparação** — "maior", "mais", "melhor", "pior", "menos".
 *   São exatamente o que precisa sobrar: quem pergunta o maior quer uma lista,
 *   e o atalho só tem um número.
 * - **Demonstrativo de plural** — "esses", "essas", "aqueles", "isso". São
 *   referência ao que foi respondido antes; "e esses lançamentos são o que?"
 *   pede os lançamentos que a resposta anterior contou, e só o laço, que vê a
 *   conversa, alcança isso.
 */
export const NEUTRAS: ReadonlySet<string> = new Set([
  // interrogativos
  "qual",
  "quais",
  "quanto",
  "quanta",
  "quantos",
  "quantas",
  "como",
  "quando",
  "quem",
  "onde",
  "que",
  "o",
  // artigos, preposições e contrações
  "a",
  "os",
  "as",
  "um",
  "uma",
  "uns",
  "umas",
  "de",
  "do",
  "da",
  "dos",
  "das",
  "em",
  "no",
  "na",
  "nos",
  "nas",
  "ao",
  "aos",
  "pelo",
  "pela",
  "para",
  "pra",
  "por",
  "com",
  "sem",
  "e",
  "ou",
  "num",
  "numa",
  "sobre",
  "entre",
  "ate",
  "desde",
  "durante",
  // pronomes. Sem os demonstrativos de plural: ver o comentário acima.
  "eu",
  "me",
  "mim",
  "meu",
  "minha",
  "meus",
  "minhas",
  "nosso",
  "nossa",
  "nossos",
  "nossas",
  "se",
  "ele",
  "ela",
  "aqui",
  "todo",
  "toda",
  "todos",
  "todas",
  // verbos de ligação e de estado
  "e",
  "foi",
  "foram",
  "ser",
  "sao",
  "esta",
  "estao",
  "tem",
  "temos",
  "ter",
  "teve",
  "tivemos",
  "fica",
  "ficou",
  "anda",
  "vai",
  "ficar",
  "estamos",
  // tempo sem recorte
  "hoje",
  "agora",
  "atual",
  "atualmente",
  // cortesia e pedido
  "favor",
  "mostra",
  "mostre",
  "mostrar",
  "diga",
  "dizer",
  "fale",
  "falar",
  "ver",
  "veja",
  "saber",
  "quero",
  "queria",
  "gostaria",
  "poderia",
  "pode",
  "preciso",
  "informe",
  "informa",
  // os verbos genéricos com que se pergunta um número
  "pagamos",
  "paguei",
  "paga",
  "pagou",
  "gastamos",
  "gastou",
  "gasta",
  "investimos",
  "investiu",
  "demos",
  "damos",
  "apurado",
  "apurou",
  "apuramos",
  "faturamos",
  "faturou",
  "recebemos",
  "recebeu",
  "vendemos",
  "vendeu",
  "custa",
  "custou",
  "custam",
  "atingiu",
  "chegou",
  "registramos",
  "registrou",
  "crescemos",
  "cresceu",
  "fez",
  "fizemos",
  "ha",
  "havia",
]);

/**
 * A raiz de uma palavra, só para o plural.
 *
 * "Quantas horas de treinamento demos?" casa `conclusao_treinamento`, cujo
 * rótulo diz "treinamento" no singular; sem isto, "treinamentos" sobrava e a
 * sugestão da tela ia ao laço por causa de um "s". Não é um radicalizador de
 * verdade e não precisa ser: os dois lados passam pela mesma função, então
 * basta que sejam consistentes.
 */
function raiz(palavra: string): string {
  const CURTA = 3;
  return palavra.length > CURTA ? palavra.replace(/s$/, "") : palavra;
}

/** As palavras de um texto, já normalizadas, sem pontuação e sem vazios. */
export function palavrasDe(texto: string): readonly string[] {
  return normalizar(texto)
    .split(/[^\p{Letter}\p{Number}]+/u)
    .filter((p) => p !== "");
}

/**
 * O que sobra da pergunta depois de tirar tudo que não é pedido.
 *
 * O mês e o recorte saem pelos mesmos módulos que os leem — `semMes` e
 * `semRecorte` —, e não por uma lista paralela que sairia de sincronia.
 */
export function restoDaPergunta(pergunta: string, metrica: string): string {
  const daMetrica = new Set(palavrasDe(vocabularioDe(metrica)).map(raiz));
  return palavrasDe(semRecorte(semMes(pergunta)))
    .filter((p) => !NEUTRAS.has(p) && !daMetrica.has(raiz(p)))
    .join(" ");
}

/** O roteamento anterior, atrás de `CHAT_ROTA=sinais`. */
export function porSinais(
  ambiente: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return ambiente["CHAT_ROTA"] === "sinais";
}

/**
 * Por onde esta pergunta é respondida.
 *
 * Puro: recebe o palpite local e a continuação já calculados, e não lê nada.
 * Quem chama é `resolverPergunta`, que é quem tem a conversa e o contexto.
 */
export function decidirCaminho(
  pergunta: string,
  palpite: Intencao | null,
  continuacao: Intencao | null,
  temGateway: boolean,
): Rota {
  const sinais = sinaisDe(pergunta, palpite);
  const composta = classificar(pergunta, palpite).classe === "composta";

  /*
   * A continuação fica no caminho da resposta anterior, ainda que carregue um
   * sinal de série ou de ranking: "no ano todo" é sinal numa pergunta nova, e
   * recorte numa continuação (T-443).
   */
  if (continuacao !== null) {
    return { caminho: "atalho", porque: "continuacao", sinais };
  }

  /*
   * Mais de um mês nomeado (T-457).
   *
   * O atalho responde uma métrica num recorte, e carrega **um** ponto de mês
   * (`pontoPedido`). "Qual o faturamento de abril e agosto?" pede dois valores
   * e o total, e ali saía com um só. O laço lê os dois e deixa o banco somar.
   */
  const MAIS_DE_UM = 1;
  if (mesesDaPergunta(pergunta).length > MAIS_DE_UM) {
    return { caminho: "laco", porque: "varios_meses", sinais };
  }

  if (!temGateway || porSinais()) {
    return composta
      ? { caminho: "laco", porque: "sinal_composto", sinais }
      : { caminho: "atalho", porque: "sem_gateway_sem_sinal", sinais };
  }

  // O sinal é a razão mais específica: quem pediu um ranking pediu um ranking,
  // tenha ou não casado uma métrica.
  if (composta) {
    return { caminho: "laco", porque: "sinal_composto", sinais };
  }

  /*
   * Sem métrica nomeada por termo inteiro e com confiança, o atalho só teria
   * a mais próxima para oferecer — que é exatamente o defeito dos prints. O
   * laço busca no catálogo antes de qualquer recusa.
   */
  const nomeada =
    palpite !== null &&
    palpite.metrica !== "" &&
    palpite.inteiro &&
    palpite.confianca >= CONFIANCA_MINIMA;
  if (!nomeada) {
    return { caminho: "laco", porque: "sem_casamento", sinais };
  }

  if (sinais.includes("causa")) {
    return { caminho: "atalho", porque: "causa", sinais };
  }
  return restoDaPergunta(pergunta, palpite.metrica) === ""
    ? { caminho: "atalho", porque: "casamento_exato", sinais }
    : { caminho: "laco", porque: "resto_aberto", sinais };
}
