/**
 * A ordem em que as cores da paleta entram num painel de varias partes.
 *
 * ## Por que um arquivo, e nao mais chaves na paleta
 *
 * `PALETA` tem 24 chaves e cada uma nomeia um **papel** — `positivo` e o
 * sentido do numero, `comparacao` e a serie de referencia. Uma rosca de cinco
 * fatias nao precisa de cinco papeis novos: precisa de cinco cores que se
 * distingam, na mesma ordem toda vez. Acrescentar `fatia1`..`fatia5` a paleta
 * inventaria papel onde ha so ordem, e o teste de T-124 conta 24 chaves de
 * proposito.
 *
 * Aqui nao ha cor nova: a sequencia e uma **leitura** da paleta. Trocar um
 * token no tema troca a rosca junto, que e o que T-124 queria dizer com "cor e
 * decisao de tema".
 *
 * ## Por que a ordem e esta
 *
 * As quatro primeiras sao as da marca, que e como o prototipo pinta as partes
 * de um todo (a rampa `b1..b5` de `mkDonut` e `mkFunnel`). Depois vem as de
 * sentido, que so aparecem quando ha mais partes que cores de marca — e nesse
 * ponto a distincao entre fatias ja importa mais que a leitura de sentido.
 *
 * Cor nunca e o unico sinal (PRD secao 13): todo painel que usa esta sequencia
 * traz rotulo ou legenda ao lado da cor.
 */

import { razaoDeContraste } from "@/apresentacao/tema/contraste";
import { PALETA, type CoresDaMarca } from "@/apresentacao/tema/tema";
import type { Sentido } from "@/semantica/contrato";

/** A rampa categorica, na ordem de uso. */
export const SEQUENCIA_CATEGORICA: readonly string[] = [
  PALETA.marca,
  PALETA.destaque,
  PALETA.comparacao,
  PALETA.destaqueSuave,
  PALETA.marcaEscura,
  PALETA.positivo,
  PALETA.neutro,
  PALETA.meta,
];

/**
 * A cor da n-esima parte.
 *
 * Da a volta quando as partes passam de oito. Repetir cor e pior que inventar
 * uma: a repeticao e visivel e o rotulo ao lado desfaz a duvida, enquanto uma
 * cor fora da paleta quebraria a regra de T-124 sem ninguem notar.
 */
/**
 * Quando duas cores da marca sao a mesma cor, para quem olha.
 *
 * Uma empresa pode escolher cinco tons do mesmo azul. Substituir a rampa por
 * eles deixaria duas fatias vizinhas indistinguiveis — e a secao 13 pede que a
 * cor ajude a ler, nao so que combine. Abaixo desta razao a entrada volta ao
 * valor do tema: misturar marca e tema numa rampa e menos pior que repetir cor.
 */
const SEPARACAO_MINIMA = 1.2;

function separada(cor: string, anteriores: readonly string[]): boolean {
  return anteriores.every(
    (outra) => razaoDeContraste(cor, outra) >= SEPARACAO_MINIMA,
  );
}

/** Mistura uma cor com preto ou branco, na fracao pedida. */
function misturar(cor: string, claro: boolean, fracao: number): string {
  const alvo = claro ? 255 : 0;
  const canais = [1, 3, 5].map((i) => {
    const atual = Number.parseInt(cor.slice(i, i + 2), 16);
    const novo = Math.round(atual + (alvo - atual) * fracao);
    return novo.toString(16).padStart(2, "0");
  });
  return `#${canais.join("")}`;
}

/** As fracoes tentadas, do menor desvio da marca para o maior. */
const DESVIOS = [0.2, 0.35, 0.5, 0.7];

/**
 * Uma variante daquela cor que se distingue das ja escolhidas.
 *
 * O recuo do tema resolveria o caso comum, mas nao o dificil: uma marca azul
 * pode estar perto tanto das proprias cores quanto das do tema, e ai trocar
 * uma pela outra nao separa nada. Clarear ou escurecer a **propria** cor da
 * empresa mantem a rampa dentro da marca, que e o que Produto pediu, e devolve
 * a distincao que a leitura exige.
 *
 * Esgotadas as tentativas, vale a ultima: uma fatia levemente parecida, com
 * rotulo ao lado, ainda se le — e a secao 13 nunca deixou a cor ser o unico
 * sinal.
 */
function afastar(cor: string, anteriores: readonly string[]): string {
  if (separada(cor, anteriores)) return cor;
  let ultima = cor;
  for (const claro of [false, true]) {
    for (const fracao of DESVIOS) {
      ultima = misturar(cor, claro, fracao);
      if (separada(ultima, anteriores)) return ultima;
    }
  }
  return ultima;
}

/**
 * A rampa categorica de uma marca aplicada.
 *
 * As quatro entradas de marca passam a valer as cores da empresa; as de
 * sentido — `comparacao`, `positivo`, `neutro`, `meta` — **nao mudam**, pela
 * mesma razao de D-MARCA: deixar o cliente escolher a cor de "prejuizo" seria
 * dar a marca o poder de mudar o que um numero significa.
 *
 * Sem marca aplicada, devolve a rampa de sempre, e nenhum pixel muda.
 *
 * ## Por que aqui, e nao numa propriedade CSS
 *
 * `var()` nao e substituido em atributo de apresentacao de SVG, e um SVG
 * serializado para fora do documento perde o `:root` junto (ver o cabecalho de
 * `tema.ts`). Por isso o grafico recebe **valor literal**, resolvido no
 * servidor, e continua sem ler `MARCA`.
 */
export function sequenciaCategorica(
  cores?: CoresDaMarca | null,
): readonly string[] {
  if (cores === undefined || cores === null) return SEQUENCIA_CATEGORICA;

  const daMarca = [
    cores.marca,
    cores.destaque,
    cores.destaqueSuave,
    cores.marcaEscura,
  ];

  const escolhidas: string[] = [];
  for (const proposta of daMarca) {
    escolhidas.push(afastar(proposta, escolhidas));
  }
  const [marca = PALETA.marca, destaque = PALETA.destaque] = escolhidas;
  const suave = escolhidas[2] ?? PALETA.destaqueSuave;
  const escura = escolhidas[3] ?? PALETA.marcaEscura;

  return [
    marca,
    destaque,
    PALETA.comparacao,
    suave,
    escura,
    PALETA.positivo,
    PALETA.neutro,
    PALETA.meta,
  ];
}

export function corDaCategoria(
  indice: number,
  cores?: CoresDaMarca | null,
): string {
  const rampa = sequenciaCategorica(cores);
  const cor = rampa[indice % rampa.length];
  return cor ?? PALETA.marca;
}

/** O papel `marca` da rampa: a cor de uma serie unica. */
export function corPrincipal(cores?: CoresDaMarca | null): string {
  return sequenciaCategorica(cores)[0] ?? PALETA.marca;
}

/** O papel `marcaEscura`: a segunda serie de um par. */
export function corSecundaria(cores?: CoresDaMarca | null): string {
  return sequenciaCategorica(cores)[4] ?? PALETA.marcaEscura;
}

/**
 * A cor do sentido de uma medida (secao 13).
 *
 * `neutro` nao e ausencia de decisao: e a decisao de que subir nao e nem bom
 * nem ruim para aquela medida — headcount, por exemplo.
 */
export const COR_DO_SENTIDO: Readonly<Record<Sentido, string>> = {
  maior_melhor: PALETA.positivo,
  menor_melhor: PALETA.negativo,
  neutro: PALETA.texto,
};
