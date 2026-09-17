/**
 * As regras de número que todo prompt do chat repete (D-CHAT-ferramentas).
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
  "leituras", com o valor pronto.
- Sem saudação, sem repetir a pergunta, sem título, sem lista com marcadores.`;
