/**
 * As frases de recusa que mais de um caminho usa.
 *
 * Moram aqui, e não em `perguntar.ts`, porque o laço também recusa — e
 * `perguntar` importa o laço.
 */

/**
 * A recusa de assunto: a pergunta não é sobre os dados da empresa.
 *
 * Diferente de "não tenho essa métrica": ali a pessoa perguntou do negócio e o
 * catálogo não cobre, e as métricas próximas ajudam. Aqui não há próxima — e
 * a frase diz o que o chat responde, para a recusa não ser um beco.
 */
export const RECUSA_FORA_DO_ASSUNTO =
  "Não posso responder a esse tipo de pergunta. Respondo só sobre os dados da " +
  "empresa que estão neste painel: receita e resultado, caixa, contas a pagar " +
  "e a receber, orçamento, dívida e pessoas. Pergunte, por exemplo, qual foi " +
  "a receita líquida de março ou como está o turnover.";

/** O laço rodou, leu, e nenhuma leitura nomeia métrica que responda. */
export const RECUSA_SEM_LEITURA =
  "Não encontrei no painel dado que responda a isso. Estas são as métricas mais próximas:";
