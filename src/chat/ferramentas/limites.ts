/**
 * Os limites do laço de ferramentas, todos nomeados (D-CHAT-ferramentas).
 *
 * Nenhum deles é afinação de qualidade: são tetos de custo e de latência.
 * Uma pergunta composta faz duas ou três idas ao gateway; cada ida leva alguns
 * segundos; e cada leitura é uma consulta pela fronteira de perfil. Os tetos
 * mantêm a pior pergunta dentro do que a seção 13 aceita.
 */

/** Quantas leituras o modelo pode pedir numa pergunta. A quinta é recusada. */
export const MAXIMO_DE_CHAMADAS = 4;

/** Quantas rodadas de ferramentas antes de forçar o texto. */
export const MAXIMO_DE_RODADAS = 3;

/** Quanto se espera por uma rodada do gateway. */
export const LIMITE_MS_POR_RODADA = 20_000;

/** O texto final da resposta composta cabe nisto. */
export const TETO_DE_SAIDA_COMPOSTA = 1600;

/** Quantos itens um ranking traz quando o modelo não diz. */
export const TOP_N_PADRAO = 5;

/** Quantos itens um ranking pode trazer, no máximo. */
export const TOP_N_MAXIMO = 10;

/** Quantas categorias uma decomposição mostra antes de juntar em "outros". */
export const MAXIMO_DE_CATEGORIAS = 12;

/** Quantas métricas uma comparação aceita. */
export const MINIMO_DE_METRICAS_NA_COMPARACAO = 2;
export const MAXIMO_DE_METRICAS_NA_COMPARACAO = 4;

/** Quantas métricas a busca no catálogo devolve. */
export const MAXIMO_DE_METRICAS_LISTADAS = 8;

/**
 * Até onde, em caracteres, o rótulo de um ponto pode estar do número citado.
 *
 * Um ponto de série, de gráfico ou de ranking só passa no verificador quando
 * o texto diz **de que** ponto se trata: "em mar/2026, 5,2%". Sem o rótulo por
 * perto, o número é um valor solto que pode ser de qualquer mês.
 */
export const RAIO_DO_ROTULO = 80;
