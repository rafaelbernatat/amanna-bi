/**
 * Os parágrafos de uma resposta, como a bolha os desenha (T-441).
 *
 * Produto viu o texto do modelo como um bloco corrido: os parágrafos que a
 * instrução pede chegavam separados por quebra de linha, e a bolha os
 * colava num `<p>` só. Aqui o texto vira parágrafos, e o que começa com
 * "Traduzindo:" ganha rótulo próprio — é a frase que diz o que o número
 * significa para o negócio, e merece o olho.
 *
 * Só forma: nada aqui lê, calcula ou formata número. O texto continua o que
 * o verificador conferiu.
 */

/** O rótulo do parágrafo que traduz o número para o negócio. */
export const ROTULO_DA_TRADUCAO = "Traduzindo";

export type ParagrafoDaResposta = {
  /** `ROTULO_DA_TRADUCAO` no parágrafo que começa com "Traduzindo:"; senão `null`. */
  readonly rotulo: string | null;
  readonly texto: string;
};

const MARCA_DA_TRADUCAO = /^Traduzindo:\s*/;

/**
 * Quebra o texto em parágrafos: por linha em branco ou por quebra simples,
 * e sempre antes de "Traduzindo:", mesmo quando o modelo o colou na frase
 * anterior. Parágrafo vazio não existe.
 */
export function paragrafosDaResposta(
  texto: string,
): readonly ParagrafoDaResposta[] {
  const preparado = texto.replace(/\s*\bTraduzindo:/g, "\n\nTraduzindo:");
  return preparado
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p !== "")
    .map((p) => {
      const marca = MARCA_DA_TRADUCAO.exec(p);
      if (marca === null) return { rotulo: null, texto: p };
      const resto = p.slice(marca[0].length).trim();
      return resto === ""
        ? { rotulo: null, texto: p }
        : { rotulo: ROTULO_DA_TRADUCAO, texto: resto };
    });
}
