/**
 * O domínio do recorte, derivado das dimensões — nunca escrito à mão (T-004).
 *
 * Este é o portão que a decisão **D-P8** exigiu antes de qualquer tipo de
 * `Query` ser congelado: `docs/decisoes/D-P8-filtro-ano.md`.
 *
 * Antes de D-P8 o ano era um par fixo de literais no código, e o número de
 * recortes canônicos — 768 — era uma constante escrita nos critérios de aceite.
 * As duas coisas eram a mesma dívida: um valor de negócio congelado em tipo.
 * Depois de D-P8 o ano é dimensão como as outras, a lista vem de `getMeta`, e
 * **a contagem de recortes é calculada, não escrita**.
 *
 * Por que isso importa na prática: em janeiro de 2027 o cliente carrega 2027 na
 * réplica e o filtro passa a oferecer 2027 sozinho. Nada aqui muda, nenhuma
 * imagem nova é publicada, e a matriz de recortes da suíte de contrato cresce
 * junto — porque ela conta o que existe em vez de repetir um número.
 */

/**
 * As dimensões que `getMeta` devolve.
 *
 * O ano é opcional de propósito: D-P8 considerou três saídas, e duas delas
 * sobrevivem no tipo — ano como dimensão (saída escolhida) e ano ausente do
 * recorte (saída *c*, descartada mas não impossível). Deixar a ausência
 * representável é o que permite testar as duas sem reescrever o domínio.
 */
export type Dimensoes = {
  readonly periodo: readonly string[];
  /** Ausente quando o ano não faz parte do recorte (D-P8, saída *c*). */
  readonly ano?: readonly string[];
  readonly entidade: readonly string[];
  readonly area: readonly string[];
  readonly modalidade: readonly string[];
};

/** Um recorte concreto: um valor escolhido em cada dimensão disponível. */
export type Recorte = {
  readonly periodo: string;
  readonly ano?: string;
  readonly entidade: string;
  readonly area: string;
  readonly modalidade: string;
};

/** As dimensões na ordem canônica, para a matriz sair sempre igual. */
const ORDEM = ["periodo", "ano", "entidade", "area", "modalidade"] as const;

function valoresDe(
  d: Dimensoes,
  nome: (typeof ORDEM)[number],
): readonly string[] {
  const v = d[nome];
  // Ano ausente contribui com uma única combinação vazia, não com zero — senão
  // o produto inteiro zeraria e a matriz sairia sem nenhum recorte.
  if (v === undefined) return [];
  return v;
}

/**
 * Quantos recortes canônicos existem, dadas as dimensões.
 *
 * É o produto do tamanho de cada dimensão presente. Nenhum número literal:
 * com as dimensões do PRD seção 6.2 e dois anos carregados, isto devolve 768 —
 * mas devolve por multiplicação, e passa a devolver 1.152 no dia em que um
 * terceiro ano entrar nos dados.
 */
export function contarRecortes(d: Dimensoes): number {
  let total = 1;
  for (const nome of ORDEM) {
    const valores = valoresDe(d, nome);
    if (valores.length === 0) continue; // dimensão ausente não multiplica
    total *= valores.length;
  }
  return total;
}

/**
 * A matriz canônica de recortes.
 *
 * Enumera todas as combinações, na ordem das dimensões. A suíte de contrato
 * percorre isto em vez de uma lista escrita à mão — é o que faz "todos os
 * recortes" continuar significando todos depois que as dimensões mudarem.
 */
export function matrizDeRecortes(d: Dimensoes): readonly Recorte[] {
  const periodos = valoresDe(d, "periodo");
  const anos = valoresDe(d, "ano");
  const entidades = valoresDe(d, "entidade");
  const areas = valoresDe(d, "area");
  const modalidades = valoresDe(d, "modalidade");

  if (
    periodos.length === 0 ||
    entidades.length === 0 ||
    areas.length === 0 ||
    modalidades.length === 0
  ) {
    throw new RangeError(
      "matrizDeRecortes recebeu dimensão obrigatória vazia. " +
        "Só o ano pode faltar (D-P8); as demais sempre têm ao menos um valor.",
    );
  }

  // Ano ausente vira uma passada única sem a chave, o que mantém o resto igual.
  const anosParaPercorrer: readonly (string | undefined)[] =
    anos.length === 0 ? [undefined] : anos;

  const recortes: Recorte[] = [];
  for (const periodo of periodos) {
    for (const ano of anosParaPercorrer) {
      for (const entidade of entidades) {
        for (const area of areas) {
          for (const modalidade of modalidades) {
            recortes.push({
              periodo,
              entidade,
              area,
              modalidade,
              ...(ano === undefined ? {} : { ano }),
            });
          }
        }
      }
    }
  }
  return recortes;
}

/** O ano faz parte do recorte nesta instalação? (D-P8) */
export function anoEhDimensao(d: Dimensoes): boolean {
  return d.ano !== undefined && d.ano.length > 0;
}

/**
 * O ano pedido existe entre os anos disponíveis?
 *
 * É esta função — e não um tipo com dois literais — que recusa um ano fora do
 * domínio. A diferença aparece quando o cliente carrega 2027: aqui basta o dado
 * chegar; com literais no tipo, seria preciso editar código e reimplantar.
 */
export function anoValido(d: Dimensoes, ano: string): boolean {
  return (d.ano ?? []).includes(ano);
}
