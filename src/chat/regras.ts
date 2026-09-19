/**
 * As regras que todo prompt do chat repete (D-CHAT-ferramentas).
 *
 * Módulo próprio, sem importar nada: o caminho simples (`openrouter.ts`) e o
 * laço de ferramentas (`laco.ts`) leem daqui, e os testes que substituem o
 * gateway do chat não precisam saber que estas linhas existem.
 */

/**
 * As regras de número, as mesmas nos dois caminhos.
 *
 * O laço de ferramentas (`laco.ts`) repete estas linhas na instrução dele: o
 * modelo que compõe leituras obedece exatamente ao que o modelo que redige
 * uma métrica obedece. Uma cópia divergente seria dois verificadores.
 *
 * São só regras de número. A forma saiu daqui em T-445 — ver
 * `REGRAS_DE_FORMA`.
 */
export const REGRAS_DE_NUMERO = `- Use SOMENTE os números que estão no JSON. Não some, não subtraia, não
  arredonde para outro valor, não converta para outra unidade, não estime e não
  invente número nenhum — nem como exemplo, nem como hipótese, nem como
  "cerca de".
- Escreva cada número exatamente como está no campo "formatado", com o sinal, a
  vírgula e a unidade: "1,8 vezes" (nunca "1,8x"), "+2,1 p.p.", "R$ 1.200,0 mi".
- Número negativo leva o sinal: "devolveu -R$ 2,3", "ganho real de -6,4%".
  Se disser o sinal em palavra ("perda de R$ 2,3", "5,6 p.p. abaixo do CDI"),
  a palavra fica na mesma frase, colada ao número.
- Não calcule diferença, variação nem proporção: as que existem já estão em
  "leituras", com o valor pronto.`;

/**
 * As regras de forma que valem em qualquer resposta, seja qual for a pergunta.
 *
 * Saíram de `REGRAS_DE_NUMERO` em T-445. Enquanto toda resposta tinha a mesma
 * forma, "sem título, sem lista com marcadores" era uma regra de número como
 * outra qualquer — as duas instruções a embutiam, e nenhuma podia autorizar
 * uma lista. Desde que a forma segue a pergunta, quem pede uma lista recebe
 * uma lista, e o que sobra aqui é o que não depende do que foi perguntado.
 */
export const REGRAS_DE_FORMA = `- Sem saudação — a não ser o primeiro nome de quem pergunta, uma vez, quando
  ele vier no contexto —, sem repetir a pergunta e sem título. Nunca invente
  sobrenome, cargo ou empresa.`;
