/**
 * Os blocos de uma resposta, como a bolha os desenha (T-441, T-444).
 *
 * Produto viu o texto do modelo como um bloco corrido: os parágrafos que a
 * instrução pede chegavam separados por quebra de linha, e a bolha os
 * colava num `<p>` só. Aqui o texto vira blocos, e o que começa com
 * "Traduzindo:" ganha rótulo próprio — é a frase que diz o que o número
 * significa para o negócio, e merece o olho.
 *
 * ## Por que uma lista é um bloco, e não vários parágrafos
 *
 * Desde T-445 a forma segue a pergunta, e quem pede uma lista recebe uma
 * lista: o modelo escreve um item por linha, começando com "- ". Partir por
 * quebra de linha, como antes, daria um `<p>` por item com um traço literal
 * no meio do texto. As linhas de item consecutivas viram **um** bloco, e a
 * bolha as desenha como o mini-quadro do ranking já desenha — rótulo à
 * esquerda, valor à direita.
 *
 * Só forma: nada aqui lê, calcula ou formata número. O texto continua o que
 * o verificador conferiu, e o valor de cada item é a fatia que o modelo
 * escreveu, copiada como está.
 */

/** O rótulo do parágrafo que traduz o número para o negócio. */
export const ROTULO_DA_TRADUCAO = "Traduzindo";

/** Um item de lista: o rótulo e, quando o modelo escreveu um, o valor. */
export type ItemDaLista = {
  readonly rotulo: string;
  /** O que veio depois do último ": " da linha; `null` quando não veio nada. */
  readonly valor: string | null;
};

export type BlocoDaResposta =
  | {
      readonly tipo: "paragrafo";
      /** `ROTULO_DA_TRADUCAO` no que começa com "Traduzindo:"; senão `null`. */
      readonly rotulo: string | null;
      readonly texto: string;
    }
  | { readonly tipo: "lista"; readonly itens: readonly ItemDaLista[] };

const MARCA_DA_TRADUCAO = /^Traduzindo:\s*/;

/**
 * A marca de item. O espaço depois do traço é o que separa um item de um
 * número negativo no início da linha ("-R$ 2,3" não é item).
 */
const MARCA_DE_ITEM = /^[-*•]\s+/;

/** O separador entre o rótulo e o valor de um item, o último da linha. */
const SEPARADOR_DE_ITEM = ": ";

function itemDaLinha(linha: string): ItemDaLista {
  const corpo = linha.replace(MARCA_DE_ITEM, "").trim();
  const corte = corpo.lastIndexOf(SEPARADOR_DE_ITEM);
  if (corte === -1) return { rotulo: corpo, valor: null };
  const rotulo = corpo.slice(0, corte).trim();
  const valor = corpo.slice(corte + SEPARADOR_DE_ITEM.length).trim();
  return rotulo === "" || valor === ""
    ? { rotulo: corpo, valor: null }
    : { rotulo, valor };
}

function paragrafoDaLinha(linha: string): BlocoDaResposta {
  const marca = MARCA_DA_TRADUCAO.exec(linha);
  if (marca === null) return { tipo: "paragrafo", rotulo: null, texto: linha };
  const resto = linha.slice(marca[0].length).trim();
  return resto === ""
    ? { tipo: "paragrafo", rotulo: null, texto: linha }
    : { tipo: "paragrafo", rotulo: ROTULO_DA_TRADUCAO, texto: resto };
}

/**
 * Quebra o texto em blocos: por linha em branco ou por quebra simples, e
 * sempre antes de "Traduzindo:", mesmo quando o modelo o colou na frase
 * anterior. Linhas de item consecutivas viram um bloco de lista. Bloco vazio
 * não existe.
 */
export function blocosDaResposta(texto: string): readonly BlocoDaResposta[] {
  const preparado = texto.replace(/\s*\bTraduzindo:/g, "\n\nTraduzindo:");
  const linhas = preparado
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l !== "");

  const blocos: BlocoDaResposta[] = [];
  let lista: ItemDaLista[] = [];

  const fechar = (): void => {
    if (lista.length === 0) return;
    blocos.push({ tipo: "lista", itens: lista });
    lista = [];
  };

  for (const linha of linhas) {
    if (MARCA_DE_ITEM.test(linha)) {
      lista.push(itemDaLinha(linha));
      continue;
    }
    fechar();
    blocos.push(paragrafoDaLinha(linha));
  }
  fechar();

  return blocos;
}
