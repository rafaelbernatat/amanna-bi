/**
 * O escopo da nota de cada painel (T-133, PRD seção 6.3 e RF-09).
 *
 * > "Sob recorte ativo, uma nota escrita para o consolidado é falsa. […]
 * > **nenhum texto narrativo pode afirmar um número que não corresponde ao
 * > recorte em tela.** Um painel que não tem narrativa para o recorte mostra o
 * > gráfico sem narrativa — nunca a narrativa errada."
 *
 * ## O protótipo detecta; aqui se declara
 *
 * O protótipo resolve isso com uma expressão regular sobre o texto:
 *
 * ```js
 * hasAbs(x) { return /R\$\s?[\d.,]+|\b\d[\d.,]*\s?(mi|mil|FTE|h|pessoas|…)\b/.test(x) }
 * const note = (F.on && this.hasAbs(o.note)) ? '' : (o.note || '')
 * ```
 *
 * Funciona quando a nota diz "340 pessoas". Não funciona quando ela diz
 * *"Operações e Comercial respondem por 71% do estouro"* — não há unidade da
 * lista, o teste passa, e a frase sobrevive ao recorte afirmando uma proporção
 * do consolidado sobre uma área. É a mesma falsidade com outra gramática.
 *
 * Detectar é adivinhar depois. Aqui cada painel **declara** o escopo da sua
 * nota, e o detector vira guarda: ele não decide o que aparece, ele reprova
 * quem declarou errado. A diferença aparece quando alguém escreve uma nota
 * nova — com detecção, ela passa até alguém notar; com declaração, ela não
 * compila sem escopo.
 *
 * ## Os três escopos
 *
 * | Escopo | Quando aparece | Por quê |
 * |---|---|---|
 * | `sem_nota` | nunca | O painel não tem narrativa. É o caso da maioria. |
 * | `so_no_padrao` | só no recorte padrão | Texto escrito sobre o consolidado. Some sob qualquer filtro. |
 * | `do_recorte` | sempre | Calculada do envelope em tela, então vale para o recorte que a produziu. |
 *
 * Não existe um quarto escopo do tipo "adapta o texto ao recorte". O PRD é
 * explícito: notas escritas para o consolidado são **suprimidas, não
 * adaptadas** (RF-09). Adaptar é reescrever uma afirmação que ninguém
 * verificou.
 */

import { ORIGEM_DOS_PAINEIS } from "@/semantica/origem-de-painel";

/* ------------------------------------------------------------------ *
 * O escopo
 * ------------------------------------------------------------------ */

export const ESCOPOS_DE_NOTA = [
  "sem_nota",
  "so_no_padrao",
  "do_recorte",
] as const;

export type EscopoDeNota = (typeof ESCOPOS_DE_NOTA)[number];

/**
 * Como a nota de um painel é produzida.
 *
 * `do_recorte` traz o nome da receita — e não o texto. Texto guardado aqui
 * seria texto escrito uma vez sobre um recorte, que é o defeito inteiro.
 */
export type NotaDeclarada =
  | { readonly escopo: "sem_nota" }
  | { readonly escopo: "so_no_padrao"; readonly texto: string }
  | { readonly escopo: "do_recorte"; readonly receita: ReceitaDeNota };

/**
 * As receitas de nota que existem.
 *
 * Enum fechado, e curto de propósito: cada receita é uma afirmação que alguém
 * precisa poder conferir contra o envelope. Uma receita a mais é uma frase a
 * mais que o produto passa a afirmar.
 *
 * - `concentracao` — quanto as duas maiores categorias respondem do total.
 *   Vale em qualquer recorte porque é calculada sobre as categorias que o
 *   recorte devolveu, e não sobre as sete do consolidado.
 */
export const RECEITAS_DE_NOTA = ["concentracao"] as const;

export type ReceitaDeNota = (typeof RECEITAS_DE_NOTA)[number];

/* ------------------------------------------------------------------ *
 * A declaração, painel a painel
 * ------------------------------------------------------------------ */

/**
 * Os painéis cuja nota é calculada do recorte.
 *
 * Só os que quebram por categoria e somam a um todo: `concentracao` afirma
 * "as duas maiores respondem por X% do total", e isso só é uma frase honesta
 * onde as partes somam o todo. Num painel de série temporal as categorias são
 * meses, e "os dois maiores meses respondem por 19% do ano" é verdade e não
 * informa nada.
 *
 * A lista é derivada do registro de origens — eixo `area` ou `categoria` —, e
 * não escrita à mão. Um painel novo com esse eixo entra sozinho; uma lista
 * escrita à mão só cresceria quando alguém lembrasse.
 */
const EIXOS_QUE_SOMAM_AO_TODO: readonly string[] = ["area"];

/**
 * A nota declarada de cada painel.
 *
 * O padrão é `sem_nota`, e isso é uma decisão e não uma omissão: RF-09 diz que
 * um painel sem narrativa para o recorte mostra o gráfico **sem narrativa**. O
 * silêncio é a resposta certa até alguém escrever uma frase que se possa
 * conferir.
 *
 * As frases narrativas do protótipo não foram trazidas: elas afirmam números
 * fixos — "51,3% do quadro", "turnover de 18,4%", "São Paulo responde por
 * 37,7%" — que são o achado 5 do Anexo D em prosa. Copiá-las importaria o
 * defeito com a aparência de conteúdo. Ver H-59.
 */
const DECLARADAS: ReadonlyMap<string, NotaDeclarada> = new Map(
  ORIGEM_DOS_PAINEIS.map((o) => [
    o.painel,
    EIXOS_QUE_SOMAM_AO_TODO.includes(o.eixo)
      ? ({ escopo: "do_recorte", receita: "concentracao" } as NotaDeclarada)
      : ({ escopo: "sem_nota" } as NotaDeclarada),
  ]),
);

/** O que um painel declara sobre a nota dele. */
export function notaDeclarada(painel: string): NotaDeclarada {
  return DECLARADAS.get(painel) ?? { escopo: "sem_nota" };
}

/** Todos os painéis que declaram nota, com o escopo. Contado, nunca escrito. */
export function escoposDeclarados(): readonly {
  readonly painel: string;
  readonly escopo: EscopoDeNota;
}[] {
  return [...DECLARADAS.entries()].map(([painel, d]) => ({
    painel,
    escopo: d.escopo,
  }));
}

/* ------------------------------------------------------------------ *
 * O detector
 * ------------------------------------------------------------------ */

/**
 * As unidades que fazem um número ser absoluto num texto.
 *
 * Vem da lista do protótipo, e cresce: ele não tinha `%`, `pp`, `p.p.` nem
 * `R$` sem espaço, e por isso deixava passar "71% do estouro" — uma proporção
 * do consolidado é tão falsa sob recorte quanto uma contagem.
 */
const UNIDADES_NO_TEXTO = [
  "mi",
  "mil",
  "FTE",
  "pessoas",
  "colaboradores",
  "vagas",
  "dias",
  "horas",
  "notas",
  "saídas",
  "desligamentos",
  "contratações",
  "clientes",
  "candidatos",
  "pontos",
  "anos",
] as const;

/**
 * O texto afirma um número?
 *
 * Reprova por excesso de propósito: um falso positivo custa uma nota que some
 * quando poderia ficar; um falso negativo custa um número errado na tela de
 * quem vai decidir com ele. Os dois erros não são simétricos.
 */
export function afirmaNumero(texto: string): boolean {
  return (
    /R\$\s*[\d.,]/.test(texto) ||
    /\d[\d.,]*\s*(%|pp\b|p\.p\.)/.test(texto) ||
    new RegExp(`\\d[\\d.,]*\\s*(${UNIDADES_NO_TEXTO.join("|")})\\b`, "i").test(
      texto,
    ) ||
    // Milhar com separador: "1.240" não precisa de unidade para ser um número.
    /\b\d{1,3}(\.\d{3})+\b/.test(texto)
  );
}
